import { and, asc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { aiAgentKnowledgeItems, aiAgents } from "@/lib/db/schema";
import type { NPCProfile } from "@/lib/npc/types";
import { resolveAgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import {
  EXECUTIVE_ADMIN_CAPABILITY_INJECTION,
  isSkipperExecutiveNpcProfile,
} from "@/lib/agents/executive-admin-system-prompt";
import { resolveUnifiedAgentRuntimeContext } from "@/lib/agents/unified-skipper-runtime-context";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import { formatExecutiveDeskContext } from "@/lib/executive-agent/executive-orchestrator-context";
import { getSkipperOutputVoiceForUser } from "@/lib/voices/executive-skipper-output-voice";

export const UNIFIED_SKIPPER_RUNTIME_VERSION = "2026.5.11";

/** Public / embedded SKIPPER — no live admin analytics, CRM, or approval side effects from this surface. */
export const WIDGET_SKIPPER_PUBLIC_SAFETY_ADDENDUM = `WIDGET PUBLIC SURFACE (safety):
- Stay in Executive Administration persona for tone and "what you do" answers, but do not claim you ran platform analytics, CRM exports, or executive desk actions.
- Do not queue approvals, publish content, send messages, delete data, or mutate live configuration. Direct visitors to the business for account-specific actions.
- Use only the knowledge and site context provided in this system prompt; do not invent private metrics.`;

export type SkipperUnifiedOrchestrationLevel = "full" | "lightweight" | "npc" | "widget";

export type UnifiedSkipperVoiceProfile = {
  agentId: string | null;
  voiceId: string | null;
  voiceProvider: string | null;
  agentRuntimeType: string | null;
  source: "db" | "not_configured";
};

export type UnifiedSkipperCognitiveDiagnostics = {
  entryPoint: string;
  orchestrationLevel: SkipperUnifiedOrchestrationLevel;
  activePromptLayers: string[];
  connectedDataSources: string[];
  connectedTools: string[];
  memoryStatus: "active" | "none" | "n/a";
  knowledgeStatus: "loaded" | "empty" | "n/a";
  voiceStatus: "assigned" | "missing" | "n/a";
  fallbackFlags: string[];
  unifiedRuntimeVersion: string;
  /** Non-admin surfaces must stay "none"; Executive Administration uses admin orchestrator approvals only. */
  writesAllowed: "admin_approvals_only" | "none";
};

export type UnifiedSkipperCognitiveRuntime = {
  runtimeType: "executive_admin";
  orchestrationLevel: SkipperUnifiedOrchestrationLevel;
  systemPrompt: string;
  capabilityInjection: string;
  memoryContext: string;
  knowledgeContext: string;
  analyticsContext: string;
  connectedTools: Record<string, boolean>;
  voiceProfile: UnifiedSkipperVoiceProfile | null;
  diagnostics: UnifiedSkipperCognitiveDiagnostics;
  fallbackReason: string | null;
};

export type SkipperExecutiveAgentInput =
  | { kind: "agent"; name: string | null | undefined; agentRuntimeType?: string | null }
  | { kind: "npc"; profile: Pick<NPCProfile, "id" | "name" | "role"> };

export function isSkipperExecutiveAgent(input: SkipperExecutiveAgentInput): boolean {
  if (input.kind === "agent") {
    return resolveAgentRuntimeType({ agentRuntimeType: input.agentRuntimeType, name: input.name }) === "executive_admin";
  }
  return isSkipperExecutiveNpcProfile(input.profile);
}

/**
 * Capability graph for UI/diagnostics — not an auth grant. `approvalsQueue` is true only on full admin orchestration.
 */
export function getUnifiedSkipperCapabilities(input: {
  orchestrationLevel: SkipperUnifiedOrchestrationLevel;
}): Record<string, boolean> {
  const full = input.orchestrationLevel === "full";
  const lw = input.orchestrationLevel === "lightweight";
  const npc = input.orchestrationLevel === "npc";
  const widget = input.orchestrationLevel === "widget";
  return {
    analytics: full || lw,
    crm: full || lw,
    bentley: full || lw,
    executiveMemory: full || lw,
    routines: full || lw,
    followUpIntelligence: full || lw,
    connectedAgents: full || lw,
    /** Explain-only on lightweight; live reads on full admin orchestrator path. */
    liveExecutiveReads: full,
    /** Only Executive Administration may queue approval records via runExecutiveOrchestrator. */
    approvalsQueue: full,
    /** NPC / widget stay persona-safe; no admin tool execution. */
    npcSafePersona: npc || widget,
  };
}

/**
 * Final chat system text — by default identical to `runtime.systemPrompt` (already includes capability stack where applicable).
 * Appends {@link WIDGET_SKIPPER_PUBLIC_SAFETY_ADDENDUM} when `withWidgetPublicSafety` is true.
 */
export function buildUnifiedSkipperSystemPrompt(
  runtime: Pick<UnifiedSkipperCognitiveRuntime, "systemPrompt" | "orchestrationLevel">,
  opts?: { withWidgetPublicSafety?: boolean },
): string {
  if (opts?.withWidgetPublicSafety && runtime.orchestrationLevel === "widget") {
    return `${runtime.systemPrompt}\n\n---\n${WIDGET_SKIPPER_PUBLIC_SAFETY_ADDENDUM}`;
  }
  return runtime.systemPrompt;
}

function mapInnerOrchestrationToSkipper(
  inner: "full" | "lightweight" | "npc" | "troo_world",
  surface: string,
): SkipperUnifiedOrchestrationLevel {
  if (surface === "widget") return "widget";
  if (inner === "troo_world" || inner === "npc") return "npc";
  if (inner === "full") return "full";
  return "lightweight";
}

function emptyTools(): Record<string, boolean> {
  return {};
}

async function toolsForAgent(db: MySql2Database<typeof schema>, agentId: string): Promise<Record<string, boolean>> {
  const caps = await resolveAgentCapabilities(agentId);
  const connectedTools: Record<string, boolean> = {};
  for (const a of caps.executableActions.slice(0, 32)) {
    connectedTools[a.actionKey] = true;
  }
  return connectedTools;
}

export type ResolveUnifiedSkipperRuntimeInput =
  | { surface: "admin_executive_chat" | "admin_executive_voice"; db: MySql2Database<typeof schema>; adminUserId: number; deskPrompt?: string }
  | { surface: "ai_agency_test"; db: MySql2Database<typeof schema>; userId: number; agentId: string; knowledgeUserMessage: string }
  | { surface: "npc"; db: MySql2Database<typeof schema>; profile: NPCProfile; knowledgeEntryCount: number }
  | {
      surface: "troo_world";
      db: MySql2Database<typeof schema>;
      npcName: string;
      npcRole: string;
      hasKnowledgeDocs: boolean;
      personalitySystemPrompt?: string | null;
    }
  | { surface: "widget"; db: MySql2Database<typeof schema>; ownerUserId: number; agentId: string; knowledgeUserMessage: string };

/**
 * Unified SKIPPER cognitive runtime: one executive_admin identity, shared prompt stack (via executive-admin-system-prompt + unified agent context),
 * surface-specific orchestration level and safety (writes only on full admin orchestrator).
 */
export async function resolveUnifiedSkipperRuntimeContext(
  input: ResolveUnifiedSkipperRuntimeInput,
): Promise<UnifiedSkipperCognitiveRuntime | null> {
  const capabilityInjection = EXECUTIVE_ADMIN_CAPABILITY_INJECTION;
  const fallbackFlags: string[] = [];
  let fallbackReason: string | null = null;

  if (input.surface === "npc") {
    if (!isSkipperExecutiveNpcProfile(input.profile)) return null;
    const inner = await resolveUnifiedAgentRuntimeContext(input.db, {
      entryPoint: "npc_chat",
      profile: input.profile,
      knowledgeEntryCount: input.knowledgeEntryCount,
    });
    const orch = mapInnerOrchestrationToSkipper(inner.diagnostics.orchestrationLevel, "npc");
    return {
      runtimeType: "executive_admin",
      orchestrationLevel: orch,
      systemPrompt: inner.systemPrompt,
      capabilityInjection,
      memoryContext: "",
      knowledgeContext: "",
      analyticsContext:
        "Live analytics and CRM intelligence are available only to authenticated Executive Administration users.",
      connectedTools: emptyTools(),
      voiceProfile: null,
      diagnostics: {
        entryPoint: "npc_chat",
        orchestrationLevel: orch,
        activePromptLayers: inner.diagnostics.activePromptLayers,
        connectedDataSources: inner.diagnostics.connectedDataSources,
        connectedTools: Object.keys(inner.connectedTools ?? {}),
        memoryStatus: "n/a",
        knowledgeStatus: input.knowledgeEntryCount > 0 ? "loaded" : "empty",
        voiceStatus: "n/a",
        fallbackFlags: [...inner.diagnostics.fallbackFlags, ...fallbackFlags],
        unifiedRuntimeVersion: UNIFIED_SKIPPER_RUNTIME_VERSION,
        writesAllowed: "none",
      },
      fallbackReason: inner.diagnostics.fallbackFlags.length ? inner.diagnostics.fallbackFlags.join(";") : null,
    };
  }

  if (input.surface === "troo_world") {
    if (input.npcRole !== "executive_admin") return null;
    const inner = await resolveUnifiedAgentRuntimeContext(input.db, {
      entryPoint: "troo_world_npc_chat",
      npcName: input.npcName,
      npcRole: input.npcRole,
      hasKnowledgeDocs: input.hasKnowledgeDocs,
      personalitySystemPrompt: input.personalitySystemPrompt,
    });
    const orch = mapInnerOrchestrationToSkipper(inner.diagnostics.orchestrationLevel, "troo_world");
    return {
      runtimeType: "executive_admin",
      orchestrationLevel: "npc",
      systemPrompt: inner.systemPrompt,
      capabilityInjection,
      memoryContext: "",
      knowledgeContext: "",
      analyticsContext:
        "Troo World NPC mode: describe executive workflows without claiming access to private admin dashboards.",
      connectedTools: emptyTools(),
      voiceProfile: null,
      diagnostics: {
        entryPoint: "troo_world_npc_chat",
        orchestrationLevel: "npc",
        activePromptLayers: inner.diagnostics.activePromptLayers,
        connectedDataSources: inner.diagnostics.connectedDataSources,
        connectedTools: Object.keys(inner.connectedTools ?? {}),
        memoryStatus: "n/a",
        knowledgeStatus: input.hasKnowledgeDocs ? "loaded" : "empty",
        voiceStatus: "n/a",
        fallbackFlags: [...inner.diagnostics.fallbackFlags, ...fallbackFlags],
        unifiedRuntimeVersion: UNIFIED_SKIPPER_RUNTIME_VERSION,
        writesAllowed: "none",
      },
      fallbackReason: inner.diagnostics.fallbackFlags.length ? inner.diagnostics.fallbackFlags.join(";") : null,
    };
  }

  if (input.surface === "ai_agency_test") {
    const uid = input.userId;
    const rows = await input.db
      .select({ name: aiAgents.name, agentRuntimeType: aiAgents.agentRuntimeType })
      .from(aiAgents)
      .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.userId, uid)))
      .limit(1);
    const row = rows[0];
    if (!row || !isSkipperExecutiveAgent({ kind: "agent", name: row.name, agentRuntimeType: row.agentRuntimeType })) {
      return null;
    }

    const knowledgeRows = await input.db
      .select({
        id: aiAgentKnowledgeItems.id,
        contentOrPointer: aiAgentKnowledgeItems.contentOrPointer,
        type: aiAgentKnowledgeItems.type,
      })
      .from(aiAgentKnowledgeItems)
      .where(eq(aiAgentKnowledgeItems.agentId, input.agentId))
      .orderBy(asc(aiAgentKnowledgeItems.sortOrder));

    const inner = await resolveUnifiedAgentRuntimeContext(input.db, {
      entryPoint: "ai_agency_test_chat",
      userId: uid,
      agentId: input.agentId,
      knowledgeUserMessage: input.knowledgeUserMessage,
    });

    const orch: SkipperUnifiedOrchestrationLevel = "lightweight";
    const connected = await toolsForAgent(input.db, input.agentId);

    return {
      runtimeType: "executive_admin",
      orchestrationLevel: orch,
      systemPrompt: inner.systemPrompt,
      capabilityInjection,
      memoryContext: "",
      knowledgeContext: knowledgeRows.length > 0 ? "(retrieval embedded in systemPrompt)" : "",
      analyticsContext:
        "Live analytics, CRM, and Bentley reads require Executive Administration. This surface may describe capabilities only.",
      connectedTools: connected,
      voiceProfile: null,
      diagnostics: {
        entryPoint: "ai_agency_test_chat",
        orchestrationLevel: orch,
        activePromptLayers: inner.diagnostics.activePromptLayers,
        connectedDataSources: inner.diagnostics.connectedDataSources,
        connectedTools: Object.keys(connected),
        memoryStatus: inner.memoryEnabled ? "active" : "none",
        knowledgeStatus: knowledgeRows.length > 0 ? "loaded" : "empty",
        voiceStatus: "n/a",
        fallbackFlags: [...inner.diagnostics.fallbackFlags, "lightweight_skipper_runtime"],
        unifiedRuntimeVersion: UNIFIED_SKIPPER_RUNTIME_VERSION,
        writesAllowed: "none",
      },
      fallbackReason: inner.diagnostics.fallbackFlags.length ? inner.diagnostics.fallbackFlags.join(";") : null,
    };
  }

  if (input.surface === "widget") {
    const uid = input.ownerUserId;
    const rows = await input.db
      .select({ name: aiAgents.name, agentRuntimeType: aiAgents.agentRuntimeType })
      .from(aiAgents)
      .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.userId, uid)))
      .limit(1);
    const row = rows[0];
    if (!row || !isSkipperExecutiveAgent({ kind: "agent", name: row.name, agentRuntimeType: row.agentRuntimeType })) {
      return null;
    }

    const knowledgeRows = await input.db
      .select({
        id: aiAgentKnowledgeItems.id,
        contentOrPointer: aiAgentKnowledgeItems.contentOrPointer,
        type: aiAgentKnowledgeItems.type,
      })
      .from(aiAgentKnowledgeItems)
      .where(eq(aiAgentKnowledgeItems.agentId, input.agentId))
      .orderBy(asc(aiAgentKnowledgeItems.sortOrder));

    const inner = await resolveUnifiedAgentRuntimeContext(input.db, {
      entryPoint: "ai_agency_test_chat",
      userId: uid,
      agentId: input.agentId,
      knowledgeUserMessage: input.knowledgeUserMessage,
    });

    const orch: SkipperUnifiedOrchestrationLevel = "widget";
    const systemPrompt = buildUnifiedSkipperSystemPrompt(
      { systemPrompt: inner.systemPrompt, orchestrationLevel: orch },
      { withWidgetPublicSafety: true },
    );
    const connected = await toolsForAgent(input.db, input.agentId);

    return {
      runtimeType: "executive_admin",
      orchestrationLevel: orch,
      systemPrompt,
      capabilityInjection,
      memoryContext: "",
      knowledgeContext: knowledgeRows.length > 0 ? "(retrieval embedded in systemPrompt)" : "",
      analyticsContext:
        "Widget embed: stay persona-aligned; do not claim live admin analytics/CRM or queue approvals.",
      connectedTools: connected,
      voiceProfile: null,
      diagnostics: {
        entryPoint: "widget_embed",
        orchestrationLevel: orch,
        activePromptLayers: [...inner.diagnostics.activePromptLayers, "widget_public_safety"],
        connectedDataSources: inner.diagnostics.connectedDataSources,
        connectedTools: Object.keys(connected),
        memoryStatus: inner.memoryEnabled ? "active" : "none",
        knowledgeStatus: knowledgeRows.length > 0 ? "loaded" : "empty",
        voiceStatus: "n/a",
        fallbackFlags: [...inner.diagnostics.fallbackFlags, "public_widget_surface"],
        unifiedRuntimeVersion: UNIFIED_SKIPPER_RUNTIME_VERSION,
        writesAllowed: "none",
      },
      fallbackReason: inner.diagnostics.fallbackFlags.length ? inner.diagnostics.fallbackFlags.join(";") : null,
    };
  }

  // Admin executive chat / voice — full orchestration persona alignment (intent planner stack); live reads via orchestrator.
  const entry: "executive_dashboard" | "voice_runtime" =
    input.surface === "admin_executive_voice" ? "voice_runtime" : "executive_dashboard";
  const inner = await resolveUnifiedAgentRuntimeContext(input.db, { entryPoint: entry, adminUserId: input.adminUserId });
  const deskPrompt = (input.deskPrompt ?? "What changed since last session?").trim();
  let memoryContext = "";
  try {
    memoryContext =
      (await formatExecutiveDeskContext(input.db, {
        adminUserId: input.adminUserId,
        prompt: deskPrompt,
        selectedAgents: null,
        dashboardMode: null,
        selectedTimeRange: null,
      })) ?? "";
  } catch {
    memoryContext = "";
  }

  const voice = await getSkipperOutputVoiceForUser(input.db, input.adminUserId);
  const voiceProfile: UnifiedSkipperVoiceProfile | null = voice
    ? {
        agentId: voice.agentId,
        voiceId: voice.voiceId,
        voiceProvider: voice.voiceProvider,
        agentRuntimeType: voice.agentRuntimeType,
        source: "db",
      }
    : { agentId: null, voiceId: null, voiceProvider: null, agentRuntimeType: null, source: "not_configured" };

  if (!voice?.voiceId) fallbackFlags.push("skipper_voice_unassigned");

  return {
    runtimeType: "executive_admin",
    orchestrationLevel: "full",
    systemPrompt: inner.systemPrompt,
    capabilityInjection,
    memoryContext: memoryContext.slice(0, 12_000),
    knowledgeContext: "",
    analyticsContext:
      "Live analytics, CRM, Bentley bridge, agent intelligence, and memory are available through runExecutiveOrchestrator read tools on this surface.",
    connectedTools: emptyTools(),
    voiceProfile,
    diagnostics: {
      entryPoint: entry,
      orchestrationLevel: "full",
      activePromptLayers: inner.diagnostics.activePromptLayers,
      connectedDataSources: inner.diagnostics.connectedDataSources,
      connectedTools: [],
      memoryStatus: memoryContext.length > 80 ? "active" : "none",
      knowledgeStatus: "n/a",
      voiceStatus: voice?.voiceId ? "assigned" : "missing",
      fallbackFlags: [...inner.diagnostics.fallbackFlags, ...fallbackFlags],
      unifiedRuntimeVersion: UNIFIED_SKIPPER_RUNTIME_VERSION,
      writesAllowed: "admin_approvals_only",
    },
    fallbackReason: fallbackFlags.length ? fallbackFlags.join(";") : null,
  };
}
