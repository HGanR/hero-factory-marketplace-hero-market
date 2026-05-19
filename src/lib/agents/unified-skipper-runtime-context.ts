import "server-only";

import { and, asc, count, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { agentConversationSessions, aiAgents, aiAgentKnowledgeItems } from "@/lib/db/schema";
import type { NPCProfile } from "@/lib/npc/types";
import { resolveAgentRuntimeType, type AgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import {
  buildAuthoritativeExecutiveAdminPromptStack,
  buildExecutiveAdminNpcLlmPersonaSection,
  buildExecutiveTrooWorldSystemAddendum,
  buildExecutiveIntentPlannerSystemPrompt,
  applyAgentRuntimePromptLayers,
  isSkipperExecutiveNpcProfile,
} from "@/lib/agents/executive-admin-system-prompt";
import { buildKnowledgeContextFromRows } from "@/lib/agents/retrieval";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import { getSelfHostedTtsHealthReport, isSelfHostedTtsHealthReady } from "@/lib/voices/self-hosted-tts-health";
import { isSelfHostedVoiceEngineConfigured } from "@/lib/voices/voice-provider";

export type UnifiedRuntimeEntryPoint =
  | "ai_agency_test_chat"
  | "executive_dashboard"
  | "voice_runtime"
  | "npc_chat"
  | "troo_world_npc_chat";

export type OrchestrationMode =
  | "full_orchestrator"
  | "lightweight_agent_llm"
  | "npc_rule_engine"
  | "npc_llm_bridge"
  | "troo_world_openai";

export type UnifiedAgentRuntimeContext = {
  runtimeType: AgentRuntimeType;
  systemPrompt: string;
  orchestrationMode: OrchestrationMode;
  connectedTools: Record<string, boolean>;
  kbEnabled: boolean;
  memoryEnabled: boolean;
  analyticsEnabled: boolean;
  executiveCapabilities: Record<string, boolean>;
  voiceCapabilities: {
    browserTts: boolean;
    serverSpeakRoute: boolean;
    selfHostedConfigured: boolean;
  };
  diagnostics: {
    entryPoint: UnifiedRuntimeEntryPoint;
    runtimeStack: string[];
    orchestrationLevel: "full" | "lightweight" | "npc" | "troo_world";
    activePromptLayers: string[];
    connectedDataSources: string[];
    fallbackFlags: string[];
  };
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

function defaultExecutiveCapabilities(): Record<string, boolean> {
  return {
    analytics: true,
    crm: true,
    bentley: true,
    executiveMemory: true,
    routines: true,
    approvals: true,
    followUpIntelligence: true,
    connectedAgents: true,
  };
}

function orchestratorLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.NPC_LLM_ENDPOINT?.trim());
}

/**
 * Single resolver for SKIPPER / executive_admin identity across AI Agency, Executive dashboard, NPC, Troo World, and voice runtime.
 */
export async function resolveUnifiedAgentRuntimeContext(
  db: MySql2Database<typeof schema>,
  input:
    | {
        entryPoint: "ai_agency_test_chat";
        userId: number;
        agentId: string;
        knowledgeUserMessage: string;
      }
    | { entryPoint: "executive_dashboard" | "voice_runtime"; adminUserId: number }
    | { entryPoint: "npc_chat"; profile: NPCProfile; knowledgeEntryCount: number }
    | {
        entryPoint: "troo_world_npc_chat";
        npcName: string;
        npcRole: string;
        hasKnowledgeDocs: boolean;
        personalitySystemPrompt?: string | null;
      }
): Promise<UnifiedAgentRuntimeContext> {
  const fallbackFlags: string[] = [];
  const runtimeStack = ["resolveUnifiedAgentRuntimeContext", input.entryPoint];
  const selfHostedHealth = await getSelfHostedTtsHealthReport();
  const voiceCapabilities = {
    browserTts: true,
    serverSpeakRoute: true,
    selfHostedConfigured: isSelfHostedVoiceEngineConfigured() && isSelfHostedTtsHealthReady(selfHostedHealth),
  };

  if (input.entryPoint === "ai_agency_test_chat") {
    const rows = await db
      .select({
        name: aiAgents.name,
        systemPrompt: aiAgents.systemPrompt,
        agentRuntimeType: aiAgents.agentRuntimeType,
        toolsJson: aiAgents.toolsJson,
      })
      .from(aiAgents)
      .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.userId, input.userId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      fallbackFlags.push("agent_row_missing");
      return emptyContext(input.entryPoint, fallbackFlags, runtimeStack, voiceCapabilities);
    }
    const runtimeType = resolveAgentRuntimeType({
      agentRuntimeType: row.agentRuntimeType,
      name: row.name,
    });
    const knowledgeRows = await db
      .select({
        id: aiAgentKnowledgeItems.id,
        contentOrPointer: aiAgentKnowledgeItems.contentOrPointer,
        type: aiAgentKnowledgeItems.type,
      })
      .from(aiAgentKnowledgeItems)
      .where(eq(aiAgentKnowledgeItems.agentId, input.agentId))
      .orderBy(asc(aiAgentKnowledgeItems.sortOrder));
    const kbEnabled = knowledgeRows.length > 0;
    const knowledgeContext = buildKnowledgeContextFromRows(knowledgeRows, input.knowledgeUserMessage, 8);
    const [mem] = await db
      .select({ c: count() })
      .from(agentConversationSessions)
      .where(eq(agentConversationSessions.agentId, input.agentId));
    const memoryEnabled = Number(mem?.c ?? 0) > 0;
    const tools = parseToolsJson(
      typeof row.toolsJson === "string" ? row.toolsJson : row.toolsJson != null ? JSON.stringify(row.toolsJson) : ""
    );
    const caps = await resolveAgentCapabilities(input.agentId);
    const connectedTools: Record<string, boolean> = {};
    for (const a of caps.executableActions.slice(0, 24)) {
      connectedTools[a.actionKey] = true;
    }
    const analyticsEnabled =
      tools.crm === true ||
      tools.siteContext === true ||
      tools.automations === true ||
      Boolean(process.env.OPENAI_API_KEY?.trim());

    if (runtimeType !== "executive_admin") {
      const systemPrompt = applyAgentRuntimePromptLayers({
        runtimeType,
        baseSystemPrompt: row.systemPrompt || "You are a helpful assistant.",
        kbEntryCount: knowledgeRows.length,
        knowledgeContextSuffix: knowledgeContext,
      });
      return {
        runtimeType,
        systemPrompt,
        orchestrationMode: "lightweight_agent_llm",
        connectedTools,
        kbEnabled,
        memoryEnabled,
        analyticsEnabled,
        executiveCapabilities: defaultExecutiveCapabilities(),
        voiceCapabilities,
        diagnostics: {
          entryPoint: input.entryPoint,
          runtimeStack,
          orchestrationLevel: "lightweight",
          activePromptLayers: ["non_executive_runtime"],
          connectedDataSources: Object.keys(connectedTools).slice(0, 12),
          fallbackFlags,
        },
      };
    }

    const stack = buildAuthoritativeExecutiveAdminPromptStack({
      ownerInstructions: row.systemPrompt || "You are a helpful assistant.",
      knowledgeContextSuffix: knowledgeContext,
      kbEntryCount: knowledgeRows.length,
    });

    if (!orchestratorLlmConfigured()) fallbackFlags.push("orchestrator_llm_env_optional_for_test_chat");

    return {
      runtimeType: "executive_admin",
      systemPrompt: stack.systemPrompt,
      orchestrationMode: "lightweight_agent_llm",
      connectedTools,
      kbEnabled,
      memoryEnabled,
      analyticsEnabled,
      executiveCapabilities: defaultExecutiveCapabilities(),
      voiceCapabilities,
      diagnostics: {
        entryPoint: input.entryPoint,
        runtimeStack,
        orchestrationLevel: "lightweight",
        activePromptLayers: stack.activePromptLayers,
        connectedDataSources: [
          "ai_agent_knowledge_items",
          "agent_plugin_tools",
          ...(memoryEnabled ? ["agent_conversation_sessions"] : []),
        ],
        fallbackFlags,
      },
    };
  } else if (input.entryPoint === "executive_dashboard" || input.entryPoint === "voice_runtime") {
    const deskPrompt = [
      buildExecutiveIntentPlannerSystemPrompt(),
      "",
      "(User-visible answers are produced by runExecutiveOrchestrator using read tools and executive desk context — this block aligns intent planning with SKIPPER executive_admin persona.)",
    ].join("\n");
    return {
      runtimeType: "executive_admin",
      systemPrompt: deskPrompt,
      orchestrationMode: "full_orchestrator",
      connectedTools: {},
      kbEnabled: true,
      memoryEnabled: true,
      analyticsEnabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
      executiveCapabilities: defaultExecutiveCapabilities(),
      voiceCapabilities,
      diagnostics: {
        entryPoint: input.entryPoint,
        runtimeStack,
        orchestrationLevel: "full",
        activePromptLayers: ["executive_intent_planner", "executive_capabilities", "orchestrator_read_tools"],
        connectedDataSources: [
          "executive_memory",
          "executive_knowledge",
          "site_analytics_rollups",
          "department_inbox",
          "question_history",
        ],
        fallbackFlags: orchestratorLlmConfigured() ? [] : ["orchestrator_llm_not_configured"],
      },
    };
  } else if (input.entryPoint === "npc_chat") {
    const p = input.profile;
    const isSkipper = isSkipperExecutiveNpcProfile(p);
    const systemPrompt = isSkipper
      ? buildExecutiveAdminNpcLlmPersonaSection(p.name)
      : `You are ${p.name}, a helpful NPC.`;
    return {
      runtimeType: isSkipper ? "executive_admin" : "general",
      systemPrompt,
      orchestrationMode: "npc_llm_bridge",
      connectedTools: {},
      kbEnabled: input.knowledgeEntryCount > 0,
      memoryEnabled: false,
      analyticsEnabled: isSkipper,
      executiveCapabilities: isSkipper ? defaultExecutiveCapabilities() : {},
      voiceCapabilities,
      diagnostics: {
        entryPoint: "npc_chat",
        runtimeStack,
        orchestrationLevel: "npc",
        activePromptLayers: isSkipper ? ["executive_npc_llm_persona", "executive_capabilities"] : ["npc_default"],
        connectedDataSources: ["oasis_npc_knowledge"],
        fallbackFlags,
      },
    };
  } else if (input.entryPoint === "troo_world_npc_chat") {
    const isExec = input.npcRole === "executive_admin";
    const base = input.personalitySystemPrompt?.trim() || `You are ${input.npcName}, a helpful assistant.`;
    const systemPrompt = isExec ? `${base}${buildExecutiveTrooWorldSystemAddendum()}` : base;
    return {
      runtimeType: isExec ? "executive_admin" : "general",
      systemPrompt,
      orchestrationMode: "troo_world_openai",
      connectedTools: {},
      kbEnabled: input.hasKnowledgeDocs,
      memoryEnabled: false,
      analyticsEnabled: isExec,
      executiveCapabilities: isExec ? defaultExecutiveCapabilities() : {},
      voiceCapabilities,
      diagnostics: {
        entryPoint: "troo_world_npc_chat",
        runtimeStack,
        orchestrationLevel: "troo_world",
        activePromptLayers: isExec ? ["troo_base", "executive_surface_addendum"] : ["troo_base"],
        connectedDataSources: isExec ? ["oasis_npc_knowledge", "openai_chat_completions"] : ["oasis_npc_knowledge"],
        fallbackFlags: Boolean(process.env.OPENAI_API_KEY?.trim()) ? [] : ["openai_missing_troo_fallback"],
      },
    };
  }

  fallbackFlags.push("unhandled_entry_point");
  return emptyContext(
    (input as { entryPoint: UnifiedRuntimeEntryPoint }).entryPoint,
    fallbackFlags,
    runtimeStack,
    voiceCapabilities,
  );
}

function emptyContext(
  entryPoint: UnifiedRuntimeEntryPoint,
  fallbackFlags: string[],
  runtimeStack: string[],
  voiceCapabilities: UnifiedAgentRuntimeContext["voiceCapabilities"]
): UnifiedAgentRuntimeContext {
  return {
    runtimeType: "general",
    systemPrompt: "You are a helpful assistant.",
    orchestrationMode: "lightweight_agent_llm",
    connectedTools: {},
    kbEnabled: false,
    memoryEnabled: false,
    analyticsEnabled: false,
    executiveCapabilities: {},
    voiceCapabilities,
    diagnostics: {
      entryPoint,
      runtimeStack,
      orchestrationLevel: "lightweight",
      activePromptLayers: [],
      connectedDataSources: [],
      fallbackFlags,
    },
  };
}
