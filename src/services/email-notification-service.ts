// Lightweight email notification service with provider stubs and DB tracking.
// Providers are optional; if credentials are missing we log and mark as failed gracefully.

import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { emailNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type EmailProvider = "sendgrid" | "nodemailer" | "aws-ses";

export enum EmailNotificationType {
  REGISTRATION_CONFIRMATION = "REGISTRATION_CONFIRMATION",
  WELCOME_APPROVED = "WELCOME_APPROVED",
  REGISTRATION_REJECTED = "REGISTRATION_REJECTED",
  PASSWORD_RESET = "PASSWORD_RESET",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  ACCOUNT_REACTIVATED = "ACCOUNT_REACTIVATED",
  LOGIN_NOTIFICATION = "LOGIN_NOTIFICATION",
  SECURITY_ALERT = "SECURITY_ALERT",
  COMPLIANCE_REMINDER = "COMPLIANCE_REMINDER",
}

type SendResult = { success: true } | { success: false; error: string };

export class EmailNotificationService {
  private provider: EmailProvider;
  private fromEmail: string;
  private fromName: string;
  private appUrl: string;
  private sendgridClient?: any;
  private nodemailerTransporter?: any;
  private awsClient?: any;

  constructor(provider: EmailProvider = "nodemailer") {
    this.provider = provider;
    this.fromEmail = process.env.EMAIL_FROM_ADDRESS || "noreply@troothurtz.com";
    this.fromName = process.env.EMAIL_FROM_NAME || "TroothHurtz";
    this.appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://troothurtz.com";
    this.initializeProvider();
  }

  private initializeProvider() {
    try {
      if (this.provider === "sendgrid") {
        const sgMail = require("@sendgrid/mail");
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.sendgridClient = sgMail;
      } else if (this.provider === "nodemailer") {
        const nodemailer = require("nodemailer");
        this.nodemailerTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
      } else if (this.provider === "aws-ses") {
        const AWS = require("aws-sdk");
        this.awsClient = new AWS.SES({
          region: process.env.AWS_REGION || "us-east-1",
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
      }
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
      console.warn("Email provider init failed (will fallback to log-only):", msg);
      this.sendgridClient = null;
      this.nodemailerTransporter = null;
      this.awsClient = null;
    }
  }

  async sendRegistrationConfirmationEmail(email: string, firstName: string, registrationId: string) {
    const subject = "Registration Confirmation - TroothHurtz";
    const body = this.renderRegistrationConfirmationTemplate(firstName, registrationId);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.REGISTRATION_CONFIRMATION,
      registrationId,
    });
  }

  async sendWelcomeApprovedEmail(
    email: string,
    firstName: string,
    lastName: string,
    temporaryPassword: string,
    resetToken: string,
    userId: string
  ) {
    const resetLink = `${this.appUrl}/auth/reset-password?token=${resetToken}`;
    const subject = "Welcome to TroothHurtz - Your Account is Ready!";
    const body = this.renderWelcomeApprovedTemplate(firstName, lastName, email, temporaryPassword, resetLink);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.WELCOME_APPROVED,
      userId,
    });
  }

  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string, userId: string) {
    const resetLink = `${this.appUrl}/auth/reset-password?token=${resetToken}`;
    const subject = "Reset Your TroothHurtz Password";
    const body = this.renderPasswordResetTemplate(firstName, resetLink);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.PASSWORD_RESET,
      userId,
    });
  }

  async sendSecurityAlertEmail(
    email: string,
    firstName: string,
    alertType: string,
    details: Record<string, any>,
    userId: string
  ) {
    const subject = "Security Alert - TroothHurtz Account Activity";
    const body = this.renderSecurityAlertTemplate(firstName, alertType, details);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.SECURITY_ALERT,
      userId,
    });
  }

  async sendComplianceReminderEmail(email: string, firstName: string, complianceItems: string[], userId: string) {
    const subject = "Compliance Reminder - TroothHurtz";
    const body = this.renderComplianceReminderTemplate(firstName, complianceItems);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.COMPLIANCE_REMINDER,
      userId,
    });
  }

  async sendRejectionEmail(
    email: string,
    firstName: string,
    lastName: string,
    rejectionReason: string,
    notes?: string | null
  ) {
    const subject = "Registration Update - TroothHurtz";
    const body = this.renderRejectionTemplate(firstName, lastName, rejectionReason, notes || "");
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.REGISTRATION_REJECTED,
    });
  }

  async sendAccountSuspendedEmail(email: string, firstName: string, lastName: string, reason: string, userId?: string) {
    const subject = "Your TroothHurtz Account Has Been Suspended";
    const body = this.renderAccountSuspendedTemplate(firstName, lastName, reason);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.ACCOUNT_SUSPENDED,
      userId,
    });
  }

  async sendAccountReactivatedEmail(email: string, firstName: string, lastName: string, userId?: string) {
    const subject = "Your TroothHurtz Account Has Been Reactivated";
    const body = this.renderAccountReactivatedTemplate(firstName, lastName);
    return this.sendTracked({
      recipientEmail: email,
      recipientName: firstName,
      subject,
      body,
      emailType: EmailNotificationType.ACCOUNT_REACTIVATED,
      userId,
    });
  }

  // Core send + DB tracking
  private async sendTracked(data: {
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    body: string;
    emailType: EmailNotificationType;
    userId?: string;
    registrationId?: string;
  }) {
    const db = await getDb();
    const notificationId = uuidv4();

    await db.insert(emailNotifications).values({
      id: notificationId,
      userId: data.userId ? Number(data.userId) || undefined : undefined,
      registrationId: data.registrationId,
      recipientEmail: data.recipientEmail,
      emailType: data.emailType,
      subject: data.subject,
      body: data.body,
      status: "PENDING",
    });

    const sendResult = await this.sendEmail(data);

    if (sendResult.success) {
      await db
        .update(emailNotifications)
        .set({ status: "SENT", sentAt: new Date() })
        .where(eq(emailNotifications.id, notificationId));
      return { success: true };
    } else {
      await db
        .update(emailNotifications)
        .set({ status: "FAILED", failureReason: sendResult.error })
        .where(eq(emailNotifications.id, notificationId));
      return { success: false, error: sendResult.error };
    }
  }

  private async sendEmail(data: { recipientEmail: string; subject: string; body: string }) {
    if (this.provider === "sendgrid" && this.sendgridClient) {
      return this.sendViaSendGrid(data);
    }
    if (this.provider === "nodemailer" && this.nodemailerTransporter) {
      return this.sendViaNodemailer(data);
    }
    if (this.provider === "aws-ses" && this.awsClient) {
      return this.sendViaAwsSES(data);
    }
    // Fallback: log-only
    console.warn("Email provider not configured; logging email only.", data);
    return { success: false, error: "Email provider not configured" } as SendResult;
  }

  private async sendViaSendGrid(data: { recipientEmail: string; subject: string; body: string }): Promise<SendResult> {
    try {
      await this.sendgridClient.send({
        to: data.recipientEmail,
        from: { email: this.fromEmail, name: this.fromName },
        subject: data.subject,
        html: data.body,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "SendGrid send failed" };
    }
  }

  private async sendViaNodemailer(data: { recipientEmail: string; subject: string; body: string }): Promise<SendResult> {
    try {
      await this.nodemailerTransporter.sendMail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.recipientEmail,
        subject: data.subject,
        html: data.body,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Nodemailer send failed" };
    }
  }

  private async sendViaAwsSES(data: { recipientEmail: string; subject: string; body: string }): Promise<SendResult> {
    try {
      await this.awsClient
        .sendEmail({
          Source: `${this.fromName} <${this.fromEmail}>`,
          Destination: { ToAddresses: [data.recipientEmail] },
          Message: {
            Subject: { Data: data.subject, Charset: "UTF-8" },
            Body: { Html: { Data: data.body, Charset: "UTF-8" } },
          },
        })
        .promise();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "AWS SES send failed" };
    }
  }

  // Templates (condensed from reference)
  private renderRegistrationConfirmationTemplate(firstName: string, registrationId: string) {
    return `<p>Hello ${firstName},</p><p>Registration received. Your ID: <b>${registrationId}</b>.</p>`;
  }

  private renderWelcomeApprovedTemplate(
    firstName: string,
    lastName: string,
    email: string,
    temporaryPassword: string,
    resetLink: string
  ) {
    return `<p>Hello ${firstName} ${lastName},</p><p>Your account is approved.</p><p>Email: <b>${email}</b><br/>Temp password: <b>${temporaryPassword}</b></p><p>Reset: <a href="${resetLink}">${resetLink}</a></p>`;
  }

  private renderPasswordResetTemplate(firstName: string, resetLink: string) {
    return `<p>Hello ${firstName},</p><p>Reset your password: <a href="${resetLink}">${resetLink}</a></p>`;
  }

  private renderSecurityAlertTemplate(firstName: string, alertType: string, details: Record<string, any>) {
    const detailStr = Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join("<br/>");
    return `<p>Hello ${firstName},</p><p>Security alert: <b>${alertType}</b></p><p>${detailStr}</p>`;
  }

  private renderComplianceReminderTemplate(firstName: string, complianceItems: string[]) {
    return `<p>Hello ${firstName},</p><p>Compliance items:</p><ul>${complianceItems
      .map((i) => `<li>${i}</li>`)
      .join("")}</ul>`;
  }

  private renderRejectionTemplate(firstName: string, lastName: string, reason: string, notes: string) {
    return `<p>Hello ${firstName} ${lastName},</p><p>Your registration was not approved.</p><p>Reason: <b>${reason}</b></p>${
      notes ? `<p>Notes: ${notes}</p>` : ""
    }`;
  }

  private renderAccountSuspendedTemplate(firstName: string, lastName: string, reason: string) {
    return `<p>Hello ${firstName} ${lastName},</p><p>Your account has been suspended.</p><p>Reason: <b>${reason}</b></p>`;
  }

  private renderAccountReactivatedTemplate(firstName: string, lastName: string) {
    return `<p>Hello ${firstName} ${lastName},</p><p>Your account has been reactivated. You can log back in now.</p>`;
  }
}

export default EmailNotificationService;

