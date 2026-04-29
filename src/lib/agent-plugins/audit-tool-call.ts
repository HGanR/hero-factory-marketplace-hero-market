import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { agentToolCallAudit } from "@/lib/db/schema";
import { redactToolInputForAudit } from "@/lib/agent-plugins/redact-tool-input";
import { normalizeAuditCategory } from "@/lib/agent-plugins/audit-codes";
import { compactAgentActionForLlm } from "@/lib/agent-plugins/compact-tool-result";
import type { AgentActionSuccess } from "@/lib/agent-plugins/action-result";

/** Compact outcome for operators (inputs remain redacted in inputSummary). */
export function buildAuditDescriptor(params: {
  actionKey: string;
  ok: boolean;
  code?: string;
  result?: AgentActionSuccess;
  /** Non-PII id from tool args when result is missing (e.g. failed sendDraft). */
  inputDraftIdHint?: string | null;
}): string {
  if (!params.ok) {
    if (params.actionKey === "gmail.sendDraft" && params.inputDraftIdHint) {
      return `err|${params.code ?? "unknown"}|draft=${String(params.inputDraftIdHint).slice(0, 48)}`;
    }
    return `err|${params.code ?? "unknown"}`;
  }
  if (!params.result) return `ok|${params.actionKey}`;
  const c = compactAgentActionForLlm(params.result);
  const primary =
    (c.eventId as string | undefined) ??
    (c.draftId as string | undefined) ??
    (c.messageId as string | undefined);
  if (primary) return `ok|${params.actionKey}|${String(primary).slice(0, 64)}`;
  if (typeof c.eventCount === "number") return `ok|${params.actionKey}|n=${c.eventCount}`;
  if (typeof c.busyCount === "number") return `ok|${params.actionKey}|busy=${c.busyCount}`;
  return `ok|${params.actionKey}`;
}

export async function logAgentToolCallAudit(params: {
  agentId: string;
  userId: number;
  actionKey: string;
  input: unknown;
  success: boolean;
  errorCode?: string | null;
  successDescriptor?: string | null;
  latencyMs?: number | null;
}): Promise<void> {
  try {
    await ensureAgentTables();
    const db = await getDb();
    await db.insert(agentToolCallAudit).values({
      id: crypto.randomUUID(),
      agentId: params.agentId,
      userId: params.userId,
      actionKey: params.actionKey,
      inputSummary: redactToolInputForAudit(params.actionKey, params.input),
      success: params.success,
      errorCode: normalizeAuditCategory(params.errorCode ?? null)?.slice(0, 64) ?? null,
      successDescriptor: params.successDescriptor?.slice(0, 255) ?? null,
      latencyMs: params.latencyMs ?? null,
    });
  } catch (e) {
    console.error("[agent-tool-audit]", e);
  }
}
