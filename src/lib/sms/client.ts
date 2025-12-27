/**
 * SMS Service using Twilio
 * Handles transactional SMS notifications
 */

import type { Twilio } from 'twilio';

// Lazy initialization
let twilioClient: Twilio | null = null;

/**
 * Get Twilio client (lazy init)
 */
function getClient(): Twilio | null {
  // Check if SMS is enabled
  const smsEnabled = import.meta.env.PUBLIC_SMS_ENABLED === 'true';
  if (!smsEnabled) {
    console.log('[SMS] SMS notifications disabled in config');
    return null;
  }

  if (!twilioClient) {
    const accountSid = import.meta.env.TWILIO_ACCOUNT_SID;
    const authToken = import.meta.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('[SMS] Twilio credentials not configured. SMS notifications disabled.');
      return null;
    }

    try {
      // Dynamic import to avoid errors when package isn't installed
      const twilio = require('twilio');
      twilioClient = twilio(accountSid, authToken);
    } catch (error) {
      console.error('[SMS] Failed to initialize Twilio client:', error);
      return null;
    }
  }

  return twilioClient;
}

/**
 * SMS send options
 */
export interface SendSMSOptions {
  to: string;
  body: string;
  from?: string;
}

/**
 * SMS send result
 */
export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Validate phone number format (basic validation)
 * @param phone - Phone number to validate
 * @returns boolean indicating if valid
 */
function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 format validation: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Send an SMS
 * @param options - SMS options
 * @returns Promise with send result
 */
export async function sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
  const client = getClient();

  // If SMS is disabled or client failed to initialize, return early
  if (!client) {
    return {
      success: false,
      error: 'SMS service not configured',
    };
  }

  // Validate phone number
  if (!isValidPhoneNumber(options.to)) {
    return {
      success: false,
      error: 'Invalid phone number format. Must be in E.164 format (e.g., +237XXXXXXXXX)',
    };
  }

  // Get from number from env or use provided
  const fromNumber = options.from || import.meta.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    return {
      success: false,
      error: 'Twilio from number not configured',
    };
  }

  try {
    const message = await client.messages.create({
      body: options.body,
      from: fromNumber,
      to: options.to,
    });

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error: any) {
    console.error('[SMS] Failed to send SMS:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send SMS',
    };
  }
}

/**
 * SMS template types
 */
export type SMSTemplate =
  | 'order-confirmation'
  | 'status-update'
  | 'delivery-ready'
  | 'revision-requested'
  | 'payment-reminder';

/**
 * Template data types
 */
export interface OrderConfirmationSMSData {
  customerName: string;
  orderNumber: string;
  packageName: string;
  estimatedDelivery: string;
}

export interface StatusUpdateSMSData {
  customerName: string;
  orderNumber: string;
  newStatus: string;
}

export interface DeliveryReadySMSData {
  customerName: string;
  orderNumber: string;
  downloadUrl: string;
}

export interface RevisionRequestedSMSData {
  orderNumber: string;
}

export interface PaymentReminderSMSData {
  customerName: string;
  orderNumber: string;
  amount: string;
}

export type TemplateSMSData = {
  'order-confirmation': OrderConfirmationSMSData;
  'status-update': StatusUpdateSMSData;
  'delivery-ready': DeliveryReadySMSData;
  'revision-requested': RevisionRequestedSMSData;
  'payment-reminder': PaymentReminderSMSData;
};

/**
 * Generate SMS body from template
 */
export function renderSMSTemplate<T extends SMSTemplate>(
  template: T,
  data: TemplateSMSData[T]
): string {
  const brandName = 'Eventune Studios';

  switch (template) {
    case 'order-confirmation': {
      const d = data as OrderConfirmationSMSData;
      return `Hi ${d.customerName}! Your order ${d.orderNumber} (${d.packageName}) has been confirmed. Estimated delivery: ${d.estimatedDelivery}. Track at eventunestudios.com/dashboard - ${brandName}`;
    }

    case 'status-update': {
      const d = data as StatusUpdateSMSData;
      return `${brandName}: Your order ${d.orderNumber} is now ${d.newStatus}. Check your dashboard for details.`;
    }

    case 'delivery-ready': {
      const d = data as DeliveryReadySMSData;
      return `${brandName}: Great news ${d.customerName}! Your song ${d.orderNumber} is ready for download: ${d.downloadUrl}`;
    }

    case 'revision-requested': {
      const d = data as RevisionRequestedSMSData;
      return `${brandName}: We've received your revision request for ${d.orderNumber}. Our team will review it within 24-48 hours.`;
    }

    case 'payment-reminder': {
      const d = data as PaymentReminderSMSData;
      return `Hi ${d.customerName}, friendly reminder: Order ${d.orderNumber} (${d.amount}) is awaiting payment. Complete at eventunestudios.com/dashboard - ${brandName}`;
    }

    default:
      throw new Error(`Unknown SMS template: ${template}`);
  }
}

/**
 * Send a templated SMS
 */
export async function sendTemplatedSMS<T extends SMSTemplate>(
  to: string,
  template: T,
  data: TemplateSMSData[T]
): Promise<SendSMSResult> {
  const body = renderSMSTemplate(template, data);
  return sendSMS({ to, body });
}
