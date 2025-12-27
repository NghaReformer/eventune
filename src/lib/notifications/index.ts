/**
 * Notification Service
 * Centralized service for sending email and SMS notifications
 */

import { sendEmail, sendTemplatedEmail, type SendEmailOptions } from '../email/client';
import { sendSMS, sendTemplatedSMS, type SendSMSOptions } from '../sms/client';
import { siteConfig } from '@/config';

/**
 * Send notification via email and optionally SMS
 */
export interface NotificationOptions {
  // Email is always sent
  email: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    tags?: { name: string; value: string }[];
  };
  // SMS is optional and only sent if enabled and phone provided
  sms?: {
    to: string; // E.164 format phone number
    body: string;
  };
}

/**
 * Result of sending notifications
 */
export interface NotificationResult {
  email: {
    success: boolean;
    error?: string;
  };
  sms?: {
    success: boolean;
    error?: string;
  };
}

/**
 * Send multi-channel notification (email + optional SMS)
 */
export async function sendNotification(
  options: NotificationOptions
): Promise<NotificationResult> {
  const result: NotificationResult = {
    email: { success: false },
  };

  // Always send email
  try {
    const emailResult = await sendEmail(options.email);
    result.email = emailResult;
  } catch (error) {
    console.error('[NOTIFICATION] Email failed:', error);
    result.email = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Send SMS if enabled and phone provided
  if (options.sms && siteConfig.features.enableSMS) {
    try {
      const smsResult = await sendSMS(options.sms);
      result.sms = smsResult;
    } catch (error) {
      console.error('[NOTIFICATION] SMS failed:', error);
      result.sms = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  return result;
}

/**
 * Example: Send order confirmation notification
 */
export async function sendOrderConfirmation(params: {
  email: string;
  phone?: string;
  customerName: string;
  orderNumber: string;
  packageName: string;
  amount: string;
  currency: string;
  occasionName: string;
  estimatedDelivery: string;
  portalUrl: string;
}): Promise<NotificationResult> {
  const notification: NotificationOptions = {
    email: {
      to: params.email,
      subject: `Order Confirmed - ${params.orderNumber}`,
      html: `
        <h2>Thank You for Your Order!</h2>
        <p>Hi ${params.customerName},</p>
        <p>We've received your order and are excited to create your custom song!</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order Number:</strong> ${params.orderNumber}</p>
          <p><strong>Package:</strong> ${params.packageName}</p>
          <p><strong>Occasion:</strong> ${params.occasionName}</p>
          <p><strong>Amount Paid:</strong> ${params.currency} ${params.amount}</p>
          <p><strong>Estimated Delivery:</strong> ${params.estimatedDelivery}</p>
        </div>
        <p><a href="${params.portalUrl}" style="background: #D4AF37; color: #0A0A0A; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Order Status</a></p>
      `,
      text: `Thank you for your order ${params.orderNumber}!\n\nPackage: ${params.packageName}\nOccasion: ${params.occasionName}\nAmount: ${params.currency} ${params.amount}\nEstimated Delivery: ${params.estimatedDelivery}\n\nTrack your order: ${params.portalUrl}`,
      tags: [
        { name: 'type', value: 'order-confirmation' },
        { name: 'order', value: params.orderNumber },
      ],
    },
  };

  // Add SMS if phone provided
  if (params.phone) {
    notification.sms = {
      to: params.phone,
      body: `Hi ${params.customerName}! Your order ${params.orderNumber} (${params.packageName}) has been confirmed. Estimated delivery: ${params.estimatedDelivery}. Track at eventunestudios.com/dashboard - Eventune Studios`,
    };
  }

  return sendNotification(notification);
}

/**
 * Example: Send status update notification
 */
export async function sendStatusUpdate(params: {
  email: string;
  phone?: string;
  customerName: string;
  orderNumber: string;
  newStatus: string;
  statusDescription: string;
  portalUrl: string;
}): Promise<NotificationResult> {
  const notification: NotificationOptions = {
    email: {
      to: params.email,
      subject: `Order Update - ${params.orderNumber}`,
      html: `
        <h2>Order Status Update</h2>
        <p>Hi ${params.customerName},</p>
        <p>Your order <strong>${params.orderNumber}</strong> has been updated:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>New Status:</strong> ${params.newStatus}</p>
          <p>${params.statusDescription}</p>
        </div>
        <p><a href="${params.portalUrl}" style="background: #D4AF37; color: #0A0A0A; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Order Details</a></p>
      `,
      text: `Order ${params.orderNumber} Update\n\nNew Status: ${params.newStatus}\n${params.statusDescription}\n\nView details: ${params.portalUrl}`,
      tags: [
        { name: 'type', value: 'status-update' },
        { name: 'order', value: params.orderNumber },
      ],
    },
  };

  // Add SMS if phone provided
  if (params.phone) {
    notification.sms = {
      to: params.phone,
      body: `Eventune Studios: Your order ${params.orderNumber} is now ${params.newStatus}. Check your dashboard for details.`,
    };
  }

  return sendNotification(notification);
}
