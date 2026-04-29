# Email Notification Service - Complete Setup Guide

This project includes a configurable email notification service that supports SendGrid, Nodemailer (SMTP), and AWS SES, along with DB tracking of outbound notifications.

## Features
- Registration Confirmation
- Welcome/Approval (temp password)
- Password Reset
- Account Suspended / Reactivated
- Security Alert
- Compliance Reminder
- Login Notification (extendable)
- DB tracking with status + timestamps; resend failed; history queries

## Files
- `src/services/email-notification-service.ts`
- `src/lib/db/schema.ts` — adds `email_notifications` table definition

## Environment Variables
Set in Vercel (Production) or `.env.local`:
- Common: `EMAIL_PROVIDER` (`sendgrid` | `nodemailer` | `aws-ses`), `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `APP_URL`
- SendGrid: `SENDGRID_API_KEY`
- Nodemailer/SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true`/`false`), `SMTP_USER`, `SMTP_PASSWORD`
- AWS SES: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## Usage
```ts
import { EmailNotificationService } from "@/services/email-notification-service";

const emailSvc = new EmailNotificationService(); // defaults to nodemailer
await emailSvc.sendRegistrationConfirmationEmail("user@example.com", "John", "REG-12345");
await emailSvc.sendWelcomeApprovedEmail("user@example.com", "John", "Doe", "Temp123!", "reset-token", "user-id");
await emailSvc.sendPasswordResetEmail("user@example.com", "John", "reset-token", "user-id");
await emailSvc.sendSecurityAlertEmail("user@example.com", "John", "FAILED_LOGIN_ATTEMPTS", { attempts: 3 }, "user-id");
await emailSvc.sendComplianceReminderEmail("user@example.com", "John", ["Update license"], "user-id");
```

## Database Tracking
- Table: `email_notifications`
- Fields: `id`, `userId`, `registrationId`, `recipientEmail`, `emailType`, `subject`, `body`, `status (PENDING|SENT|FAILED|BOUNCED)`, `failureReason`, `sentAt`, `openedAt`, `clickedAt`, `metadata`, timestamps
- Status is updated automatically after send attempt.

## Provider Notes
- If provider creds are missing, service logs and returns failure but still records the attempt.
- Add the provider packages if needed:
  - `@sendgrid/mail`
  - `nodemailer` (+ types)
  - `aws-sdk`

## Production Checklist
- Set env vars above (Production scope in Vercel).
- Choose provider and ensure sender is verified (SPF/DKIM for best deliverability).
- Test a send in production (e.g., registration confirmation).
- Monitor `email_notifications` for status/health.











