/** Default subject for MAANIA “send to client” mailto drafts. */
export const MAANIA_DEFAULT_DEMO_MAIL_SUBJECT = "Your personalized real estate demo is ready";

export function buildMaaniaDemoMailBody(shareUrl: string, agentName?: string): string {
  const closing = agentName?.trim() || "Your Realtor";
  return [
    "Hi,",
    "",
    "I put together a personalized demo based on the information we discussed.",
    "",
    `You can view it here:\n${shareUrl}`,
    "",
    "Take a look and let me know what stands out and what you'd like to refine next.",
    "",
    "Best,",
    closing,
  ].join("\n");
}

export type BuildMaaniaMailtoUrlArgs = {
  recipientEmail: string;
  shareUrl: string;
  agentName?: string;
  subject?: string;
  body?: string;
};

/**
 * Builds a mailto URL with URL-encoded query parameters.
 * The recipient is percent-encoded for safety (handles `+`, spaces in display names when you extend later).
 */
export function buildMaaniaMailtoUrl(args: BuildMaaniaMailtoUrlArgs): string {
  const to = args.recipientEmail.trim();
  const subject = args.subject ?? MAANIA_DEFAULT_DEMO_MAIL_SUBJECT;
  const body = args.body ?? buildMaaniaDemoMailBody(args.shareUrl, args.agentName);
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openMaaniaMailtoUrl(url: string): void {
  if (typeof window === "undefined") return;
  window.location.href = url;
}
