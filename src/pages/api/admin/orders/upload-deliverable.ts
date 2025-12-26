/**
 * API: Upload Order Deliverable
 * POST /api/admin/orders/upload-deliverable
 *
 * Uploads the finished song for an order.
 * Security: Admin auth, content:update permission, file validation
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../lib/auth/admin-session';
import { getServerClient } from '../../../../lib/supabase/server';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit, isValidUUID } from '../../../../lib/security/validation';
import {
  uploadFile,
  generateDeliverableKey,
  validateAudioFile,
} from '../../../../lib/storage/r2-client';
import { sendEmail, renderTemplate } from '../../../../lib/email/client';
import { siteConfig } from '../../../../config';
import { ADMIN_CONFIG } from '../../../../config/admin.constants';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-upload',
    10,
    ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE.window
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many uploads. Please wait.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      }
    );
  }

  // Admin authentication
  const adminSession = await getAdminSession(cookies);
  if (!adminSession.success) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Permission check
  if (!hasPermission(adminSession.data.permissions, 'content:update')) {
    return new Response(
      JSON.stringify({ error: 'Content update permission required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const orderId = formData.get('order_id')?.toString();
    const file = formData.get('file') as File | null;
    const notifyCustomer = formData.get('notify_customer') === 'true';

    // Validate order ID
    if (!orderId || !isValidUUID(orderId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid order ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file
    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type and size
    const validation = validateAudioFile(file.name, file.type, file.size);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getServerClient();

    // Fetch order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate storage key
    const storageKey = generateDeliverableKey(orderId, file.name);

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const uploadResult = await uploadFile(storageKey, buffer, file.type, {
      orderId,
      orderNumber: order.order_number,
      uploadedBy: adminSession.data.user.id,
    });

    if (!uploadResult.success) {
      return new Response(
        JSON.stringify({ error: uploadResult.error || 'Upload failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update order with deliverable info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        deliverable_key: storageKey,
        deliverable_filename: file.name,
        deliverable_size: file.size,
        deliverable_uploaded_at: new Date().toISOString(),
        deliverable_uploaded_by: adminSession.data.user.id,
        status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[ADMIN] Update error:', updateError);
    }

    // Record status history
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      old_status: order.status,
      new_status: 'delivered',
      changed_by: adminSession.data.user.id,
      notes: `Deliverable uploaded: ${file.name}`,
      created_at: new Date().toISOString(),
    });

    // Notify customer if requested
    if (notifyCustomer) {
      const profile = order.profiles as { full_name: string | null; email: string } | null;
      if (profile?.email) {
        // Calculate expiry (7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const template = renderTemplate('delivery', {
          orderNumber: order.order_number,
          customerName: profile.full_name || 'Valued Customer',
          packageName: formatPackageName(order.package_slug),
          downloadUrl: `${siteConfig.url}/dashboard/orders/${orderId}?download=true`,
          expiresAt: expiresAt.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        });

        await sendEmail({
          to: profile.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          tags: [
            { name: 'type', value: 'delivery' },
            { name: 'order', value: order.order_number },
          ],
        });
      }
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'content.update',
      resource_type: 'order',
      resource_id: orderId,
      metadata: {
        action: 'deliverable_uploaded',
        filename: file.name,
        size: file.size,
        notified_customer: notifyCustomer,
      },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Deliverable uploaded successfully',
        key: storageKey,
        filename: file.name,
        size: file.size,
        notified: notifyCustomer,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function formatPackageName(slug: string): string {
  const names: Record<string, string> = {
    express: 'Express Package',
    classic: 'Classic Package',
    signature: 'Signature Package',
    legacy: 'Legacy Package',
  };
  return names[slug] || slug;
}
