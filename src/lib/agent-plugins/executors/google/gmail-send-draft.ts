import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";
import { AgentToolValidationError } from "@/lib/agent-plugins/agent-tool-validation-error";

export type GmailSendDraftInput = {
  draftId?: string;
};

export type GmailSendDraftData = {
  /** Echo of the draft that was sent — for audits / tracing. */
  draftId: string;
  messageId: string;
  threadId?: string;
  labelIds?: string[];
};

/**
 * POST gmail/v1/users/me/drafts/send — sends an existing draft (irreversible).
 */
export async function executeGmailSendDraft(ctx: AgentExecutionContext, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as GmailSendDraftInput;
  const draftId = typeof body.draftId === "string" ? body.draftId.trim() : "";
  if (!draftId) {
    throw new AgentToolValidationError("draftId is required (from gmail.listMessages or createDraft).", "GMAIL_VALIDATION");
  }

  const json = (await fetchGoogleJson(ctx, "https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: draftId }),
  })) as {
    id?: string;
    threadId?: string;
    labelIds?: string[];
  };

  const messageId = typeof json.id === "string" ? json.id : "";
  if (!messageId) {
    throw new AgentToolValidationError("Gmail did not return a message id after send.", "PROVIDER_ERROR");
  }

  const data: GmailSendDraftData = {
    draftId,
    messageId,
    threadId: typeof json.threadId === "string" ? json.threadId : undefined,
    labelIds: Array.isArray(json.labelIds) ? json.labelIds : undefined,
  };
  return agentActionSuccess("gmail.sendDraft", ctx.agentId, data);
}
