import { z } from "zod";
import { canInvokeReadTool, isWriteAction, type ExecutiveAgentScope } from "@/lib/executive-agent/executive-agent-policy";
import {
  pickExecutiveReadTools,
  resolveExecutiveReadToolKey,
  type ExecutiveReadToolKey,
} from "@/lib/executive-agent/executive-agent-read-tool-picker";
import { detectWriteIntent } from "@/lib/executive-agent/executive-agent-write-intent";

export type ExecutiveIntentPlannerReasoningMode = "deterministic" | "llm" | "llm_fallback";

export type ExecutiveIntentPlan = {
  readTools: ExecutiveReadToolKey[];
  proposedActions: Array<{ action: string; payload: Record<string, unknown>; title?: string }>;
  answerStyle: "concise" | "detailed" | "bullets";
  confidence: number;
  reasoningSummary: string;
};

/** LLM output — strict: unknown keys (e.g. chainOfThought) cause parse failure → orchestrator falls back. */
export const RawExecutiveIntentPlanSchema = z
  .object({
    readTools: z.array(z.string()).max(16).default([]),
    proposedActions: z
      .array(
        z.object({
          action: z.string(),
          payload: z.record(z.string(), z.unknown()).optional(),
          title: z.string().max(240).optional(),
        }),
      )
      .max(8)
      .default([]),
    answerStyle: z.enum(["concise", "detailed", "bullets"]).default("concise"),
    confidence: z.number().min(0).max(1).default(0.55),
    reasoningSummary: z.string().max(500).default(""),
  })
  .strict();

function dedupeReadTools(keys: ExecutiveReadToolKey[]): ExecutiveReadToolKey[] {
  return [...new Set(keys)];
}

function stableWriteKey(a: { action: string; payload: Record<string, unknown> }): string {
  let keys: string;
  try {
    keys = JSON.stringify(a.payload, Object.keys(a.payload).sort());
  } catch {
    keys = String(a.payload);
  }
  return `${a.action}:${keys}`;
}

export function dedupeProposedWrites(
  actions: Array<{ action: string; payload: Record<string, unknown>; title?: string }>,
): Array<{ action: string; payload: Record<string, unknown>; title?: string }> {
  const seen = new Set<string>();
  const out: Array<{ action: string; payload: Record<string, unknown>; title?: string }> = [];
  for (const a of actions) {
    const k = stableWriteKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export function filterLlmReadToolsForPolicy(
  names: string[],
  granted: Set<ExecutiveAgentScope>,
): ExecutiveReadToolKey[] {
  const out: ExecutiveReadToolKey[] = [];
  for (const n of names) {
    const k = resolveExecutiveReadToolKey(String(n));
    if (!k) continue;
    if (!canInvokeReadTool(k, granted)) continue;
    out.push(k);
  }
  return dedupeReadTools(out);
}

export function filterLlmProposedWrites(
  actions: Array<{ action: string; payload?: unknown; title?: string }>,
): Array<{ action: string; payload: Record<string, unknown>; title?: string }> {
  const out: Array<{ action: string; payload: Record<string, unknown>; title?: string }> = [];
  for (const a of actions) {
    if (!isWriteAction(a.action)) continue;
    const payload =
      a.payload != null && typeof a.payload === "object" && !Array.isArray(a.payload)
        ? (a.payload as Record<string, unknown>)
        : {};
    out.push({ action: a.action, payload, title: a.title });
  }
  return out;
}

export function normalizeRawExecutiveIntentPlan(
  raw: z.infer<typeof RawExecutiveIntentPlanSchema>,
  granted: Set<ExecutiveAgentScope>,
): ExecutiveIntentPlan {
  const readTools = filterLlmReadToolsForPolicy(raw.readTools, granted);
  const proposedActions = dedupeProposedWrites(filterLlmProposedWrites(raw.proposedActions));
  return {
    readTools,
    proposedActions,
    answerStyle: raw.answerStyle,
    confidence: raw.confidence,
    reasoningSummary: raw.reasoningSummary.trim().slice(0, 500),
  };
}

export function extractJsonObjectFromLlmText(text: string): string | null {
  const t = text.trim();
  if (t.startsWith("{")) return t;
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = m?.[1]?.trim();
  return inner && inner.startsWith("{") ? inner : null;
}

/** Parse LLM JSON text into a policy-filtered plan, or null if invalid / extra forbidden keys. */
export function parseExecutiveIntentPlanFromLlmContent(
  text: string | null | undefined,
  granted: Set<ExecutiveAgentScope>,
): ExecutiveIntentPlan | null {
  if (!text?.trim()) return null;
  const slice = extractJsonObjectFromLlmText(text) ?? (text.trim().startsWith("{") ? text.trim() : null);
  if (!slice) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return null;
  }
  const r = RawExecutiveIntentPlanSchema.safeParse(parsed);
  if (!r.success) return null;
  return normalizeRawExecutiveIntentPlan(r.data, granted);
}

export function buildDeterministicExecutiveIntentPlan(input: {
  prompt: string;
  requestedTool: string | null | undefined;
  dashboardMode: string | null | undefined;
  selectedAgents: string[] | null | undefined;
  selectedClientId: string | null | undefined;
  granted: Set<ExecutiveAgentScope>;
}): ExecutiveIntentPlan {
  const readTools = pickExecutiveReadTools(input.prompt, input.requestedTool ?? null, {
    dashboardMode: input.dashboardMode ?? null,
    selectedAgents: input.selectedAgents ?? null,
  }).filter((n) => canInvokeReadTool(n, input.granted));

  const write = detectWriteIntent(input.prompt, input.selectedClientId);
  const proposedActions =
    write && isWriteAction(write.action)
      ? dedupeProposedWrites([{ action: write.action, payload: write.payload }])
      : [];

  return {
    readTools: dedupeReadTools(readTools),
    proposedActions,
    answerStyle: "concise",
    confidence: 0.82,
    reasoningSummary: "Deterministic routing from keywords, dashboard mode, and agent selection.",
  };
}

/** Merge deterministic baseline with an optional LLM-normalized plan (read tools union; writes union deduped). */
export function mergeExecutiveIntentPlans(
  deterministic: ExecutiveIntentPlan,
  llm: ExecutiveIntentPlan | null,
): ExecutiveIntentPlan {
  if (!llm) return deterministic;
  const readTools = dedupeReadTools([...deterministic.readTools, ...llm.readTools]);
  const proposedActions = dedupeProposedWrites([...deterministic.proposedActions, ...llm.proposedActions]);
  return {
    readTools,
    proposedActions,
    answerStyle: llm.answerStyle,
    confidence: llm.confidence,
    reasoningSummary: llm.reasoningSummary.trim() || deterministic.reasoningSummary,
  };
}
