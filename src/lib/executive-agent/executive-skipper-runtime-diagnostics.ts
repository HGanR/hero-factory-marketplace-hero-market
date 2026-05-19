import "server-only";

import { count, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { agentConversationSessions } from "@/lib/db/schema";
import { resolveAgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import { resolveUnifiedAgentRuntimeContext, type UnifiedAgentRuntimeContext } from "@/lib/agents/unified-skipper-runtime-context";
import { getPreferredSkipperAgentRowForUser, getSkipperOutputVoiceForUser } from "@/lib/voices/executive-skipper-output-voice";
import {
  resolveUnifiedSkipperRuntimeContext,
  type UnifiedSkipperCognitiveDiagnostics,
  type UnifiedSkipperVoiceProfile,
  UNIFIED_SKIPPER_RUNTIME_VERSION,
} from "@/lib/agents/skipper-unified-runtime";
import { getSelfHostedTtsHealthReport, isSelfHostedTtsHealthReady } from "@/lib/voices/self-hosted-tts-health";
import { VOICE_PROVIDER_ELEVENLABS, VOICE_PROVIDER_OPENAI, VOICE_PROVIDER_SELF_HOSTED_TTS } from "@/lib/voices/voice-provider";
import { probeSkipperPromptOverlaysTableStatus, type SkipperPromptOverlaysTableStatus } from "@/lib/executive-agent/skipper-learning-store";

export type ExecutiveSkipperUnifiedSnapshot = Pick<
  UnifiedAgentRuntimeContext,
  | "runtimeType"
  | "orchestrationMode"
  | "diagnostics"
  | "executiveCapabilities"
  | "voiceCapabilities"
  | "kbEnabled"
  | "memoryEnabled"
  | "analyticsEnabled"
>;

/** Non-secret provenance for dashboard strips (no API keys / tokens). */
export type ExecutiveSkipperFieldSources = {
  skipperRuntimeType: "db" | "not_configured";
  skipperVoiceProvider: "db" | "not_configured";
  skipperVoiceId: "db" | "not_configured";
  analyticsToolAvailable: "db" | "fallback";
  memoryAvailable: "db";
};

export type ExecutiveSkipperRuntimeDiagnostics = {
  skipperRuntimeType: string;
  skipperVoiceProvider: string | null;
  skipperVoiceId: string | null;
  selfHostedHealth: Awaited<ReturnType<typeof getSelfHostedTtsHealthReport>>;
  executiveOrchestratorConnected: boolean;
  analyticsToolAvailable: boolean;
  memoryAvailable: boolean;
  /** Executive desk can queue write intents to the approvals table (orchestrator path). */
  approvalsAvailable: boolean;
  /** Automations / Revenue OS style hooks when tools or env expose them (advisory). */
  routinesAvailable: boolean;
  fallbackReason: string | null;
  capabilityNotes: string[];
  fieldSources: ExecutiveSkipperFieldSources;
  /** Unified resolver slices (no full system prompts). */
  unifiedExecutiveDashboard?: ExecutiveSkipperUnifiedSnapshot;
  unifiedVoiceRuntime?: ExecutiveSkipperUnifiedSnapshot;
  unifiedAiAgencyTestChat?: ExecutiveSkipperUnifiedSnapshot | null;
  /** Unified cognitive runtime snapshot (admin Executive path) — no system prompt body. */
  skipperUnifiedRuntime?: {
    version: string;
    orchestrationLevel: string;
    diagnostics: UnifiedSkipperCognitiveDiagnostics;
    voiceProfile: UnifiedSkipperVoiceProfile | null;
  } | null;
  /** Whether `skipper_prompt_overlays` exists and is queryable (or missing / error). */
  promptOverlaysStatus: SkipperPromptOverlaysTableStatus;
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

function orchestratorLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.NPC_LLM_ENDPOINT?.trim());
}

function snapshotUnified(u: UnifiedAgentRuntimeContext): ExecutiveSkipperUnifiedSnapshot {
  return {
    runtimeType: u.runtimeType,
    orchestrationMode: u.orchestrationMode,
    diagnostics: u.diagnostics,
    executiveCapabilities: u.executiveCapabilities,
    voiceCapabilities: u.voiceCapabilities,
    kbEnabled: u.kbEnabled,
    memoryEnabled: u.memoryEnabled,
    analyticsEnabled: u.analyticsEnabled,
  };
}

/**
 * Admin-only SKIPPER + self-hosted voice wiring snapshot. Never includes API keys or raw env secrets.
 *
 * Identity row vs voice row: identity (`skipperRuntimeType`) uses the top-ranked active SKIPPER agent
 * (executive_admin first, then `updatedAt`). Voice fields use the first ranked row that has a supported
 * `voiceProvider` + `voiceId` (see `getSkipperOutputVoiceForUser`).
 */
export async function buildExecutiveSkipperRuntimeDiagnostics(
  db: MySql2Database<typeof schema>,
  adminUserId: number
): Promise<ExecutiveSkipperRuntimeDiagnostics> {
  const [selfHostedHealth, promptOverlaysStatus] = await Promise.all([
    getSelfHostedTtsHealthReport(),
    probeSkipperPromptOverlaysTableStatus(db),
  ]);

  const [unifiedExecutiveDashboardCtx, unifiedVoiceRuntimeCtx, preferredRow, voicePick] = await Promise.all([
    resolveUnifiedAgentRuntimeContext(db, { entryPoint: "executive_dashboard", adminUserId }),
    resolveUnifiedAgentRuntimeContext(db, { entryPoint: "voice_runtime", adminUserId }),
    getPreferredSkipperAgentRowForUser(db, adminUserId),
    getSkipperOutputVoiceForUser(db, adminUserId),
  ]);
  const unifiedExecutiveDashboard = snapshotUnified(unifiedExecutiveDashboardCtx);
  const unifiedVoiceRuntime = snapshotUnified(unifiedVoiceRuntimeCtx);

  const capabilityNotes = [
    "Executive Administration (text + /voice/turn) uses runExecutiveOrchestrator with read tools; writes surface as approvals only — never auto-executed from chat.",
    "Test Chat uses lightweight SKIPPER runtime. Full orchestration runs in Executive Administration (/api/admin/executive-agent/chat).",
  ];

  let skipperUnifiedRuntime: ExecutiveSkipperRuntimeDiagnostics["skipperUnifiedRuntime"] = null;
  if (preferredRow) {
    const cognitive = await resolveUnifiedSkipperRuntimeContext({
      surface: "admin_executive_chat",
      db,
      adminUserId,
      deskPrompt: "What do you do?",
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

  if (!preferredRow) {
    return {
      skipperRuntimeType: "none",
      skipperVoiceProvider: null,
      skipperVoiceId: null,
      selfHostedHealth,
      executiveOrchestratorConnected: orchestratorLlmConfigured(),
      analyticsToolAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
      memoryAvailable: false,
      approvalsAvailable: orchestratorLlmConfigured(),
      routinesAvailable: false,
      fallbackReason: "no_skipper_agent_for_admin_user",
      capabilityNotes,
      fieldSources: {
        skipperRuntimeType: "not_configured",
        skipperVoiceProvider: "not_configured",
        skipperVoiceId: "not_configured",
        analyticsToolAvailable: "fallback",
        memoryAvailable: "db",
      },
      unifiedExecutiveDashboard,
      unifiedVoiceRuntime,
      unifiedAiAgencyTestChat: null,
      skipperUnifiedRuntime: null,
      promptOverlaysStatus,
    };
  }

  const skipperRuntimeType = resolveAgentRuntimeType({
    agentRuntimeType: preferredRow.agentRuntimeType,
    name: preferredRow.name,
  });
  const skipperVoiceProvider = voicePick?.voiceProvider?.trim().toLowerCase() ?? null;
  const skipperVoiceId = voicePick?.voiceId?.trim() ?? null;

  const tools = parseToolsJson(
    typeof preferredRow.toolsJson === "string"
      ? preferredRow.toolsJson
      : preferredRow.toolsJson != null
        ? JSON.stringify(preferredRow.toolsJson)
        : ""
  );
  const analyticsFromTools = tools.siteContext === true || tools.automations === true || tools.crm === true;
  const analyticsToolAvailable = analyticsFromTools || Boolean(process.env.OPENAI_API_KEY?.trim());

  const agentIdForMemory = voicePick?.agentId ?? preferredRow.id;
  const [mem] = await db
    .select({ c: count() })
    .from(agentConversationSessions)
    .where(eq(agentConversationSessions.agentId, agentIdForMemory));
  const memoryAvailable = Number(mem?.c ?? 0) > 0;

  const reasons: string[] = [];
  if (!orchestratorLlmConfigured()) {
    reasons.push("orchestrator_llm_not_configured");
  }
  const supportedVoice =
    skipperVoiceProvider === VOICE_PROVIDER_SELF_HOSTED_TTS ||
    skipperVoiceProvider === VOICE_PROVIDER_ELEVENLABS ||
    skipperVoiceProvider === VOICE_PROVIDER_OPENAI;
  if (!skipperVoiceId || !supportedVoice) {
    reasons.push("skipper_voice_missing_or_unsupported_provider");
  }
  if (skipperVoiceProvider === VOICE_PROVIDER_SELF_HOSTED_TTS && !isSelfHostedTtsHealthReady(selfHostedHealth)) {
    reasons.push("self_hosted_engine_not_ready");
  }

  const routinesAvailable =
    tools.automations === true ||
    Boolean(process.env.REVENUE_OS_BENTLEY_ENABLED) ||
    Boolean(process.env.BENTLEY_EXECUTIVE_BRIDGE_ENABLED);

  let unifiedAiAgencyTestChat: ExecutiveSkipperUnifiedSnapshot | null = null;
  if (skipperRuntimeType === "executive_admin") {
    unifiedAiAgencyTestChat = snapshotUnified(
      await resolveUnifiedAgentRuntimeContext(db, {
        entryPoint: "ai_agency_test_chat",
        userId: adminUserId,
        agentId: preferredRow.id,
        knowledgeUserMessage: "What do you do?",
      }),
    );
  }

  return {
    skipperRuntimeType,
    skipperVoiceProvider,
    skipperVoiceId,
    selfHostedHealth,
    executiveOrchestratorConnected: orchestratorLlmConfigured(),
    analyticsToolAvailable,
    memoryAvailable,
    approvalsAvailable: true,
    routinesAvailable,
    fallbackReason: reasons.length ? reasons.join(";") : null,
    capabilityNotes,
    fieldSources: {
      skipperRuntimeType: "db",
      skipperVoiceProvider: skipperVoiceProvider ? "db" : "not_configured",
      skipperVoiceId: skipperVoiceId ? "db" : "not_configured",
      analyticsToolAvailable: analyticsFromTools ? "db" : "fallback",
      memoryAvailable: "db",
    },
    unifiedExecutiveDashboard,
    unifiedVoiceRuntime,
    unifiedAiAgencyTestChat,
    skipperUnifiedRuntime,
    promptOverlaysStatus,
  };
}
