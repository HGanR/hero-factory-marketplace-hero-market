import { buildMaaniaMailtoUrl, openMaaniaMailtoUrl } from "@/lib/maania/maania-mailto";
import { createMaaniaShare, type CreateMaaniaShareInput } from "@/lib/maania/share-demo";

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendMaaniaDemoToClientResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "invalid_email" | "share_failed"; error?: string };

/**
 * Prompts for client email, ensures a persisted share link exists, then opens the default mail client (manual send only).
 */
export async function sendMaaniaDemoToClientViaMailto(args: {
  shareInput: CreateMaaniaShareInput;
  agentName?: string;
  /** Override for tests; defaults to `window.prompt`. */
  promptForEmail?: (message: string) => string | null;
}): Promise<SendMaaniaDemoToClientResult> {
  const promptFn = args.promptForEmail ?? ((message: string) => (typeof window !== "undefined" ? window.prompt(message) : null));

  const raw = promptFn("Client email address");
  if (raw == null) return { ok: false, reason: "cancelled" };
  const recipientEmail = String(raw).trim();
  if (!recipientEmail) return { ok: false, reason: "cancelled" };
  if (!SIMPLE_EMAIL.test(recipientEmail)) {
    if (typeof window !== "undefined") {
      window.alert("Please enter a valid email address.");
    }
    return { ok: false, reason: "invalid_email" };
  }

  const share = await createMaaniaShare(args.shareInput);
  if (!share.ok) {
    if (typeof window !== "undefined") {
      window.alert(share.error || "Could not create share link.");
    }
    return { ok: false, reason: "share_failed", error: share.error };
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}${share.path}` : share.path;

  const mailto = buildMaaniaMailtoUrl({
    recipientEmail,
    shareUrl,
    agentName: args.agentName,
  });
  openMaaniaMailtoUrl(mailto);
  return { ok: true };
}
