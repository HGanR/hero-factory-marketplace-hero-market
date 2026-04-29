import { sql } from "drizzle-orm";
import { EmailNotificationService } from "@/services/email-notification-service";

export type SendEmailStepConfig = {
  subject?: string;
  subjectTemplate?: string;
  body?: string;
  bodyTemplate?: string;
  to?: string;
  /** Override from address for TENANT mode */
  fromEmail?: string;
  fromName?: string;
};

function renderTemplate(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path) => {
    const parts = String(path).split(".");
    let cur: unknown = ctx;
    for (const p of parts) cur = (cur as Record<string, unknown>)?.[p];
    return cur == null ? "" : String(cur);
  });
}

export async function executeSendEmailStep(args: {
  db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
  userId: number;
  contactId?: string | null;
  payload?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  stepConfig: SendEmailStepConfig;
}): Promise<{ success: boolean; error?: string }> {
  const { db, userId, contactId, contact, stepConfig, payload } = args;

  const ctx: Record<string, unknown> = {
    payload: payload ?? {},
    contact: contact ?? {},
  };

  const subject =
    stepConfig.subjectTemplate
      ? renderTemplate(stepConfig.subjectTemplate, ctx)
      : stepConfig.subject ?? "Message";

  const body =
    stepConfig.bodyTemplate
      ? renderTemplate(stepConfig.bodyTemplate, ctx)
      : stepConfig.body ?? "";

  let to = stepConfig.to;
  if (!to && contact?.email) to = String(contact.email);
  if (!to && contactId) {
    const [cRow] = (await db.execute(sql`
      SELECT email FROM crm_contacts WHERE id = ${contactId} LIMIT 1
    `)) as any;
    const c = Array.isArray(cRow) ? cRow[0] : cRow?.rows?.[0] ?? cRow;
    if (c?.email) to = String(c.email);
  }

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { success: false, error: "No valid recipient email (contact.email or config.to)" };
  }

  const emailSvc = new EmailNotificationService(
    (process.env.EMAIL_PROVIDER as "sendgrid" | "nodemailer" | "aws-ses") ?? "aws-ses"
  );

  const mode = stepConfig.fromEmail || stepConfig.fromName ? "TENANT" : "SYSTEM";
  const result = await emailSvc.send({
    to,
    subject: subject.trim().slice(0, 255),
    body: body.trim() || "<p>No content.</p>",
    mode,
    fromEmail: stepConfig.fromEmail,
    fromName: stepConfig.fromName,
    userId: String(userId),
    metadata: { contactId, source: "automation" },
  });

  return result.success ? { success: true } : { success: false, error: result.error };
}
