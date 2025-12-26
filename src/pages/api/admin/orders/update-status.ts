/**
 * API: Update Order Status
 * POST /api/admin/orders/update-status
 *
 * Security: CSRF validation, admin auth, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../lib/auth/session';
import { updateOrderStatus } from '../../../../services/admin.service';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit, isValidUUID } from '../../../../lib/security/validation';
import { ADMIN_CONFIG, VALID_ORDER_STATUSES } from '../../../../config/admin.constants';
import { getServerClient } from '../../../../lib/supabase/server';
import { sendEmail, renderTemplate } from '../../../../lib/email/client';
import { siteConfig } from '../../../../config';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-status-update',
    ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE.requests,
    ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE.window
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }),
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
  if (!hasPermission(adminSession.data.permissions, 'orders:update')) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // CSRF validation
  const csrfToken = formData.get('csrf_token')?.toString();
  if (!validateCSRFToken(cookies, csrfToken || null)) {
    return new Response(
      JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate inputs
  const orderId = formData.get('order_id')?.toString();
  const newStatus = formData.get('new_status')?.toString();
  const note = formData.get('note')?.toString();

  if (!orderId || !isValidUUID(orderId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid order ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!newStatus || !VALID_ORDER_STATUSES.includes(newStatus as any) || newStatus === 'all') {
    return new Response(
      JSON.stringify({ error: 'Invalid status value' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Update status
  const result = await updateOrderStatus(
    orderId,
    newStatus,
    adminSession.data.user.id,
    note
  );

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Send email notification for significant status changes
  const notifyStatuses = ['in_progress', 'composing', 'recording', 'mixing', 'review', 'completed'];
  if (notifyStatuses.includes(newStatus)) {
    try {
      const supabase = getServerClient();
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, profiles(full_name, email)')
        .eq('id', orderId)
        .single();

      if (order) {
        const profile = order.profiles as { full_name: string | null; email: string } | null;
        if (profile?.email) {
          const template = renderTemplate('status-update', {
            orderNumber: order.order_number,
            customerName: profile.full_name || 'Valued Customer',
            newStatus: formatStatus(newStatus),
            statusDescription: getStatusDescription(newStatus),
            portalUrl: `${siteConfig.url}/dashboard/orders/${orderId}`,
          });

          await sendEmail({
            to: profile.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            tags: [
              { name: 'type', value: 'status-update' },
              { name: 'order', value: order.order_number },
              { name: 'status', value: newStatus },
            ],
          });
        }
      }
    } catch (emailError) {
      console.error('[STATUS] Email notification failed:', emailError);
      // Don't fail the request for email errors
    }
  }

  // Audit log
  await logAdminAction({
    admin_id: adminSession.data.user.id,
    admin_email: adminSession.data.user.email,
    admin_role: adminSession.data.adminRole,
    action: 'order.status_change',
    resource_type: 'order',
    resource_id: orderId,
    metadata: { new_status: newStatus, note: note || null },
    ip_address: clientAddress,
    user_agent: request.headers.get('user-agent') || undefined,
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Status updated successfully' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

// Helper functions for email
function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    in_progress: 'In Progress',
    composing: 'Composing',
    recording: 'Recording',
    mixing: 'Mixing & Mastering',
    review: 'Ready for Review',
    completed: 'Completed',
  };
  return labels[status] || status;
}

function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    in_progress: 'We have started working on your custom song. Our team is reviewing your questionnaire and preparing to create something special for you.',
    composing: 'Our songwriter is now composing the melody and lyrics for your song based on your preferences.',
    recording: 'Your song is being recorded by our talented musicians. The magic is happening!',
    mixing: 'We are now mixing and mastering your song to ensure it sounds perfect.',
    review: 'Your song is ready for your review. Please check your dashboard to listen and provide feedback.',
    completed: 'Your song is complete and ready for download. Thank you for choosing Eventune Studios!',
  };
  return descriptions[status] || 'Your order status has been updated.';
}
