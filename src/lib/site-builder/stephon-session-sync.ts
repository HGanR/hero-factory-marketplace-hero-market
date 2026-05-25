import "server-only";

import {
  addMessage,
  createSession,
  getNpcRowByNpcId,
  getSessionBySessionId,
  incrementSessionMessageCount,
} from "@/lib/npc/db";
import { STEPHON_NPC_ID } from "@/lib/site-builder/stephon-persona";

export function buildStephonSessionId(siteId: string | null | undefined, userId: number): string {
  const sid = (siteId ?? "draft").trim() || "draft";
  return `sb-${sid}-${userId}`;
}

export async function syncStephonSiteBuilderMessage(params: {
  userId: number;
  siteId?: string | null;
  role: "user" | "assistant";
  content: string;
  topic?: string | null;
}): Promise<{ ok: boolean; sessionId?: string; reason?: string }> {
  const content = params.content.trim();
  if (!content) return { ok: false, reason: "empty_content" };

  const npc = await getNpcRowByNpcId(STEPHON_NPC_ID);
  if (!npc) return { ok: false, reason: "npc_missing" };

  const sessionId = buildStephonSessionId(params.siteId, params.userId);
  let session = await getSessionBySessionId(sessionId);

  if (!session) {
    await createSession({
      sessionId,
      npcRowId: npc.id,
      npcNpcId: STEPHON_NPC_ID,
      userId: params.userId,
      currentTopic: params.topic?.trim() || params.siteId?.trim() || "draft",
    });
    session = await getSessionBySessionId(sessionId);
  }

  if (!session) return { ok: false, reason: "session_create_failed" };

  await addMessage({
    sessionRowId: session.id,
    role: params.role === "user" ? "user" : "npc",
    content,
    responseSource: params.role === "assistant" ? "llm" : "template",
  });
  await incrementSessionMessageCount(sessionId);

  return { ok: true, sessionId };
}
