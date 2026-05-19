import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  aiAgents,
  aiAgentKnowledgeItems,
  agentConversationSessions,
} from "@/lib/db/schema";
import { resolveAgentRuntimeType, type AgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import {
  resolveUnifiedAgentRuntimeContext,
  type UnifiedAgentRuntimeContext,
} from "@/lib/agents/unified-skipper-runtime-context";
import {
  resolveUnifiedSkipperRuntimeContext,
  UNIFIED_SKIPPER_RUNTIME_VERSION,
  type UnifiedSkipperCognitiveDiagnostics,
  type UnifiedSkipperVoiceProfile,
} from "@/lib/agents/skipper-unified-runtime";

function hasLlmEndpoint(agentConfig: { llmEndpoint?: string | null } | null): boolean {
  if (agentConfig?.llmEndpoint?.trim()) return true;
  return Boolean(process.env.NPC_LLM_ENDPOINT?.trim());
}

export type RuntimeCapabilityState = "connected" | "partial" | "disconnected";

export type AgentRuntimeDiagnostics = {
  runtimeType: AgentRuntimeType;
  activeSystemPrompt: string;
  retrievalEnabled: boolean;
  kbEntries: number;
  memoryEnabled: boolean;
  orchestratorEnabled: boolean;
  analyticsEnabled: boolean;
  crmEnabled: boolean;
  bentleyBridgeEnabled: boolean;
  connectedAgents: string[];
  fallbackReason: string | null;
  /** Named strip for AI Agency / admin UIs */
  capabilities: Record<
    | "executiveOrchestrator"
    | "analytics"
    | "crm"
    | "bentley"
    | "memory"
    | "voice"
    | "agentNetwork",
    RuntimeCapabilityState
  >;
  /** Human-readable notes (e.g. test chat vs dashboard orchestrator). */
  capabilityNotes: string[];
  /** Unified resolver diagnostics for Test Chat (ai_agency_test_chat). */
  unifiedDiagnostics: UnifiedAgentRuntimeContext["diagnostics"];
  /** Owner-safe unified SKIPPER cognitive slice (Test Chat) — no full system prompt, no secrets. */
  skipperUnifiedRuntime?: {
    version: string;
    orchestrationLevel: string;
    diagnostics: UnifiedSkipperCognitiveDiagnostics;
    voiceProfile: UnifiedSkipperVoiceProfile | null;
  } | null;
};

function parseToolsJson(raw: string | null | undefined): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Builds the same system prompt stack used by {@link runAgentTest} (for diagnostics / previews).
 */
export async function buildAgentTestSystemPromptPreview(params: {
  agentId: string;
  userId: number;
}): Promise<{
  runtimeType: AgentRuntimeType;
  systemPrompt: string;
  kbEntries: number;
  retrievalEnabled: boolean;
}> {
  const db = await getDb();
  const unified = await resolveUnifiedAgentRuntimeContext(db, {
    entryPoint: "ai_agency_test_chat",
    userId: params.userId,
    agentId: params.agentId,
    knowledgeUserMessage: "",
  });

  const [kbRow] = await db
    .select({ c: count() })
    .from(aiAgentKnowledgeItems)
    .where(eq(aiAgentKnowledgeItems.agentId, params.agentId));
  const kbEntries = Number(kbRow?.c ?? 0);

  return {
    runtimeType: unified.runtimeType,
    systemPrompt: unified.systemPrompt,
    kbEntries,
    retrievalEnabled: kbEntries > 0,
  };
}

export async function getAgentRuntimeDiagnostics(
  agentId: string,
  userId: number,
): Promise<AgentRuntimeDiagnostics | null> {
  const db = await getDb();
  const rows = await db
    .select({
      name: aiAgents.name,
      systemPrompt: aiAgents.systemPrompt,
      agentRuntimeType: aiAgents.agentRuntimeType,
      toolsJson: aiAgents.toolsJson,
      llmEndpoint: aiAgents.llmEndpoint,
      llmApiKeyEnc: aiAgents.llmApiKeyEnc,
      model: aiAgents.model,
      voiceId: aiAgents.voiceId,
      voiceProvider: aiAgents.voiceProvider,
    })
    .from(aiAgents)
    .where(eq(aiAgents.id, agentId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const runtimeType = resolveAgentRuntimeType({
    agentRuntimeType: row.agentRuntimeType,
    name: row.name,
  });

  const [kbRow] = await db
    .select({ c: count() })
    .from(aiAgentKnowledgeItems)
    .where(eq(aiAgentKnowledgeItems.agentId, agentId));
  const kbEntries = Number(kbRow?.c ?? 0);

  const tools = parseToolsJson(
    typeof row.toolsJson === "string" ? row.toolsJson : row.toolsJson != null ? JSON.stringify(row.toolsJson) : ""
  );
  const crmEnabled = tools.crm === true;
  const analyticsEnabled =
    Boolean(process.env.OPENAI_API_KEY?.trim()) ||
    tools.siteContext === true ||
    tools.automations === true;

  const bentleyBridgeEnabled =
    Boolean(process.env.REVENUE_OS_BENTLEY_ENABLED) ||
    Boolean(process.env.BENTLEY_EXECUTIVE_BRIDGE_ENABLED) ||
    tools.automations === true;

  const agentLlmConfig = row.llmEndpoint?.trim()
    ? { llmEndpoint: row.llmEndpoint, llmApiKeyEnc: row.llmApiKeyEnc, model: row.model }
    : null;

  const llmOk = hasLlmEndpoint(agentLlmConfig);
  const fallbackReason: string | null = !llmOk ? "no_llm_endpoint_configured" : null;

  const [sess] = await db
    .select({ sessionKey: agentConversationSessions.sessionKey })
    .from(agentConversationSessions)
    .where(eq(agentConversationSessions.agentId, agentId))
    .limit(1);
  const memoryEnabled = Boolean(sess);

  const resolvedCaps = await resolveAgentCapabilities(agentId);
  const agentNetworkOk = resolvedCaps.executableActions.length > 0;

  const orchestratorApiAvailable = true;
  const orchestratorInAgentTest = false;

  const unified = await resolveUnifiedAgentRuntimeContext(db, {
    entryPoint: "ai_agency_test_chat",
    userId,
    agentId,
    knowledgeUserMessage: "",
  });

  const { systemPrompt: activeSystemPrompt } = unified;

  const connectedAgents = [
    llmOk ? "LLM (Custom API or NPC_LLM_ENDPOINT)" : null,
    orchestratorApiAvailable ? "Executive Orchestrator API (/api/admin/executive-agent/chat)" : null,
    analyticsEnabled ? "Analytics / site context signals" : null,
    crmEnabled ? "CRM tools" : null,
    bentleyBridgeEnabled ? "Bentley / Revenue OS hooks" : null,
    memoryEnabled ? "Memory (conversation sessions)" : null,
    row.voiceId ? `Voice (${row.voiceProvider ?? "provider"}:${row.voiceId})` : null,
    agentNetworkOk ? "Agent tool network (Google plugins)" : null,
  ].filter(Boolean) as string[];

  const capabilityNotes: string[] = [];
  let skipperUnifiedRuntime: AgentRuntimeDiagnostics["skipperUnifiedRuntime"] = null;
  if (runtimeType === "executive_admin") {
    capabilityNotes.push(
      "Test Chat uses lightweight SKIPPER runtime. Full orchestration runs in Executive Administration.",
    );
    const cognitive = await resolveUnifiedSkipperRuntimeContext({
      surface: "ai_agency_test",
      db,
      userId,
      agentId,
      knowledgeUserMessage: "",
    });
    if (cognitive) {
      skipperUnifiedRuntime = {
        version: UNIFIED_SKIPPER_RUNTIME_VERSION,
        orchestrationLevel: cognitive.orchestrationLevel,
        diagnostics: cognitive.diagnostics,
        voiceProfile: cognitive.voiceProfile,
      };
    }
  }

  const capabilities: AgentRuntimeDiagnostics["capabilities"] = {
    executiveOrchestrator: orchestratorApiAvailable
      ? orchestratorInAgentTest
        ? "connected"
        : "partial"
      : "disconnected",
    analytics: analyticsEnabled ? "connected" : "disconnected",
    crm: crmEnabled ? "connected" : "disconnected",
    bentley: bentleyBridgeEnabled ? "partial" : "disconnected",
    memory: memoryEnabled ? "connected" : "disconnected",
    voice: row.voiceId ? "connected" : "disconnected",
    agentNetwork: agentNetworkOk ? "connected" : "disconnected",
  };

  return {
    runtimeType,
    activeSystemPrompt: activeSystemPrompt.slice(0, 1200),
    retrievalEnabled: kbEntries > 0,
    kbEntries,
    memoryEnabled,
    orchestratorEnabled: orchestratorApiAvailable,
    analyticsEnabled,
    crmEnabled,
    bentleyBridgeEnabled,
    connectedAgents,
    fallbackReason,
    capabilities,
    capabilityNotes,
    unifiedDiagnostics: unified.diagnostics,
    skipperUnifiedRuntime,
  };
}
