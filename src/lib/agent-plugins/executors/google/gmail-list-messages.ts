import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";

export type GmailListMessagesInput = {
  maxResults?: number;
};

export type GmailListMessagesData = {
  messages: Array<{ id: string; threadId?: string }>;
  resultSizeEstimate?: number;
};

/**
 * GET gmail/v1/users/me/messages — normalized list (ids only from inbox listing).
 */
export async function executeGmailListMessages(ctx: AgentExecutionContext, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as GmailListMessagesInput;
  const maxResults =
    typeof body.maxResults === "number" && body.maxResults > 0 && body.maxResults <= 50
      ? body.maxResults
      : 10;

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", String(maxResults));

  const json = (await fetchGoogleJson(ctx, url.toString())) as {
    messages?: Array<{ id?: string; threadId?: string }>;
    resultSizeEstimate?: number;
  };

  const messages: Array<{ id: string; threadId?: string }> = [];
  for (const m of json.messages ?? []) {
    if (typeof m.id === "string") {
      messages.push({ id: m.id, threadId: typeof m.threadId === "string" ? m.threadId : undefined });
    }
  }

  const data: GmailListMessagesData = {
    messages,
    resultSizeEstimate:
      typeof json.resultSizeEstimate === "number" ? json.resultSizeEstimate : undefined,
  };
  return agentActionSuccess("gmail.listMessages", ctx.agentId, data);
}
