# SMS Notifications

This directory contains the SMS notification system using Twilio.

## Setup

1. **Get Twilio Credentials**
   - Sign up at https://console.twilio.com/
   - Get your Account SID and Auth Token
   - Purchase a phone number from Twilio

2. **Configure Environment Variables**
   ```bash
   # In your .env file
   PUBLIC_SMS_ENABLED=true
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_FROM_NUMBER=+1234567890  # Your Twilio number in E.164 format
   ```

3. **Install Dependencies**
   ```bash
   npm install twilio
   ```

## Usage

### Basic SMS
```typescript
import { sendSMS } from '@/lib/sms';

const result = await sendSMS({
  to: '+237XXXXXXXXX',  // E.164 format required
  body: 'Your custom message here',
});

if (result.success) {
  console.log('SMS sent:', result.messageId);
} else {
  console.error('SMS failed:', result.error);
}
```

### Templated SMS
```typescript
import { sendTemplatedSMS } from '@/lib/sms';

const result = await sendTemplatedSMS(
  '+237XXXXXXXXX',
  'order-confirmation',
  {
    customerName: 'John Doe',
    orderNumber: 'EVT-12345',
    packageName: 'Classic',
    estimatedDelivery: '7-10 days',
  }
);
```

### Multi-Channel Notifications
```typescript
import { sendNotification } from '@/lib/notifications';

const result = await sendNotification({
  email: {
    to: 'customer@example.com',
    subject: 'Order Confirmed',
    html: '<p>Your order has been confirmed!</p>',
  },
  sms: {
    to: '+237XXXXXXXXX',
    body: 'Your order has been confirmed!',
  },
});

// Both email and SMS will be sent
console.log('Email:', result.email.success);
console.log('SMS:', result.sms?.success);
```

## Phone Number Format

All phone numbers must be in E.164 format:
- **Cameroon**: +237XXXXXXXXX (9 digits after country code)
- **USA**: +1XXXXXXXXXX (10 digits after country code)
- **Format**: +[country code][number without leading zero]

## Features

- **Automatic fallback**: If SMS is disabled or fails, it won't break the application
- **Template system**: Pre-defined templates for common notifications
- **Multi-channel**: Integrated with email for unified notification system
- **Cost-aware**: SMS only sent when explicitly enabled

## Templates Available

1. **order-confirmation**: New order confirmation
2. **status-update**: Order status changes
3. **delivery-ready**: Song ready for download
4. **revision-requested**: Revision request acknowledgment
5. **payment-reminder**: Payment reminders

## Testing

Use Twilio's test credentials for development:
- Test Account SID: Available in Twilio console
- Test numbers: Use verified phone numbers

## Cost Considerations

- SMS costs vary by country (typically $0.01-0.10 per message)
- Monitor usage in Twilio console
- Consider limiting SMS to critical notifications only
- Enable SMS selectively via PUBLIC_SMS_ENABLED flag

## Troubleshooting

### SMS not sending
1. Check PUBLIC_SMS_ENABLED is set to 'true'
2. Verify Twilio credentials are correct
3. Ensure phone numbers are in E.164 format
4. Check Twilio account balance

### Invalid phone number
- Ensure number starts with '+'
- Include country code
- No spaces or special characters
- Example: +237670123456 (Cameroon)

### Service not configured
- The service gracefully degrades if not configured
- Check environment variables are set
- Restart the application after adding credentials
