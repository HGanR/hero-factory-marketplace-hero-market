import type { ExecutableActionInfo, ResolvedAgentCapabilities } from "@/lib/agent-plugins/types";
import { getActionDefinition, type AgentRuntimeActionKey } from "@/lib/agent-plugins/registry";
import { actionKeyToOpenAiFunctionName } from "@/lib/agent-plugins/openai-tool-names";
import type { OpenAiToolDefinition } from "@/lib/npc/llm-tools";

const CONFIRM_PROP = {
  type: "boolean",
  description:
    "Must be true only after the user explicitly confirmed creating this draft or event in the current conversation.",
};

/**
 * JSON Schema fragments for LLM tool calling (OpenAI-style parameters.objects).
 * Write actions include `confirmed` (enforced server-side).
 */
export const ACTION_INPUT_SCHEMAS: Record<AgentRuntimeActionKey, Record<string, unknown>> = {
  "calendar.freeBusy": {
    type: "object",
    properties: {
      timeMin: { type: "string", description: "ISO 8601 start (optional)" },
      timeMax: { type: "string", description: "ISO 8601 end (optional)" },
    },
  },
  "calendar.listEvents": {
    type: "object",
    properties: {
      timeMin: { type: "string", description: "ISO 8601 window start (optional)" },
      timeMax: { type: "string", description: "ISO 8601 window end (optional)" },
      maxResults: { type: "integer", minimum: 1, maximum: 50, description: "Max events to return" },
    },
  },
  "calendar.createEvent": {
    type: "object",
    properties: {
      summary: { type: "string", description: "Event title" },
      startDateTime: { type: "string", description: "ISO 8601 start" },
      endDateTime: { type: "string", description: "ISO 8601 end" },
      timeZone: { type: "string", description: "IANA timezone, default UTC" },
      confirmed: CONFIRM_PROP,
    },
    required: ["confirmed"],
  },
  "gmail.listMessages": {
    type: "object",
    properties: {
      maxResults: { type: "integer", minimum: 1, maximum: 50, description: "How many messages to list" },
    },
  },
  "gmail.createDraft": {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email (optional for drafts)" },
      subject: { type: "string" },
      bodyText: { type: "string", description: "Plain text body" },
      confirmed: CONFIRM_PROP,
    },
    required: ["confirmed"],
  },
  "gmail.sendDraft": {
    type: "object",
    properties: {
      draftId: { type: "string", description: "Gmail draft id to send" },
      confirmed: CONFIRM_PROP,
    },
    required: ["draftId", "confirmed"],
  },
  "drive.listFiles": {
    type: "object",
    properties: {
      pageSize: { type: "integer", minimum: 1, maximum: 50 },
    },
  },
};

export type LlmToolDefinition = {
  /** OpenAI-safe function name (dots → underscores) */
  name: string;
  actionKey: string;
  description: string;
  invocationHint: string;
  kind: "read" | "write";
  parameters: Record<string, unknown>;
};

/**
 * Runtime tool list for the LLM: only actions that are actually executable for this agent right now.
 */
export function buildLlmToolDefinitions(resolved: ResolvedAgentCapabilities): LlmToolDefinition[] {
  return resolved.executableActions.map((a) => toLlmTool(a));
}

export function toLlmTool(action: ExecutableActionInfo): LlmToolDefinition {
  const def = getActionDefinition(action.actionKey);
  const schema =
    ACTION_INPUT_SCHEMAS[action.actionKey as AgentRuntimeActionKey] ?? { type: "object", properties: {} };
  const description = def
    ? `${def.action.description} (${def.plugin.displayName})`
    : `${action.description}`;

  return {
    name: actionKeyToOpenAiFunctionName(action.actionKey),
    actionKey: action.actionKey,
    description,
    invocationHint: action.invocationHint,
    kind: action.kind,
    parameters: schema,
  };
}

export function buildOpenAiToolDefinitionsFromDefs(defs: LlmToolDefinition[]): OpenAiToolDefinition[] {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: `${d.description}\nWhen: ${d.invocationHint}`,
      parameters: d.parameters,
    },
  }));
}

/** OpenAI `tools` array for chat completions. */
export function buildOpenAiToolDefinitions(resolved: ResolvedAgentCapabilities): OpenAiToolDefinition[] {
  return buildOpenAiToolDefinitionsFromDefs(buildLlmToolDefinitions(resolved));
}
