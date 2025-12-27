/**
 * Contact Form API
 * Handles contact form submissions
 * Rate limited to prevent spam
 */

import type { APIRoute } from 'astro';
import { getServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rate-limiter';
import { siteConfig } from '@/config';

interface ContactRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  occasion?: string;
  message: string;
  consent: boolean;
}

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize input to prevent XSS
function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 5000); // Max length
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Rate limiting - strict for contact form to prevent spam
    const rateLimitResponse = await enforceRateLimit('general', request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse request body
    const body: ContactRequest = await request.json();
    const { firstName, lastName, email, phone, occasion, message, consent } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate consent
    if (!consent) {
      return new Response(
        JSON.stringify({ error: 'Consent is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize all inputs
    const sanitizedData = {
      firstName: sanitize(firstName),
      lastName: sanitize(lastName),
      email: sanitize(email).toLowerCase(),
      phone: phone ? sanitize(phone) : null,
      occasion: occasion ? sanitize(occasion) : null,
      message: sanitize(message),
    };

    // Store in database
    const supabase = getServerClient();

    const { error: insertError } = await supabase
      .from('contact_submissions')
      .insert({
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        occasion: sanitizedData.occasion,
        message: sanitizedData.message,
        status: 'new',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      });

    if (insertError) {
      console.error('Contact form submission error:', insertError);
      // Don't expose database errors to the client
      return new Response(
        JSON.stringify({ error: 'Failed to submit message. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send email notification to admin
    try {
      const { sendEmail } = await import('@/lib/email/client');

      await sendEmail({
        to: siteConfig.contact.general,
        subject: `New Contact Form Submission from ${sanitizedData.firstName} ${sanitizedData.lastName}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${sanitizedData.firstName} ${sanitizedData.lastName}</p>
          <p><strong>Email:</strong> ${sanitizedData.email}</p>
          ${sanitizedData.phone ? `<p><strong>Phone:</strong> ${sanitizedData.phone}</p>` : ''}
          ${sanitizedData.occasion ? `<p><strong>Occasion:</strong> ${sanitizedData.occasion}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${sanitizedData.message.replace(/\n/g, '<br>')}</p>
        `,
        text: `
New Contact Form Submission

From: ${sanitizedData.firstName} ${sanitizedData.lastName}
Email: ${sanitizedData.email}
${sanitizedData.phone ? `Phone: ${sanitizedData.phone}` : ''}
${sanitizedData.occasion ? `Occasion: ${sanitizedData.occasion}` : ''}

Message:
${sanitizedData.message}
        `,
        tags: [
          { name: 'type', value: 'contact-form' },
        ],
      });
    } catch (emailError) {
      console.error('Failed to send contact form notification email:', emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you for your message! We will get back to you within 24 hours.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
