import { z } from "zod";

/** Registered server adapters only. These descriptors do not grant execution authority. */
export const ENGINE_RUNTIME_VERSION = "skipper-engine-runtime-v1";
export const ENGINE_CATALOG = [
  { id: "company.accounts", agent: "skipper", mode: "read", purpose: "Current pending and approved account counts; not collected payments.", fields: "{}" },
  { id: "company.analytics", agent: "skipper", mode: "read", purpose: "Recorded website analytics and attribution, with their source limits.", fields: "{}" },
  { id: "agents.overview", agent: "skipper", mode: "read", purpose: "Website agent coordination and capability inventory; routing is not execution.", fields: "{}" },
  { id: "bentley.outputs", agent: "bentley", mode: "read", purpose: "Existing owned campaign outputs.", fields: "{campaignId?: UUID}" },
  { id: "stephon.projects", agent: "stephon", mode: "read", purpose: "Owned website project status.", fields: "{}" },
  { id: "eleanor.operations", agent: "eleanor", mode: "read", purpose: "Account-scoped fulfillment operations overview; not an assertion of collected revenue.", fields: "{}" },
  { id: "jarva.smart_trust", agent: "jarva", mode: "read", purpose: "Account-scoped Smart Trust fulfillment status; not legal execution or desktop readiness certification.", fields: "{}" },
  { id: "reality.engagement", agent: "reality", mode: "read", purpose: "Recorded engagement summary; no outbound messages.", fields: "{}" },
  { id: "skipper.knowledge", agent: "skipper", mode: "read", purpose: "Existing website knowledge-base summary; not proof every document was read.", fields: "{}" },
  { id: "bentley.market_research", agent: "bentley", mode: "approval", purpose: "Execute the existing Reddit market-sweep pipeline. Configured inference may incur provider charges. No publication.", fields: "{clientId: UUID, industry: string, targetAudience?: string}" },
  { id: "bentley.campaign_drafts", agent: "bentley", mode: "approval", purpose: "Synchronize an owned campaign into unscheduled drafts using the existing executor. No scheduling or publication.", fields: "{campaignId: UUID}" },
  { id: "stephon.intake", agent: "stephon", mode: "approval", purpose: "Record an owned client's website brief as an internal intake note. This does NOT build a website.", fields: "{clientId: UUID, title: string, instruction: string}" },
] as const;
export type EngineId = typeof ENGINE_CATALOG[number]["id"];
export const InputSchemas = {
  "company.accounts": z.object({}).strict(),
  "company.analytics": z.object({}).strict(),
  "agents.overview": z.object({}).strict(),
  "bentley.outputs": z.object({ campaignId: z.string().uuid().optional() }).strict(),
  "stephon.projects": z.object({}).strict(),
  "eleanor.operations": z.object({}).strict(),
  "jarva.smart_trust": z.object({}).strict(),
  "reality.engagement": z.object({}).strict(),
  "skipper.knowledge": z.object({}).strict(),
  "bentley.market_research": z.object({ clientId: z.string().uuid(), industry: z.string().trim().min(2).max(200), targetAudience: z.string().trim().max(400).optional() }).strict(),
  "bentley.campaign_drafts": z.object({ campaignId: z.string().uuid() }).strict(),
  "stephon.intake": z.object({ clientId: z.string().uuid(), title: z.string().trim().min(1).max(500), instruction: z.string().trim().min(1).max(20000) }).strict(),
};
const ids = ENGINE_CATALOG.map(e => e.id) as [EngineId, ...EngineId[]];
export const EngineRequest = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("read"), engineId: z.enum(ids), input: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ operation: z.literal("propose"), requestId: z.string().uuid(), engineId: z.enum(ids), input: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ operation: z.literal("approve"), requestId: z.string().uuid(), humanConfirmed: z.literal(true) }).strict(),
  z.object({ operation: z.literal("reject"), requestId: z.string().uuid(), humanConfirmed: z.literal(true) }).strict(),
  z.object({ operation: z.literal("receipt"), requestId: z.string().uuid() }).strict(),
]);
export function resolveEngineInput(engineId: EngineId, input: unknown) {
  return InputSchemas[engineId].parse(input);
}
export function writeActionForEngine(id: EngineId, input: Record<string, unknown>) {
  const clean = resolveEngineInput(id, input);
  switch (id) {
    case "bentley.market_research": return { action: "triggerBentleyAnalysis", payload: { ...clean, mode: "market_sweep" } };
    case "bentley.campaign_drafts": return { action: "triggerCampaignSync", payload: { ...clean, dryRun: false } };
    case "stephon.intake": return { action: "createSiteBuilderTask", payload: clean };
    default: throw new Error("This engine does not accept execution proposals.");
  }
}
export function sameEngineProposal(row: { targetType: string | null; proposedAction: string; payloadJson: string }, engineId: EngineId, input: Record<string, unknown>) {
  const expected = writeActionForEngine(engineId, input);
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k)+":"+stable(v)).join(",") + "}";
    return JSON.stringify(value) ?? "null";
  };
  return row.targetType === "engine:" + engineId && row.proposedAction === expected.action && stable(JSON.parse(row.payloadJson)) === stable(expected.payload);
}
