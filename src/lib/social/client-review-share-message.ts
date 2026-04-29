/**
 * Plain-text message for sharing a client review link (email/Slack paste).
 */
export function buildClientReviewShareMessage(args: {
  reviewUrl: string;
  expiresAt: string | null;
  label?: string | null;
}): string {
  const head = args.label?.trim()
    ? `Review (${args.label.trim()})`
    : "Please review our scheduled social post(s) using the link below.";
  const exp = args.expiresAt
    ? `This link expires: ${new Date(args.expiresAt).toLocaleString()}.`
    : "This link does not expire automatically.";
  return `${head}\n\n${args.reviewUrl}\n\n${exp}\n\nOpen the page to approve or reject posts pending your role.`;
}

/** Default transactional subject for operator-sent client review emails. */
export function buildClientReviewShareEmailSubject(args: { label?: string | null; campaignName?: string | null }): string {
  const label = args.label?.trim();
  const camp = args.campaignName?.trim();
  if (label && camp) return `Action needed: review scheduled posts — ${label} (${camp})`;
  if (label) return `Action needed: review scheduled posts — ${label}`;
  if (camp) return `Action needed: review scheduled posts — ${camp}`;
  return "Action needed: review scheduled social posts";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrap plain text as a single HTML block for EmailNotificationService (SES HTML body). */
export function plainTextShareMessageToEmailHtml(plain: string): string {
  return `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(plain).replace(/\n/g, "<br/>")}</div>`;
}

function emailBrandName(): string {
  const pub = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_NAME?.trim() : "";
  const from = typeof process !== "undefined" ? process.env.EMAIL_FROM_NAME?.trim() : "";
  return pub || from || "Hero Market";
}

/**
 * Branded HTML for operator-sent client review emails. Content is anchored to `plainBody`
 * (same string as transactional plain text); layout adds header, CTA, and structured context.
 */
export function buildClientReviewShareEmailHtml(args: {
  plainBody: string;
  reviewUrl: string;
  expiresAt: string | null;
  label?: string | null;
  campaignName?: string | null;
}): string {
  const brand = emailBrandName();
  const accent = "#06b6d4";
  const bg = "#0f172a";
  const card = "#1e293b";
  const text = "#f1f5f9";
  const muted = "#94a3b8";
  const safeUrl = escapeHtml(args.reviewUrl);
  const expLine = args.expiresAt
    ? `This link expires ${escapeHtml(new Date(args.expiresAt).toLocaleString())}.`
    : "This link does not expire automatically.";
  const labelLine = args.label?.trim();
  const campLine = args.campaignName?.trim();
  const ctxBits = [campLine, labelLine].filter(Boolean);
  const ctxHtml = ctxBits.length
    ? `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.45;color:${muted};">${escapeHtml(ctxBits.join(" · "))}</p>`
    : "";

  const plainHtml = escapeHtml(args.plainBody).replace(/\n/g, "<br/>");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${card};border-radius:8px;overflow:hidden;border:1px solid #334155;">
<tr><td style="padding:18px 20px;background:linear-gradient(90deg,${accent}33,transparent);border-bottom:1px solid #334155;">
<p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${accent};font-family:system-ui,Segoe UI,sans-serif;">${escapeHtml(brand)}</p>
<p style="margin:6px 0 0 0;font-size:18px;font-weight:600;color:${text};font-family:system-ui,Segoe UI,sans-serif;">Review scheduled posts</p>
</td></tr>
<tr><td style="padding:20px;font-family:system-ui,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:${text};">
<p style="margin:0 0 12px 0;">You have a secure link to review and approve or reject posts pending your role.</p>
${ctxHtml}
<p style="margin:0 0 8px 0;font-size:13px;color:${muted};">${expLine}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0;">
<tr><td style="border-radius:6px;background:${accent};">
<a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#0f172a;text-decoration:none;font-family:system-ui,Segoe UI,sans-serif;">Open review page</a>
</td></tr>
</table>
<p style="margin:0 0 6px 0;font-size:12px;color:${muted};">If the button does not work, copy this URL:</p>
<p style="margin:0 0 20px 0;font-size:12px;word-break:break-all;color:${accent};"><a href="${safeUrl}" style="color:${accent};">${safeUrl}</a></p>
<hr style="border:none;border-top:1px solid #334155;margin:16px 0;"/>
<p style="margin:0 0 8px 0;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.06em;">Message (plain text)</p>
<div style="font-size:14px;line-height:1.5;color:${text};">${plainHtml}</div>
</td></tr>
</table>
<p style="margin:16px 0 0 0;font-size:11px;color:#64748b;font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">This email was sent by your team from ${escapeHtml(brand)}.</p>
</td></tr></table></body></html>`;
}

/** Optional greeting line prepended to the share body. */
export function prependRecipientGreeting(plain: string, recipientName: string | null | undefined): string {
  const n = recipientName?.trim();
  if (!n) return plain;
  return `Hi ${n},\n\n${plain}`;
}
