/**
 * Registration notification service: sends info to new signups via email (SES) and SMS (SNS).
 * Uses existing AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).
 * For SMS, ensure AWS SNS is configured and the number is in E.164 format.
 */

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const APP_NAME = process.env.APP_NAME || "Hero Market";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+1${digits}`;
}

/**
 * Send registration confirmation SMS via AWS SNS.
 * Fails gracefully if SNS credentials are missing.
 */
export async function sendRegistrationSms(phone: string, username: string): Promise<void> {
  try {
    const region = process.env.AWS_REGION || "us-east-1";
    const hasCreds =
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY;

    if (!hasCreds) {
      console.warn("[RegistrationSMS] AWS credentials not set; skipping SMS");
      return;
    }

    const client = new SNSClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const body = `Welcome to ${APP_NAME}! Hi ${username}, your account is pending approval. We'll notify you when ready. Questions? Reply to this number.`;
    const e164 = normalizePhone(phone);

    await client.send(
      new PublishCommand({
        PhoneNumber: e164,
        Message: body,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      })
    );
  } catch (err) {
    console.error("[RegistrationSMS] SNS send failed:", err);
    throw err;
  }
}
