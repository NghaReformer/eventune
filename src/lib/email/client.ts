/**
 * Email Service using Resend
 * Handles transactional emails
 */

import { Resend } from 'resend';
import { brandConfig, siteConfig } from '../../config';

// Lazy initialization
let resendClient: Resend | null = null;

/**
 * Get Resend client (lazy init)
 */
function getClient(): Resend {
  if (!resendClient) {
    const apiKey = import.meta.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Email send options
 */
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

/**
 * Email send result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const client = getClient();

    const { data, error } = await client.emails.send({
      from: `${brandConfig.name} <noreply@${siteConfig.domain}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo ?? siteConfig.contact.email,
      tags: options.tags,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate URL to prevent malicious redirects
 */
function validateUrl(url: string, allowedBase: string): string {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS URLs that start with our domain
    if (parsed.protocol !== 'https:' || !url.startsWith(allowedBase)) {
      console.warn('Invalid URL in email template:', url);
      return allowedBase;
    }
    return parsed.href;
  } catch {
    return allowedBase;
  }
}

/**
 * Email template types
 */
export type EmailTemplate =
  | 'order-confirmation'
  | 'status-update'
  | 'delivery'
  | 'cancellation'
  | 'password-reset'
  | 'welcome';

/**
 * Template data types
 */
export interface OrderConfirmationData {
  orderNumber: string;
  customerName: string;
  packageName: string;
  amount: string;
  currency: string;
  occasionName: string;
  estimatedDelivery: string;
  portalUrl: string;
}

export interface StatusUpdateData {
  orderNumber: string;
  customerName: string;
  newStatus: string;
  statusDescription: string;
  portalUrl: string;
}

export interface DeliveryData {
  orderNumber: string;
  customerName: string;
  packageName: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface CancellationData {
  orderNumber: string;
  customerName: string;
  refundAmount?: string;
  reason?: string;
}

export interface PasswordResetData {
  resetUrl: string;
  expiresIn: string;
}

export interface WelcomeData {
  customerName: string;
  verificationUrl?: string;
}

export type TemplateData = {
  'order-confirmation': OrderConfirmationData;
  'status-update': StatusUpdateData;
  delivery: DeliveryData;
  cancellation: CancellationData;
  'password-reset': PasswordResetData;
  welcome: WelcomeData;
};

/**
 * Generate email HTML from template
 */
export function renderTemplate<T extends EmailTemplate>(
  template: T,
  data: TemplateData[T]
): { subject: string; html: string; text: string } {
  const { colors, name: brandName } = brandConfig;

  // Base styles
  const baseStyles = `
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: ${colors.primary.black}; color: ${colors.accent.gold}; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px 24px; }
    .footer { background: #f5f5f5; padding: 24px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; background: ${colors.accent.gold}; color: ${colors.primary.black}; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; }
    .highlight { background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0; }
    h2 { color: ${colors.primary.black}; margin-top: 0; }
    p { margin: 0 0 16px; }
  `;

  switch (template) {
    case 'order-confirmation': {
      const d = data as OrderConfirmationData;
      const safePortalUrl = validateUrl(d.portalUrl, siteConfig.url);
      return {
        subject: `Order Confirmed - ${escapeHtml(d.orderNumber)}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="header"><h1>${escapeHtml(brandName)}</h1></div>
              <div class="content">
                <h2>Thank You for Your Order!</h2>
                <p>Hi ${escapeHtml(d.customerName)},</p>
                <p>We've received your order and are excited to create your custom song!</p>
                <div class="highlight">
                  <p><strong>Order Number:</strong> ${escapeHtml(d.orderNumber)}</p>
                  <p><strong>Package:</strong> ${escapeHtml(d.packageName)}</p>
                  <p><strong>Occasion:</strong> ${escapeHtml(d.occasionName)}</p>
                  <p><strong>Amount Paid:</strong> ${escapeHtml(d.currency)} ${escapeHtml(d.amount)}</p>
                  <p><strong>Estimated Delivery:</strong> ${escapeHtml(d.estimatedDelivery)}</p>
                </div>
                <p>You can track your order progress anytime:</p>
                <p><a href="${safePortalUrl}" class="button">View Order Status</a></p>
                <p>We'll send you updates as we work on your song. If you have any questions, just reply to this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Thank you for your order ${d.orderNumber}!\n\nPackage: ${d.packageName}\nOccasion: ${d.occasionName}\nAmount: ${d.currency} ${d.amount}\nEstimated Delivery: ${d.estimatedDelivery}\n\nTrack your order: ${safePortalUrl}`,
      };
    }

    case 'status-update': {
      const d = data as StatusUpdateData;
      const safePortalUrl = validateUrl(d.portalUrl, siteConfig.url);
      return {
        subject: `Order Update - ${escapeHtml(d.orderNumber)}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="header"><h1>${escapeHtml(brandName)}</h1></div>
              <div class="content">
                <h2>Order Status Update</h2>
                <p>Hi ${escapeHtml(d.customerName)},</p>
                <p>Your order <strong>${escapeHtml(d.orderNumber)}</strong> has been updated:</p>
                <div class="highlight">
                  <p><strong>New Status:</strong> ${escapeHtml(d.newStatus)}</p>
                  <p>${escapeHtml(d.statusDescription)}</p>
                </div>
                <p><a href="${safePortalUrl}" class="button">View Order Details</a></p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order ${d.orderNumber} Update\n\nNew Status: ${d.newStatus}\n${d.statusDescription}\n\nView details: ${safePortalUrl}`,
      };
    }

    case 'delivery': {
      const d = data as DeliveryData;
      const safeDownloadUrl = validateUrl(d.downloadUrl, siteConfig.url);
      return {
        subject: `Your Song is Ready! - ${escapeHtml(d.orderNumber)}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="header"><h1>${escapeHtml(brandName)}</h1></div>
              <div class="content">
                <h2>Your Custom Song is Ready!</h2>
                <p>Hi ${escapeHtml(d.customerName)},</p>
                <p>Great news! Your ${escapeHtml(d.packageName)} song has been completed and is ready for download.</p>
                <p><a href="${safeDownloadUrl}" class="button">Download Your Song</a></p>
                <p style="font-size: 14px; color: #666;">This download link expires on ${escapeHtml(d.expiresAt)}.</p>
                <p>We hope you love it! If you have any feedback or questions, we'd love to hear from you.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Your song is ready!\n\nDownload: ${safeDownloadUrl}\nExpires: ${d.expiresAt}`,
      };
    }

    case 'cancellation': {
      const d = data as CancellationData;
      return {
        subject: `Order Cancelled - ${escapeHtml(d.orderNumber)}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="header"><h1>${escapeHtml(brandName)}</h1></div>
              <div class="content">
                <h2>Order Cancelled</h2>
                <p>Hi ${escapeHtml(d.customerName)},</p>
                <p>Your order <strong>${escapeHtml(d.orderNumber)}</strong> has been cancelled.</p>
                ${d.refundAmount ? `<p>A refund of <strong>${escapeHtml(d.refundAmount)}</strong> will be processed within 5-10 business days.</p>` : ''}
                ${d.reason ? `<p>Reason: ${escapeHtml(d.reason)}</p>` : ''}
                <p>If you have any questions, please don't hesitate to reach out.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order ${d.orderNumber} has been cancelled.${d.refundAmount ? ` Refund: ${d.refundAmount}` : ''}`,
      };
    }

    case 'password-reset': {
      const d = data as PasswordResetData;
      const safeResetUrl = validateUrl(d.resetUrl, siteConfig.url);
      return {
        subject: 'Reset Your Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="header"><h1>${escapeHtml(brandName)}</h1></div>
              <div class="content">
                <h2>Reset Your Password</h2>
                <p>You requested to reset your password. Click the button below to create a new password:</p>
                <p><a href="${safeResetUrl}" class="button">Reset Password</a></p>
                <p style="font-size: 14px; color: #666;">This link expires in ${escapeHtml(d.expiresIn)}.</p>
                <p>If you didn't request this, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Reset your password: ${safeResetUrl}\nExpires in ${d.expiresIn}`,
      };
    }

    case 'welcome': {
      const d = data as WelcomeData;
      const safeVerificationUrl = d.verificationUrl ? validateUrl(d.verificationUrl, siteConfig.url) : null;
      return {
        subject: `Welcome to ${escapeHtml(brandName)}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="header"><h1>${escapeHtml(brandName)}</h1></div>
              <div class="content">
                <h2>Welcome, ${escapeHtml(d.customerName)}!</h2>
                <p>Thank you for joining ${escapeHtml(brandName)}. We're excited to help you create personalized songs for life's special moments.</p>
                ${safeVerificationUrl ? `<p><a href="${safeVerificationUrl}" class="button">Verify Your Email</a></p>` : ''}
                <p>Ready to get started? Browse our packages and find the perfect option for your occasion.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Welcome to ${brandName}, ${d.customerName}!${safeVerificationUrl ? `\n\nVerify your email: ${safeVerificationUrl}` : ''}`,
      };
    }

    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

/**
 * Send a templated email
 */
export async function sendTemplatedEmail<T extends EmailTemplate>(
  to: string,
  template: T,
  data: TemplateData[T]
): Promise<SendEmailResult> {
  const { subject, html, text } = renderTemplate(template, data);
  return sendEmail({ to, subject, html, text });
}
