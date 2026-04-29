import { canAccessAgent } from "@/lib/agents/agent-access";
import {
  getActionDefinition,
  ACTION_HANDLERS,
  type AgentRuntimeActionKey,
} from "@/lib/agent-plugins/registry";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import { getValidGoogleAccessTokenForAgent } from "@/lib/agent-plugins/google-token";
import { explainExecutionGate } from "@/lib/agent-plugins/execution-gate";
import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import type { AgentActionSuccess } from "@/lib/agent-plugins/action-result";
import {
  isWriteConfirmationContextValid,
  AGENT_BUILDER_TEST_USER_MESSAGE,
} from "@/lib/agent-plugins/write-confirmation-context";
import { normalizeAgentConversationContext } from "@/lib/agent-plugins/conversation-normalize";
import { resolveMergedConversationForExecute } from "@/lib/agent-plugins/agent-session-memory";
import { AgentToolValidationError } from "@/lib/agent-plugins/agent-tool-validation-error";

export type ExecuteAgentActionErrorCode =
  | "FORBIDDEN"
  | "UNKNOWN_ACTION"
  | "NOT_EXECUTABLE"
  | "NO_ACCESS_TOKEN"
  | "NO_HANDLER"
  | "CONFIRMATION_REQUIRED"
  | "DUPLICATE_CALENDAR_EVENT"
  | "CALENDAR_VALIDATION"
  | "GMAIL_VALIDATION"
  | "PROVIDER_ERROR";

/** Discriminated result from execute — use for API + runtime typing. */
export type ExecuteAgentActionResult =
  | { ok: true; result: AgentActionSuccess }
  | { ok: false; error: string; code: ExecuteAgentActionErrorCode };

function stripConfirmationFromInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const o = { ...(input as Record<string, unknown>) };
  delete o.confirmed;
  return o;
}

/**
 * Run one registered action after auth + enablement checks.
 * Credentials are always for `agentId` only (see agent_plugin_credentials).
 */
export async function executeAgentAction(params: {
  userId: number;
  agentId: string;
  actionKey: string;
  input?: unknown;
  /** Live chat / widget / execute API — normalized internally before write gates. */
  conversation?: unknown;
  /** When set, priorMessages are merged with server-stored turns before confirmation validation. */
  sessionId?: string | null;
}): Promise<ExecuteAgentActionResult> {
  const { userId, agentId, actionKey, input } = params;

  const okAccess = await canAccessAgent(agentId, userId);
  if (!okAccess) return { ok: false, error: "Forbidden", code: "FORBIDDEN" };

  const found = getActionDefinition(actionKey);
  if (!found) return { ok: false, error: "Unknown action", code: "UNKNOWN_ACTION" };

  const resolved = await resolveAgentCapabilities(agentId);
  const allowed = resolved.executableActions.some((a) => a.actionKey === actionKey);
  if (!allowed) {
    const { message } = await explainExecutionGate(agentId, actionKey);
    return { ok: false, error: message, code: "NOT_EXECUTABLE" };
  }

  const accessToken = await getValidGoogleAccessTokenForAgent(agentId);
  if (!accessToken) {
    const { message } = await explainExecutionGate(agentId, actionKey);
    return { ok: false, error: message, code: "NO_ACCESS_TOKEN" };
  }

  const handler = ACTION_HANDLERS[actionKey as AgentRuntimeActionKey];
  if (!handler) return { ok: false, error: "No handler registered for this action", code: "NO_HANDLER" };

  if (found.action.kind === "write") {
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    if (raw.confirmed !== true) {
      return {
        ok: false,
        error:
          "Write actions require confirmed:true in the tool call only after the user explicitly agreed in this chat.",
        code: "CONFIRMATION_REQUIRED",
      };
    }

    const normalizedBase = normalizeAgentConversationContext(params.conversation);
    const effectiveConversation = await resolveMergedConversationForExecute({
      userId,
      agentId,
      sessionId: params.sessionId,
      client: normalizedBase,
    });

    const skipThreadCheck = effectiveConversation.userMessage === AGENT_BUILDER_TEST_USER_MESSAGE;
    if (!skipThreadCheck) {
      const ctxCheck = isWriteConfirmationContextValid({
        userMessage: effectiveConversation.userMessage,
        priorMessages: effectiveConversation.priorMessages,
        currentLoopAssistantTurns: effectiveConversation.currentLoopAssistantTurns,
      });
      if (!ctxCheck.ok) {
        console.warn(
          JSON.stringify({
            tag: "agent_write_confirmation",
            indicator: "confirmation_failed_missing_context",
            agentId,
            actionKey,
            code: "CONFIRMATION_REQUIRED",
          })
        );
        return { ok: false, error: ctxCheck.message, code: "CONFIRMATION_REQUIRED" };
      }
    }
  }

  const ctx: AgentExecutionContext = { agentId, userId, accessToken };

  try {
    const result = await handler(ctx, stripConfirmationFromInput(input ?? {}));
    if (result.v !== 1 || result.agentId !== agentId) {
      return { ok: false, error: "Invalid action result envelope", code: "PROVIDER_ERROR" };
    }
    return { ok: true, result };
  } catch (e) {
    if (e instanceof AgentToolValidationError) {
      return { ok: false, error: e.message, code: e.code as ExecuteAgentActionErrorCode };
    }
    const msg = e instanceof Error ? e.message : "Execution failed";
    return { ok: false, error: msg, code: "PROVIDER_ERROR" };
  }
}
