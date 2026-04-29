import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";

export type GmailCreateDraftInput = {
  /** RFC 5322 To — optional for drafts saved without recipients */
  to?: string;
  subject?: string;
  /** Plain text body */
  bodyText?: string;
};

export type GmailCreateDraftData = {
  draftId: string;
  messageId: string;
  threadId?: string;
};

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc2822(input: GmailCreateDraftInput): string {
  const subject = typeof input.subject === "string" ? input.subject.trim() : "(no subject)";
  const body = typeof input.bodyText === "string" ? input.bodyText : "";
  const lines: string[] = [];
  if (typeof input.to === "string" && input.to.trim()) {
    lines.push(`To: ${input.to.trim()}`);
  }
  lines.push(
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body
  );
  return lines.join("\r\n");
}

/**
 * POST gmail/v1/users/me/drafts — creates a Gmail draft (does not send).
 */
export async function executeGmailCreateDraft(ctx: AgentExecutionContext, input: unknown) {
  const rawInput = (input && typeof input === "object" ? input : {}) as GmailCreateDraftInput;
  const rfc = buildRfc2822(rawInput);
  const raw = toBase64Url(Buffer.from(rfc, "utf8"));

  const json = (await fetchGoogleJson(ctx, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { raw },
    }),
  })) as { id?: string; message?: { id?: string; threadId?: string } };

  const draftId = typeof json.id === "string" ? json.id : "";
  const messageId = typeof json.message?.id === "string" ? json.message.id : "";
  if (!draftId || !messageId) {
    throw new Error("Gmail did not return draft identifiers.");
  }

  const data: GmailCreateDraftData = {
    draftId,
    messageId,
    threadId: typeof json.message?.threadId === "string" ? json.message.threadId : undefined,
  };
  return agentActionSuccess("gmail.createDraft", ctx.agentId, data);
}
