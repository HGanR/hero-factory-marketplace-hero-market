"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Mic } from "lucide-react";
import { FulfillmentOrdersPanel } from "./FulfillmentOrdersPanel";
import { TrustFulfillmentOrdersPanel } from "./TrustFulfillmentOrdersPanel";
import { RevenueOsFulfillmentPanel } from "./RevenueOsFulfillmentPanel";
import { SmartTrustOperationsPanel } from "./SmartTrustOperationsPanel";
import { ExecutiveOperationsBriefingPanel } from "./ExecutiveOperationsBriefingPanel";
import { OperationalMemoryInsightsPanel } from "./OperationalMemoryInsightsPanel";
import { ExecutiveKpiOverviewPanel } from "./ExecutiveKpiOverviewPanel";
import { FulfillmentForecastPanel } from "./FulfillmentForecastPanel";
import { OperationalHealthPanel } from "./OperationalHealthPanel";
import { ForecastRiskPanel } from "./ForecastRiskPanel";
import { ExecutiveOperatorPanel } from "./ExecutiveOperatorPanel";
import { OperatorWorkloadPanel } from "./OperatorWorkloadPanel";
import { DelegationQueuePanel } from "./DelegationQueuePanel";
import { EscalationPanel } from "./EscalationPanel";
import { ExecutiveSimulationPanel } from "./ExecutiveSimulationPanel";
import { SimulationForecastPanel } from "./SimulationForecastPanel";
import { ScenarioComparisonPanel } from "./ScenarioComparisonPanel";
import { BottleneckCascadePanel } from "./BottleneckCascadePanel";
import { ExecutiveKnowledgeGraphPanel } from "./ExecutiveKnowledgeGraphPanel";
import { StrategicMemoryPanel } from "./StrategicMemoryPanel";
import { OrganizationalIntelligencePanel } from "./OrganizationalIntelligencePanel";
import { HistoricalContextPanel } from "./HistoricalContextPanel";
import { ExecutivePlanningPanel } from "./ExecutivePlanningPanel";
import { RecoveryPlanningPanel } from "./RecoveryPlanningPanel";
import { StaffingPlanningPanel } from "./StaffingPlanningPanel";
import { InitiativePlanningPanel } from "./InitiativePlanningPanel";
import { ExecutiveCommandCenterPanel } from "./ExecutiveCommandCenterPanel";
import { IncidentIntelligencePanel } from "./IncidentIntelligencePanel";
import { LiveOperationalFeedPanel } from "./LiveOperationalFeedPanel";
import { GovernanceAlertPanel } from "./GovernanceAlertPanel";
import { CrisisCoordinationPanel } from "./CrisisCoordinationPanel";
import { CrossAgentEscalationPanel } from "./CrossAgentEscalationPanel";
import { ExecutiveAgentCoordinationPanel } from "./ExecutiveAgentCoordinationPanel";
import { AgentWorkspacePanel } from "./AgentWorkspacePanel";
import { AgentRoutingPanel } from "./AgentRoutingPanel";
import { ExecutionApprovalPanel } from "./ExecutionApprovalPanel";
import { RollbackControlPanel } from "./RollbackControlPanel";
import { AutomationHistoryPanel } from "./AutomationHistoryPanel";
import { ExecutiveSubjectAgentChatPanel } from "./ExecutiveSubjectAgentChatPanel";
import { ExecutiveSubjectNavBar } from "./ExecutiveSubjectNavBar";
import { ExecutiveSubjectWorkspacePanel } from "./ExecutiveSubjectWorkspacePanel";
import { SubjectThreadSidebar } from "./SubjectThreadSidebar";
import { ExecutiveThreadPanel } from "./ExecutiveThreadPanel";
import { FulfillmentThreadView } from "./FulfillmentThreadView";
import { ExecutiveDecisionQueuePanel } from "./ExecutiveDecisionQueuePanel";
import { ExecutiveTaskQueuePanel } from "./ExecutiveTaskQueuePanel";
import { ExecutiveOrb } from "./ExecutiveOrb";
import type { ExecutiveOrbCanvasProps } from "./ExecutiveOrbCanvas";
import { VoiceCommandDiagnosticsPanel, type ExecutiveVoiceDiagnostics } from "./VoiceCommandDiagnosticsPanel";
import {
  connectedSystemsFromRuntimePayload,
  deriveExecutiveVoiceState,
  firstSelectedReadToolFromInsights,
  orchestrationLevelDisplayFromPayload,
  runtimeTypeDisplayFromPayload,
  type SpeakExecutiveAnswerPath,
} from "./voice-diagnostics-utils";
import { useVoiceFrequency } from "./useVoiceFrequency";
import {
  hasBrowserSpeechRecognitionCtor,
  isFirefoxBrowser,
  isSelfHostedSttHealthReady,
  resolveExecutiveSttProvider,
  type ExecutiveSttInputMode,
} from "@/lib/voices/stt-provider";
import {
  EXECUTIVE_AGENT_KEYS,
  createDefaultAgentIntelligenceRecords,
  filterAgentsByKeys,
  type AgentIntelligenceRecord,
  type ExecutiveAgentKey,
} from "@/lib/executive-agent/agent-intelligence-bus";
import type { LiveMetricsResponse } from "@/lib/executive-agent/executive-live-metrics";
import type { ExecutiveDashboardMode } from "@/lib/executive-agent/executive-agent-chat-request";
import { EXECUTIVE_DASHBOARD_MODES } from "@/lib/executive-agent/executive-agent-chat-request";
import {
  getExecutiveSubject,
  subjectIdFromBottomTab,
  type ExecutiveSubjectConfig,
  type ExecutiveSubjectId,
} from "@/lib/executive-agent/executive-subject-nav";
import {
  ExecutiveInboxAttachmentsList,
  formatExecutiveInboxTimestamp,
  parseInboxAttachmentsJson,
} from "@/components/executive-inbox/ExecutiveInboxAttachmentsBlock";

type ExecutiveOrbMode = ExecutiveOrbCanvasProps["mode"];

type SummaryJson = {
  pendingAccounts?: { pendingAllTime?: number; pendingApprox30d?: number };
  approvedAccounts?: { approvedActive?: number; approvedInactive?: number };
  platform?: { marketplaceUsers?: number; crmClients?: number; socialCampaigns?: number };
  inbox?: { threadsLast7d?: number; unavailable?: boolean };
  bentleyBridge?: {
    platform?: {
      latestCadenceRuns?: unknown[];
      campaignsWithBentleyPayloadApprox?: number | null;
      postsScheduledApprox?: number | null;
      postsBlockedOrDraftUnscheduledApprox?: number | null;
      pendingExecutiveApprovalsForAdmin?: number | null;
      content360PlatformConfigured?: boolean;
      notes?: string[];
      unavailable?: boolean;
    };
    clientScoped?: { campaignsWithPayload?: number | null; scheduledPosts?: number | null; stuckDraftOrFailed?: number | null; notes?: string[] } | null;
  };
  generatedAt?: string;
};

type SelfHostedExecutiveHealth = {
  configured: boolean;
  enabled: boolean;
  baseUrlPresent: boolean;
  reachable: boolean;
  createEndpointKnown: boolean;
  speakEndpointKnown: boolean;
  message: string;
  uiLabel: string;
};

function executiveSelfHostedVoiceReady(h: SelfHostedExecutiveHealth | null): boolean {
  return Boolean(h && h.configured && h.reachable && h.createEndpointKnown && h.speakEndpointKnown);
}

function formatSelfHostedVoiceHealth(
  h: SelfHostedExecutiveHealth | null,
  outputVoiceProvider: string | null | undefined,
): string | null {
  if (outputVoiceProvider !== "self_hosted_tts") return null;
  if (!h) return "Not configured";
  if (executiveSelfHostedVoiceReady(h)) return "Ready";
  if (h.configured && !h.reachable) return "Unreachable";
  if (h.configured) return "Configured";
  return "Not configured";
}

type SelfHostedSttHealthState = {
  configured: boolean;
  enabled: boolean;
  baseUrlPresent: boolean;
  reachable: boolean;
  transcribeEndpointKnown: boolean;
  message: string;
  uiLabel: string;
};

function pickMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const c of cands) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

type ChatResult = {
  answer?: string;
  insights?: Array<{ title: string; detail: string }>;
  recommendedActions?: Array<{ title: string; description: string }>;
  charts?: Array<{ title: string; series: Array<{ label: string; value: number }> }>;
  requiresApproval?: Array<{ id: string; title: string; proposedAction: string }>;
  suggestedMemoryItems?: Array<{
    memoryType: string;
    subjectType?: string | null;
    subjectId?: string | null;
    title: string;
    summary: string;
    suggestionSource: "chat" | "voice";
    confidence: number;
  }>;
  plannerMeta?: {
    reasoningMode: "deterministic" | "llm" | "llm_fallback";
    confidence: number;
    proposedApprovalsCount: number;
    voiceShortCircuit?: "greeting" | "analytics_clarification";
    pendingVoiceIntent?: { intent: "analytics_clarification"; createdAt: string };
  };
  pendingVoiceIntent?: { intent: string; createdAt: string } | null;
};

type DailyBriefingView = {
  headline?: string;
  priorities?: Array<{ title: string; detail: string }>;
  risks?: Array<{ title: string; detail: string }>;
  opportunities?: Array<{ title: string; detail: string }>;
  approvalsNeeded?: Array<{ id: string; title: string; proposedAction: string }>;
  clientFollowUps?: Array<{ title: string; detail: string }>;
  agentSignals?: Array<{ title: string; detail: string }>;
  bentleyStatus?: { headline?: string; detail?: string; notes?: string[]; unavailable?: boolean };
  systemHealth?: { database?: string; apiServices?: string; executiveReadTools?: string; note?: string };
  suggestedFirstActions?: Array<{ title: string; detail: string }>;
};

type ApprovalRow = {
  id: string;
  proposedAction: string;
  status: string;
  createdAt: Date | string | null;
  payloadJson: string;
};

type RecentConversationRow = {
  id: string;
  agentKey: string;
  displayName: string;
  clientId: string | null;
  userLabel: string;
  snippet: string;
  lastMessageAt: string;
  source: string;
};

type FollowUpRecommendationRow = {
  id: string;
  title: string;
  detail: string;
  severity: string;
  proposedAction: string;
  payloadTemplate: { note: string };
  requiresClientId: boolean;
};

type VoiceSessionJson = {
  sessionId?: string;
  provider?: string;
  transcript?: string | null;
  capabilities?: string[];
  status?: string;
  inputMode?: string;
  outputMode?: string;
  expiresAt?: string;
  clientConfig?: { locale?: string; hints?: Record<string, string> };
};

type VoiceRailTurn = {
  id: string;
  transcriptText: string;
  responseText: string;
  proposedApprovalsCount: number;
  createdAt?: string | null;
};

const DATA_PRESETS = ["ALL", "REALITY", "ELEANOR", "BENTLEY", "EXECUTIVE_ADMIN", "CUSTOM"] as const;
type DataPreset = (typeof DATA_PRESETS)[number];

const TIME_OPTIONS = ["LIVE", "1H", "24H", "7D", "30D"] as const;
const MODE_OPTIONS = [...EXECUTIVE_DASHBOARD_MODES];

const BOTTOM_TABS = [
  "Command Center",
  "CRM Intelligence",
  "AI Agents",
  "Site Builder",
  "Analytics",
  "Inbox",
  "Tasks",
  "Jarva",
  "Settings",
] as const;

const AGENT_LABEL: Record<ExecutiveAgentKey, string> = {
  reality: "Reality",
  eleanor: "Eleanor",
  bentley: "Bentley",
  executive_admin: "Executive Admin",
  skipper: "SKIPPER",
};

/** Domain label shown under agent name in the network panel. */
const AGENT_DOMAIN_LABEL: Record<ExecutiveAgentKey, string> = {
  reality: "ENGAGEMENT",
  eleanor: "ACCOUNTING",
  bentley: "REVENUE OS",
  executive_admin: "ADMIN",
  skipper: "NEXUS",
};

const SELF_HOSTED_STT_DEV_HINT =
  "Start npm run dev:self-hosted-stt and confirm http://127.0.0.1:8788/";

type VoiceDiagFields = Omit<
  ExecutiveVoiceDiagnostics,
  | "voiceState"
  | "voiceHealth"
  | "sttProvider"
  | "sttHealth"
  | "browserSttStatusLabel"
  | "selfHostedSttStatusLabel"
  | "openAiSttStatusLabel"
  | "ttsProvider"
  | "ttsHealth"
  | "effectiveStt"
  | "effectiveTts"
  | "sttDevHint"
  | "browserSttRoutingNote"
>;

const INITIAL_VOICE_DIAG_FIELDS: VoiceDiagFields = {
  lastTranscript: null,
  lastResponse: null,
  voiceShortCircuit: "none",
  pendingVoiceIntent: null,
  selectedTool: null,
  orchestrationLevel: null,
  runtimeType: null,
  voiceProvider: null,
  connectedSystems: [],
  lastError: null,
  speechRecognitionMs: null,
  orchestratorMs: null,
  ttsMs: null,
  sttHttpStatus: null,
  sttAudioBlobSize: null,
  sttTranscript: null,
  sttConfidence: null,
  sttError: null,
  promptOverlaysStatus: "unavailable",
};

const SECRET_PAYLOAD_KEY = /(apikey|api_key|secret|password|token|authorization)/i;

function formatApprovalPayloadPreview(payloadJson: string): string {
  try {
    const o = JSON.parse(payloadJson) as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (SECRET_PAYLOAD_KEY.test(k)) {
        redacted[k] = "[redacted]";
        continue;
      }
      if (typeof v === "string" && v.length > 400) redacted[k] = `${v.slice(0, 400)}…`;
      else redacted[k] = v;
    }
    const s = JSON.stringify(redacted, null, 2);
    return s.length > 1200 ? `${s.slice(0, 1200)}…` : s;
  } catch {
    return payloadJson.length > 800 ? `${payloadJson.slice(0, 800)}…` : payloadJson;
  }
}

function inboxNumericId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Admin inbox: map DB row to a readable From/To line using approved-user directory when available. */
function formatExecutiveInboxRoutingLine(
  m: Record<string, unknown>,
  recipients: Array<{ id: number; username: string; email: string }>,
  directory: Record<number, { username: string; email: string }>,
): string {
  const kind = String(m.kind ?? "");
  const fromUid = inboxNumericId(m.fromMarketplaceUserId);
  const toUid = inboxNumericId(m.toMarketplaceUserId);
  const fromAid = inboxNumericId(m.fromAdminUserId);
  const label = (uid: number | null) => {
    if (uid == null) return "—";
    const u = recipients.find((r) => r.id === uid);
    if (u) return `${u.username} · ${u.email} (id ${uid})`;
    const d = directory[uid];
    if (d) return `${d.username} · ${d.email} (id ${uid})`;
    return `Marketplace user id ${uid}`;
  };
  const adminFrom = fromAid != null ? `From executive admin: ${label(fromAid)}` : "From executive admin: —";
  if (kind === "user_to_executive") return `From member: ${label(fromUid)} → Executive Department`;
  if (kind === "executive_to_user") return `${adminFrom} · Direct to: ${label(toUid)}`;
  if (kind === "executive_broadcast") return `${adminFrom} · Broadcast to all approved accounts`;
  return kind || "message";
}

function agentsForPreset(preset: DataPreset, custom: Set<ExecutiveAgentKey>): ExecutiveAgentKey[] {
  if (preset === "ALL") return [...EXECUTIVE_AGENT_KEYS];
  if (preset === "REALITY") return ["reality"];
  if (preset === "ELEANOR") return ["eleanor"];
  if (preset === "BENTLEY") return ["bentley"];
  if (preset === "EXECUTIVE_ADMIN") return ["executive_admin"];
  const arr = [...custom];
  return arr.length ? arr : [...EXECUTIVE_AGENT_KEYS];
}

export function ExecutiveAgentDashboard() {
  const [prompt, setPrompt] = useState("");
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [summary, setSummary] = useState<SummaryJson | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetricsResponse | null>(null);
  const [liveMetricsError, setLiveMetricsError] = useState<string | null>(null);
  const [agentIntel, setAgentIntel] = useState<AgentIntelligenceRecord[]>([]);
  const [agentIntelError, setAgentIntelError] = useState<string | null>(null);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastChatTurn, setLastChatTurn] = useState<{ prompt: string; answer: string } | null>(null);
  const [learningFeedbackBusy, setLearningFeedbackBusy] = useState<string | null>(null);
  const [learningPendingPreview, setLearningPendingPreview] = useState<{
    improvements: number;
    capabilities: number;
    overlays: number;
  } | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [lastApprovalExec, setLastApprovalExec] = useState<{
    id: string;
    action: string;
    ok: boolean;
    message: string;
    status?: string;
  } | null>(null);
  const [recentConversations, setRecentConversations] = useState<RecentConversationRow[]>([]);
  const [recentConversationsError, setRecentConversationsError] = useState<string | null>(null);
  const [followUpRecommendations, setFollowUpRecommendations] = useState<FollowUpRecommendationRow[]>([]);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpQueueBusyId, setFollowUpQueueBusyId] = useState<string | null>(null);
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefingView | null>(null);
  const [dailyBriefingError, setDailyBriefingError] = useState<string | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [dismissedMemorySuggestions, setDismissedMemorySuggestions] = useState<Record<string, boolean>>({});
  const [memorySaveBusyKey, setMemorySaveBusyKey] = useState<string | null>(null);
  const [executiveRoutines, setExecutiveRoutines] = useState<
    Array<{
      id: string;
      routineType: string;
      cadence: string;
      enabled: boolean;
      lastRunAt?: string | null;
      nextRunAt?: string | null;
      lastOutputJson?: string | null;
    }>
  >([]);
  const [executiveRoutinesError, setExecutiveRoutinesError] = useState<string | null>(null);
  const [executiveRoutinesBusy, setExecutiveRoutinesBusy] = useState(false);
  const [busy, setBusy] = useState<"summary" | "chat" | "voice" | "voice_turn" | "live" | "intel" | null>(null);
  const [dataPreset, setDataPreset] = useState<DataPreset>("ALL");
  const [customAgents, setCustomAgents] = useState<Set<ExecutiveAgentKey>>(() => new Set(EXECUTIVE_AGENT_KEYS));
  const [timeRange, setTimeRange] = useState<(typeof TIME_OPTIONS)[number]>("LIVE");
  const [dashboardMode, setDashboardMode] = useState<ExecutiveDashboardMode>("OVERVIEW");
  const [bottomTab, setBottomTab] = useState<(typeof BOTTOM_TABS)[number]>("Command Center");
  const [activeSubjectId, setActiveSubjectId] = useState<ExecutiveSubjectId>("command_center");
  const [subjectChatOpen, setSubjectChatOpen] = useState(true);
  const [workspaceOrderId, setWorkspaceOrderId] = useState("");
  const [subjectSkipperContext, setSubjectSkipperContext] = useState<string | null>(null);
  const [selectedOpsThreadId, setSelectedOpsThreadId] = useState<string | null>(null);
  const [threadSkipperContext, setThreadSkipperContext] = useState<string | null>(null);
  const [decisionSkipperContext, setDecisionSkipperContext] = useState<string | null>(null);
  const [taskSkipperContext, setTaskSkipperContext] = useState<string | null>(null);
  const [threadSidebarKey, setThreadSidebarKey] = useState(0);
  const activeSubject = useMemo(() => getExecutiveSubject(activeSubjectId), [activeSubjectId]);
  const combinedSkipperWorkspaceContext = useMemo(() => {
    const parts = [
      subjectSkipperContext,
      threadSkipperContext,
      decisionSkipperContext,
      taskSkipperContext,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  }, [subjectSkipperContext, threadSkipperContext, decisionSkipperContext, taskSkipperContext]);

  const refreshDecisionContext = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        subjectId: activeSubjectId,
        promote: "true",
      });
      if (clientId.trim()) params.set("clientId", clientId.trim());
      if (workspaceOrderId.trim()) params.set("orderId", workspaceOrderId.trim());
      if (selectedOpsThreadId) params.set("threadId", selectedOpsThreadId);
      const r = await fetch(`/api/admin/executive-agent/decisions?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { skipperDecisionContext?: string };
      setDecisionSkipperContext(j.skipperDecisionContext ?? null);
    } catch {
      setDecisionSkipperContext(null);
    }
  }, [activeSubjectId, clientId, workspaceOrderId, selectedOpsThreadId]);

  useEffect(() => {
    void refreshDecisionContext();
  }, [refreshDecisionContext]);

  const refreshTaskContext = useCallback(async () => {
    try {
      const params = new URLSearchParams({ subjectId: activeSubjectId });
      if (clientId.trim()) params.set("clientId", clientId.trim());
      if (workspaceOrderId.trim()) params.set("orderId", workspaceOrderId.trim());
      if (selectedOpsThreadId) params.set("threadId", selectedOpsThreadId);
      const r = await fetch(`/api/admin/executive-agent/tasks?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { skipperTaskContext?: string };
      setTaskSkipperContext(j.skipperTaskContext ?? null);
    } catch {
      setTaskSkipperContext(null);
    }
  }, [activeSubjectId, clientId, workspaceOrderId, selectedOpsThreadId]);

  useEffect(() => {
    void refreshTaskContext();
  }, [refreshTaskContext]);

  const onOperationalCoordinationChange = useCallback(() => {
    setThreadSidebarKey((k) => k + 1);
    void refreshDecisionContext();
    void refreshTaskContext();
  }, [refreshDecisionContext, refreshTaskContext]);

  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSession, setVoiceSession] = useState<VoiceSessionJson | null>(null);
  const [voiceRailTurns, setVoiceRailTurns] = useState<VoiceRailTurn[]>([]);
  const [voiceSttBusy, setVoiceSttBusy] = useState(false);
  const [voiceApprovalFlash, setVoiceApprovalFlash] = useState(false);
  /** Server echoed pending analytics clarification (voice session). */
  const [voicePendingAnalytics, setVoicePendingAnalytics] = useState<{ intent: string; createdAt: string } | null>(
    null,
  );
  const [voiceDiagBase, setVoiceDiagBase] = useState<VoiceDiagFields>(() => ({ ...INITIAL_VOICE_DIAG_FIELDS }));
  const [voiceSttUnsupported, setVoiceSttUnsupported] = useState(false);
  const sttRef = useRef<{ stop: () => void } | null>(null);
  const execAudioRef = useRef<HTMLAudioElement | null>(null);
  const [executiveOutputVoice, setExecutiveOutputVoice] = useState<{ voiceId: string; voiceProvider: string } | null>(null);
  const [selfHostedHealth, setSelfHostedHealth] = useState<SelfHostedExecutiveHealth | null>(null);
  const [selfHostedSttHealth, setSelfHostedSttHealth] = useState<SelfHostedSttHealthState | null>(null);
  const [voicePreflight, setVoicePreflight] = useState<{
    openaiStt?: {
      apiKeyPresent?: boolean;
      executiveVoiceSttProviderEnv?: string | null;
      uiLabel?: string;
      message?: string;
    };
    elevenlabsTts?: { apiKeyPresent?: boolean; uiLabel?: string; message?: string };
    executiveVoiceTtsProviderEnv?: string | null;
    nextSteps?: string[];
  } | null>(null);
  const [voiceSttInputMode, setVoiceSttInputMode] = useState<ExecutiveSttInputMode>("auto");
  const [sttTestBusy, setSttTestBusy] = useState(false);
  const [sttTestTranscript, setSttTestTranscript] = useState<string | null>(null);
  const [hudClock, setHudClock] = useState(() => new Date());
  const [transcript, setTranscript] = useState("");
  const [simSpeaking, setSimSpeaking] = useState(false);
  const [activityFeed, setActivityFeed] = useState<string[]>([
    "Executive layer online — read tools scoped to default policy.",
    "Approvals queue connected.",
  ]);
  const [idlePulse, setIdlePulse] = useState(0.06);
  const [knowledgeDocs, setKnowledgeDocs] = useState<Array<{ id: string; title: string; sourceType: string; updatedAt?: Date | string | null }>>([]);
  const [knowledgeBusy, setKnowledgeBusy] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeBody, setKnowledgeBody] = useState("");
  const [knowledgeCrawlUrl, setKnowledgeCrawlUrl] = useState("");
  const [questionHistory, setQuestionHistory] = useState<
    Array<{ id: string; question: string; answer: string; source: string; createdAt?: Date | string | null }>
  >([]);
  const [inboxMessages, setInboxMessages] = useState<Array<Record<string, unknown>>>([]);
  const [inboxRecipients, setInboxRecipients] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [inboxDirectory, setInboxDirectory] = useState<Record<number, { username: string; email: string }>>({});
  type InboxPendingAttachment = {
    id: string;
    kind: "file" | "audio";
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  };
  const [inboxPendingAttachments, setInboxPendingAttachments] = useState<InboxPendingAttachment[]>([]);
  const [inboxRecording, setInboxRecording] = useState(false);
  const inboxFileInputRef = useRef<HTMLInputElement | null>(null);
  const inboxMrRef = useRef<MediaRecorder | null>(null);
  const inboxMrChunksRef = useRef<BlobPart[]>([]);
  const inboxMrStreamRef = useRef<MediaStream | null>(null);
  const [inboxBody, setInboxBody] = useState("");
  const [inboxBroadcast, setInboxBroadcast] = useState(true);
  const [inboxTarget, setInboxTarget] = useState<number | "">("");
  const [inboxRecipientFilter, setInboxRecipientFilter] = useState("");
  const promptRef = useRef(prompt);

  const filteredInboxRecipients = useMemo(() => {
    const q = inboxRecipientFilter.trim().toLowerCase();
    let list = inboxRecipients;
    if (q) {
      list = inboxRecipients.filter(
        (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    if (typeof inboxTarget === "number") {
      const selected = inboxRecipients.find((u) => u.id === inboxTarget);
      if (selected && !list.some((u) => u.id === selected.id)) {
        list = [selected, ...list];
      }
    }
    return list;
  }, [inboxRecipients, inboxRecipientFilter, inboxTarget]);

  const voice = useVoiceFrequency();

  const mergeVoiceDiag = useCallback((patch: Partial<VoiceDiagFields>) => {
    setVoiceDiagBase((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadExecutiveVoiceRuntimeDiagnostics = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/runtime-diagnostics", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
      if (!r.ok || j.error) return;
      const po = j.promptOverlaysStatus;
      mergeVoiceDiag({
        orchestrationLevel: orchestrationLevelDisplayFromPayload(j),
        runtimeType: runtimeTypeDisplayFromPayload(j),
        connectedSystems: connectedSystemsFromRuntimePayload(j),
        promptOverlaysStatus:
          po === "ready" || po === "missing_table" || po === "unavailable" ? po : "unavailable",
      });
    } catch {
      /* ignore */
    }
  }, [mergeVoiceDiag]);

  const selfHostedSttReady = useMemo(
    () => (selfHostedSttHealth != null ? isSelfHostedSttHealthReady(selfHostedSttHealth) : false),
    [selfHostedSttHealth],
  );

  const resolvedVoiceSttProvider = useMemo(
    () =>
      resolveExecutiveSttProvider({
        inputMode: voiceSttInputMode,
        selfHostedSttReady,
        openaiTranscriptionAvailable: Boolean(voicePreflight?.openaiStt?.apiKeyPresent),
        executiveVoiceSttProviderEnv:
          typeof voicePreflight?.openaiStt?.executiveVoiceSttProviderEnv === "string"
            ? voicePreflight.openaiStt.executiveVoiceSttProviderEnv
            : null,
        isFirefox: isFirefoxBrowser(),
      }),
    [voiceSttInputMode, selfHostedSttReady, voicePreflight],
  );

  const voiceDiagnostics = useMemo((): ExecutiveVoiceDiagnostics => {
    const provider = voiceDiagBase.voiceProvider ?? executiveOutputVoice?.voiceProvider ?? null;
    const sttProv = resolvedVoiceSttProvider;
    const openAiSttStatusLabel = voicePreflight?.openaiStt
      ? `${voicePreflight.openaiStt.uiLabel ?? "—"} — ${(voicePreflight.openaiStt.message ?? "").slice(0, 120)}${
          (voicePreflight.openaiStt.message ?? "").length > 120 ? "…" : ""
        }`
      : "Preflight not loaded";

    const selfHostedSttHealthText =
      selfHostedSttHealth != null
        ? `${selfHostedSttHealth.uiLabel}: ${selfHostedSttHealth.message.slice(0, 160)}${selfHostedSttHealth.message.length > 160 ? "…" : ""}`
        : "—";

    const sttHealthCombined =
      sttProv === "openai"
        ? openAiSttStatusLabel
        : sttProv === "self_hosted_stt"
          ? selfHostedSttHealthText
          : sttProv === "browser_speech_recognition"
            ? "Browser STT (client-only)"
            : "No STT path — set OPENAI_API_KEY + EXECUTIVE_VOICE_STT_PROVIDER=openai, configure self-hosted STT, or use a Chromium browser.";

    const browserSr = hasBrowserSpeechRecognitionCtor();
    const selfHostedSttStatusLabel = (() => {
      const h = selfHostedSttHealth;
      if (!h || !h.enabled || !h.baseUrlPresent) return "Not configured";
      if (isSelfHostedSttHealthReady(h)) return "Ready";
      if (!h.reachable) return "Unreachable";
      return "Not configured";
    })();
    const browserSttStatusLabel = browserSr ? "Supported" : "Unsupported";
    const sttDevHint =
      selfHostedSttHealth?.enabled && selfHostedSttHealth?.baseUrlPresent && !selfHostedSttReady && sttProv !== "openai"
        ? SELF_HOSTED_STT_DEV_HINT
        : null;
    const browserSttRoutingNote =
      !browserSr &&
      (sttProv === "self_hosted_stt" || sttProv === "openai") &&
      (voiceSttInputMode === "self_hosted_stt" || voiceSttInputMode === "auto" || voiceSttInputMode === "openai_stt")
        ? sttProv === "openai"
          ? "Browser STT unavailable. Using OpenAI clip transcription."
          : "Browser STT unavailable. Using self-hosted STT."
        : null;

    const sttNone = sttProv === "none";

    const ttsProv = (executiveOutputVoice?.voiceProvider ?? "").trim().toLowerCase();
    let effectiveTts: ExecutiveVoiceDiagnostics["effectiveTts"] = "none";
    if (ttsProv === "elevenlabs") effectiveTts = "elevenlabs";
    else if (ttsProv === "self_hosted_tts") effectiveTts = "self_hosted_tts";
    else if (ttsProv === "openai") effectiveTts = "openai";
    else if (executiveOutputVoice?.voiceProvider) effectiveTts = "browser_speech";

    const elevenPref = Boolean(voicePreflight?.elevenlabsTts?.apiKeyPresent);
    const ttsHealthLabel =
      effectiveTts === "elevenlabs"
        ? elevenPref
          ? "Ready — ELEVENLABS_API_KEY present"
          : "Missing ELEVENLABS_API_KEY"
        : effectiveTts === "openai"
          ? voicePreflight?.openaiStt?.apiKeyPresent
            ? "Ready — OPENAI_API_KEY present (tts-1 preset)"
            : "Missing OPENAI_API_KEY"
          : effectiveTts === "self_hosted_tts"
          ? formatSelfHostedVoiceHealth(selfHostedHealth, provider) ?? "Self-hosted TTS"
          : executiveOutputVoice
            ? "Browser speech synthesis fallback"
            : "No SKIPPER output voice — assign in AI Agency";

    return {
      ...voiceDiagBase,
      sttProvider: sttProv,
      sttHealth: sttHealthCombined,
      browserSttStatusLabel,
      selfHostedSttStatusLabel,
      openAiSttStatusLabel,
      ttsProvider: executiveOutputVoice?.voiceProvider ?? null,
      ttsHealth: ttsHealthLabel,
      effectiveStt: sttProv,
      effectiveTts,
      sttDevHint,
      browserSttRoutingNote,
      voiceState: deriveExecutiveVoiceState({
        voiceUnsupported: voiceSttUnsupported && sttNone,
        micError: voice.error,
        busyVoiceTurn: busy === "voice_turn",
        simSpeaking,
        voiceMode,
        liveListening: voice.listening,
        dictationBusy: voiceSttBusy,
      }),
      voiceHealth: formatSelfHostedVoiceHealth(selfHostedHealth, provider),
    };
  }, [
    voiceDiagBase,
    voiceSttUnsupported,
    voice.error,
    busy,
    simSpeaking,
    voiceMode,
    voice.listening,
    voiceSttBusy,
    selfHostedHealth,
    executiveOutputVoice,
    selfHostedSttHealth,
    voiceSttInputMode,
    selfHostedSttReady,
    voicePreflight,
    resolvedVoiceSttProvider,
  ]);

  const clientIdTrim = useMemo(() => clientId.trim(), [clientId]);
  const campaignIdTrim = useMemo(() => campaignId.trim(), [campaignId]);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const selectedAgents = useMemo(() => agentsForPreset(dataPreset, customAgents), [dataPreset, customAgents]);

  const agentQuery = useMemo(() => selectedAgents.join(","), [selectedAgents]);

  const displayAgents = useMemo(() => {
    const base = agentIntel.length ? agentIntel : createDefaultAgentIntelligenceRecords();
    return filterAgentsByKeys(base, selectedAgents);
  }, [agentIntel, selectedAgents]);

  useEffect(() => {
    let id = requestAnimationFrame(function loop() {
      setIdlePulse(0.055 + Math.sin(performance.now() / 1900) * 0.028);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!voiceMode) {
      voice.stopListening();
      return;
    }
    void voice.startListening();
    return () => voice.stopListening();
  }, [voiceMode, voice.startListening, voice.stopListening]);

  useEffect(() => {
    if (!voice.error) return;
    const msg = /notallowed|permission denied/i.test(voice.error) ? "mic denied" : voice.error;
    mergeVoiceDiag({ lastError: msg });
  }, [voice.error, mergeVoiceDiag]);

  const loadExecutiveOutputVoice = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/voice/output-profile", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { voice?: { voiceId: string; voiceProvider: string } | null };
      const v = j?.voice;
      if (v?.voiceId && v?.voiceProvider) {
        setExecutiveOutputVoice({ voiceId: v.voiceId, voiceProvider: v.voiceProvider });
        mergeVoiceDiag({ voiceProvider: v.voiceProvider });
      } else {
        setExecutiveOutputVoice(null);
        mergeVoiceDiag({ voiceProvider: null });
      }
    } catch {
      setExecutiveOutputVoice(null);
      mergeVoiceDiag({ voiceProvider: null });
    }
  }, [mergeVoiceDiag]);

  const loadSelfHostedHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/voice/self-hosted-health", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as SelfHostedExecutiveHealth & { error?: string };
      if (!r.ok || j.error) {
        setSelfHostedHealth(null);
        return;
      }
      setSelfHostedHealth({
        configured: Boolean(j.configured),
        enabled: Boolean(j.enabled),
        baseUrlPresent: Boolean(j.baseUrlPresent),
        reachable: Boolean(j.reachable),
        createEndpointKnown: Boolean(j.createEndpointKnown),
        speakEndpointKnown: Boolean(j.speakEndpointKnown),
        message: typeof j.message === "string" ? j.message : "",
        uiLabel: typeof j.uiLabel === "string" ? j.uiLabel : "",
      });
    } catch {
      setSelfHostedHealth(null);
    }
  }, []);

  const loadSelfHostedSttHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/voice/self-hosted-stt-health", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as SelfHostedSttHealthState & { error?: string };
      if (!r.ok || j.error) {
        setSelfHostedSttHealth(null);
        return;
      }
      setSelfHostedSttHealth({
        configured: Boolean(j.configured),
        enabled: Boolean(j.enabled),
        baseUrlPresent: Boolean(j.baseUrlPresent),
        reachable: Boolean(j.reachable),
        transcribeEndpointKnown: Boolean(j.transcribeEndpointKnown),
        message: typeof j.message === "string" ? j.message : "",
        uiLabel: typeof j.uiLabel === "string" ? j.uiLabel : "",
      });
    } catch {
      setSelfHostedSttHealth(null);
    }
  }, []);

  const loadVoicePreflight = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/voice/preflight", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        openaiStt?: {
          apiKeyPresent?: boolean;
          executiveVoiceSttProviderEnv?: string | null;
          uiLabel?: string;
          message?: string;
        };
        elevenlabsTts?: { apiKeyPresent?: boolean; uiLabel?: string; message?: string };
        executiveVoiceTtsProviderEnv?: string | null;
        nextSteps?: string[];
        error?: string;
      };
      if (!r.ok || j.error) {
        setVoicePreflight(null);
        return;
      }
      setVoicePreflight({
        openaiStt: j.openaiStt,
        elevenlabsTts: j.elevenlabsTts,
        executiveVoiceTtsProviderEnv: j.executiveVoiceTtsProviderEnv,
        nextSteps: Array.isArray(j.nextSteps) ? j.nextSteps : [],
      });
    } catch {
      setVoicePreflight(null);
    }
  }, []);

  const refreshExecutiveVoiceSttDiagnostics = useCallback(async () => {
    await loadSelfHostedSttHealth();
    await loadVoicePreflight();
    await loadExecutiveVoiceRuntimeDiagnostics();
  }, [loadSelfHostedSttHealth, loadVoicePreflight, loadExecutiveVoiceRuntimeDiagnostics]);

  useEffect(() => {
    void loadSelfHostedHealth();
  }, [loadSelfHostedHealth]);

  useEffect(() => {
    void loadSelfHostedSttHealth();
  }, [loadSelfHostedSttHealth]);

  useEffect(() => {
    void loadVoicePreflight();
  }, [loadVoicePreflight]);

  useEffect(() => {
    const t = window.setInterval(() => setHudClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    void loadExecutiveOutputVoice();
  }, [loadExecutiveOutputVoice]);

  useEffect(() => {
    void loadExecutiveVoiceRuntimeDiagnostics();
  }, [loadExecutiveVoiceRuntimeDiagnostics]);

  useEffect(() => {
    if (!voiceApprovalFlash) return;
    const t = window.setTimeout(() => setVoiceApprovalFlash(false), 4500);
    return () => window.clearTimeout(t);
  }, [voiceApprovalFlash]);

  const memorySuggestionKey = useCallback((s: NonNullable<ChatResult["suggestedMemoryItems"]>[number]) => {
    return `${s.memoryType}:${s.title}`;
  }, []);

  const loadBriefingToday = useCallback(async () => {
    setBriefingBusy(true);
    setDailyBriefingError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/briefing/today", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { briefing?: DailyBriefingView | null; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Briefing failed");
      setDailyBriefing(j.briefing ?? null);
    } catch (e) {
      setDailyBriefing(null);
      setDailyBriefingError(e instanceof Error ? e.message : "Briefing failed");
    } finally {
      setBriefingBusy(false);
    }
  }, []);

  const generateBriefing = useCallback(async () => {
    setBriefingBusy(true);
    setDailyBriefingError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/briefing/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await r.json().catch(() => ({}))) as { briefing?: DailyBriefingView; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Generate briefing failed");
      setDailyBriefing(j.briefing ?? null);
    } catch (e) {
      setDailyBriefingError(e instanceof Error ? e.message : "Generate briefing failed");
    } finally {
      setBriefingBusy(false);
    }
  }, []);

  const saveMemorySuggestion = useCallback(
    async (s: NonNullable<ChatResult["suggestedMemoryItems"]>[number]) => {
      const key = memorySuggestionKey(s);
      setMemorySaveBusyKey(key);
      try {
        const r = await fetch("/api/admin/executive-agent/memory", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memoryType: s.memoryType,
            subjectType: s.subjectType ?? null,
            subjectId: s.subjectId ?? null,
            title: s.title,
            summary: s.summary,
            source: s.suggestionSource,
            confidence: s.confidence,
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Save memory failed");
        setDismissedMemorySuggestions((prev) => ({ ...prev, [key]: true }));
        void loadBriefingToday();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Save memory failed");
      } finally {
        setMemorySaveBusyKey(null);
      }
    },
    [memorySuggestionKey, loadBriefingToday],
  );

  const dismissMemorySuggestion = useCallback(
    (s: NonNullable<ChatResult["suggestedMemoryItems"]>[number]) => {
      const key = memorySuggestionKey(s);
      setDismissedMemorySuggestions((prev) => ({ ...prev, [key]: true }));
    },
    [memorySuggestionKey],
  );

  const loadLearningPendingPreview = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/learning/pending", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        improvements?: unknown[];
        capabilities?: unknown[];
        overlays?: unknown[];
      };
      if (!r.ok) {
        setLearningPendingPreview(null);
        return;
      }
      setLearningPendingPreview({
        improvements: Array.isArray(j.improvements) ? j.improvements.length : 0,
        capabilities: Array.isArray(j.capabilities) ? j.capabilities.length : 0,
        overlays: Array.isArray(j.overlays) ? j.overlays.length : 0,
      });
    } catch {
      setLearningPendingPreview(null);
    }
  }, []);

  const postSkipperLearningEvent = useCallback(
    async (eventType: string, payload: Record<string, unknown>) => {
      const r = await fetch("/api/admin/executive-agent/learning/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, source: "chat", payload }),
      });
      const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!r.ok) throw new Error(j.message ?? j.error ?? "Learning event failed");
      void loadLearningPendingPreview();
    },
    [loadLearningPendingPreview],
  );

  const onChatFeedbackHelpful = useCallback(async () => {
    if (!lastChatTurn) return;
    setLearningFeedbackBusy("helpful");
    try {
      await postSkipperLearningEvent("helpful", {
        question: lastChatTurn.prompt.slice(0, 4000),
        answer: lastChatTurn.answer.slice(0, 8000),
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLearningFeedbackBusy(null);
    }
  }, [lastChatTurn, postSkipperLearningEvent]);

  const onChatFeedbackNotHelpful = useCallback(async () => {
    if (!lastChatTurn) return;
    setLearningFeedbackBusy("not_helpful");
    try {
      await postSkipperLearningEvent("not_helpful", {
        question: lastChatTurn.prompt.slice(0, 4000),
        answer: lastChatTurn.answer.slice(0, 8000),
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLearningFeedbackBusy(null);
    }
  }, [lastChatTurn, postSkipperLearningEvent]);

  const onChatFeedbackSaveMemory = useCallback(async () => {
    if (!lastChatTurn) return;
    setLearningFeedbackBusy("save_memory");
    try {
      const title = `Chat note: ${lastChatTurn.prompt.slice(0, 120)}${lastChatTurn.prompt.length > 120 ? "…" : ""}`;
      const summary = `Q: ${lastChatTurn.prompt.slice(0, 4000)}\n\nA: ${lastChatTurn.answer.slice(0, 8000)}`;
      const r = await fetch("/api/admin/executive-agent/memory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryType: "preference",
          title,
          summary,
          source: "chat",
          confidence: 0.85,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Save memory failed");
      await postSkipperLearningEvent("save_memory", { title, summary: summary.slice(0, 2000) });
      void loadBriefingToday();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Save memory failed");
    } finally {
      setLearningFeedbackBusy(null);
    }
  }, [lastChatTurn, postSkipperLearningEvent, loadBriefingToday]);

  const onChatFeedbackSuggestImprovement = useCallback(async () => {
    if (!lastChatTurn) return;
    const note = window.prompt("What should SKIPPER do differently? (optional detail)") ?? "";
    setLearningFeedbackBusy("suggest_improvement");
    try {
      await postSkipperLearningEvent("suggest_improvement", {
        question: lastChatTurn.prompt.slice(0, 4000),
        answer: lastChatTurn.answer.slice(0, 8000),
        note: note.trim().slice(0, 2000),
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLearningFeedbackBusy(null);
    }
  }, [lastChatTurn, postSkipperLearningEvent]);

  const loadExecutiveRoutines = useCallback(async () => {
    setExecutiveRoutinesBusy(true);
    setExecutiveRoutinesError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/routines?seedDailyBriefing=1&seedSkipperLearningDigest=1", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        routines?: Array<{
          id: string;
          routineType: string;
          cadence: string;
          enabled: boolean;
          lastRunAt?: string | null;
          nextRunAt?: string | null;
          lastOutputJson?: string | null;
        }>;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Routines failed");
      setExecutiveRoutines(Array.isArray(j.routines) ? j.routines : []);
      void loadLearningPendingPreview();
    } catch (e) {
      setExecutiveRoutines([]);
      setExecutiveRoutinesError(e instanceof Error ? e.message : "Routines failed");
    } finally {
      setExecutiveRoutinesBusy(false);
    }
  }, [loadLearningPendingPreview]);

  const patchExecutiveRoutine = useCallback(
    async (id: string, body: { enabled?: boolean }) => {
      setExecutiveRoutinesBusy(true);
      try {
        const r = await fetch(`/api/admin/executive-agent/routines/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Update failed");
        await loadExecutiveRoutines();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Update failed");
      } finally {
        setExecutiveRoutinesBusy(false);
      }
    },
    [loadExecutiveRoutines],
  );

  const runExecutiveRoutineNow = useCallback(
    async (id: string) => {
      setExecutiveRoutinesBusy(true);
      try {
        const r = await fetch(`/api/admin/executive-agent/routines/${encodeURIComponent(id)}/run-now`, {
          method: "POST",
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Run failed");
        await loadExecutiveRoutines();
        void loadBriefingToday();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Run failed");
      } finally {
        setExecutiveRoutinesBusy(false);
      }
    },
    [loadExecutiveRoutines, loadBriefingToday],
  );

  const loadKnowledgeDocs = useCallback(async () => {
    setKnowledgeBusy(true);
    setKnowledgeError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/knowledge", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { items?: typeof knowledgeDocs; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Knowledge list failed");
      setKnowledgeDocs(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setKnowledgeError(e instanceof Error ? e.message : "Knowledge list failed");
    } finally {
      setKnowledgeBusy(false);
    }
  }, []);

  const loadQuestionHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/question-history", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { items?: typeof questionHistory };
      if (r.ok && Array.isArray(j.items)) setQuestionHistory(j.items);
    } catch {
      /* ignore */
    }
  }, []);

  const loadExecutiveInboxAdmin = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/inbox", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        messages?: Array<Record<string, unknown>>;
        recipients?: typeof inboxRecipients;
        directory?: Record<string, { username?: string; email?: string }>;
      };
      if (r.ok) {
        setInboxMessages(Array.isArray(j.messages) ? j.messages : []);
        setInboxRecipients(Array.isArray(j.recipients) ? j.recipients : []);
        const dr = j.directory;
        const directory: Record<number, { username: string; email: string }> = {};
        if (dr && typeof dr === "object") {
          for (const [k, v] of Object.entries(dr)) {
            const id = Number(k);
            if (!Number.isFinite(id) || !v || typeof v !== "object") continue;
            directory[id] = {
              username: typeof v.username === "string" ? v.username : "",
              email: typeof v.email === "string" ? v.email : "",
            };
          }
        }
        setInboxDirectory(directory);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const postKnowledgeNote = useCallback(async () => {
    if (!knowledgeTitle.trim() || !knowledgeBody.trim()) return;
    setKnowledgeBusy(true);
    try {
      const r = await fetch("/api/admin/executive-agent/knowledge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: knowledgeTitle, sourceType: "note", contentText: knowledgeBody }),
      });
      if (!r.ok) throw new Error("Save failed");
      setKnowledgeTitle("");
      setKnowledgeBody("");
      await loadKnowledgeDocs();
    } catch (e) {
      setKnowledgeError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setKnowledgeBusy(false);
    }
  }, [knowledgeTitle, knowledgeBody, loadKnowledgeDocs]);

  const postKnowledgeCrawl = useCallback(async () => {
    if (!knowledgeCrawlUrl.trim()) return;
    setKnowledgeBusy(true);
    try {
      const r = await fetch("/api/admin/executive-agent/knowledge/crawl", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: knowledgeCrawlUrl }),
      });
      const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!r.ok) throw new Error(j.message ?? j.error ?? "Crawl failed");
      setKnowledgeCrawlUrl("");
      await loadKnowledgeDocs();
    } catch (e) {
      setKnowledgeError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setKnowledgeBusy(false);
    }
  }, [knowledgeCrawlUrl, loadKnowledgeDocs]);

  const deleteKnowledgeDoc = useCallback(
    async (id: string) => {
      setKnowledgeBusy(true);
      try {
        await fetch(`/api/admin/executive-agent/knowledge/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
        await loadKnowledgeDocs();
      } finally {
        setKnowledgeBusy(false);
      }
    },
    [loadKnowledgeDocs],
  );

  const appendInboxUploaded = useCallback((attachment: InboxPendingAttachment) => {
    setInboxPendingAttachments((p) => (p.length >= 5 ? p : [...p, attachment]));
  }, []);

  const uploadInboxFileFromInput = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/admin/executive-agent/inbox/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { attachment?: InboxPendingAttachment };
      if (r.ok && j.attachment) appendInboxUploaded(j.attachment);
    },
    [appendInboxUploaded],
  );

  const stopInboxVoiceRecording = useCallback(() => {
    inboxMrRef.current?.stop();
  }, []);

  const startInboxVoiceRecording = useCallback(async () => {
    if (inboxRecording || inboxPendingAttachments.length >= 5) return;
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inboxMrStreamRef.current = stream;
      inboxMrChunksRef.current = [];
      const mime = pickMediaRecorderMimeType();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      inboxMrRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data.size) inboxMrChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        setInboxRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        inboxMrStreamRef.current = null;
        const blob = new Blob(inboxMrChunksRef.current, { type: mr.mimeType || "audio/webm" });
        inboxMrChunksRef.current = [];
        inboxMrRef.current = null;
        const form = new FormData();
        form.append("file", blob, `voice-${Date.now()}.webm`);
        const r = await fetch("/api/admin/executive-agent/inbox/upload", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as { attachment?: InboxPendingAttachment };
        if (r.ok && j.attachment) appendInboxUploaded(j.attachment);
      };
      mr.start(250);
      setInboxRecording(true);
    } catch {
      setInboxRecording(false);
    }
  }, [appendInboxUploaded, inboxPendingAttachments.length, inboxRecording]);

  const sendExecutiveInbox = useCallback(async () => {
    const hasBody = inboxBody.trim().length > 0;
    const hasAtt = inboxPendingAttachments.length > 0;
    if (!hasBody && !hasAtt) return;
    const r = await fetch("/api/admin/executive-agent/inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyText: inboxBody,
        broadcast: inboxBroadcast,
        toMarketplaceUserId: !inboxBroadcast && typeof inboxTarget === "number" ? inboxTarget : undefined,
        attachments: inboxPendingAttachments.length ? inboxPendingAttachments : undefined,
      }),
    });
    if (r.ok) {
      setInboxBody("");
      setInboxPendingAttachments([]);
      await loadExecutiveInboxAdmin();
    }
  }, [inboxBody, inboxBroadcast, inboxTarget, inboxPendingAttachments, loadExecutiveInboxAdmin]);

  useEffect(() => {
    if (bottomTab === "Settings") {
      void loadExecutiveRoutines();
      void loadKnowledgeDocs();
      void loadQuestionHistory();
    }
    if (bottomTab === "Inbox" || activeSubjectId === "inbox") {
      void loadExecutiveInboxAdmin();
    }
  }, [bottomTab, activeSubjectId, loadExecutiveRoutines, loadKnowledgeDocs, loadQuestionHistory, loadExecutiveInboxAdmin]);

  const loadSummary = useCallback(async () => {
    setBusy("summary");
    setSummaryError(null);
    try {
      const q = clientIdTrim ? `?clientId=${encodeURIComponent(clientIdTrim)}` : "";
      const r = await fetch(`/api/admin/executive-agent/summary${q}`, { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as SummaryJson & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Summary failed");
      setSummary(j);
    } catch (e) {
      setSummary(null);
      setSummaryError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setBusy(null);
    }
  }, [clientIdTrim]);

  const loadLiveMetrics = useCallback(async () => {
    setBusy("live");
    setLiveMetricsError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/live-metrics", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as LiveMetricsResponse & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Live metrics failed");
      setLiveMetrics(j);
    } catch (e) {
      setLiveMetrics(null);
      setLiveMetricsError(e instanceof Error ? e.message : "Live metrics failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const loadAgentIntel = useCallback(async () => {
    setBusy("intel");
    setAgentIntelError(null);
    try {
      const q = agentQuery ? `?agents=${encodeURIComponent(agentQuery)}` : "";
      const r = await fetch(`/api/admin/executive-agent/agent-intelligence${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { agents?: AgentIntelligenceRecord[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Agent intelligence failed");
      setAgentIntel(Array.isArray(j.agents) ? j.agents : []);
    } catch (e) {
      setAgentIntel([]);
      setAgentIntelError(e instanceof Error ? e.message : "Agent intelligence failed");
    } finally {
      setBusy(null);
    }
  }, [agentQuery]);

  const loadApprovals = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/approvals?status=pending", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { approvals?: ApprovalRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Approvals failed");
      setApprovals(Array.isArray(j.approvals) ? j.approvals : []);
    } catch {
      setApprovals([]);
    }
  }, []);

  const loadRecentConversations = useCallback(async () => {
    setRecentConversationsError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/recent-conversations?limit=20", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { conversations?: RecentConversationRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Recent conversations failed");
      setRecentConversations(Array.isArray(j.conversations) ? j.conversations : []);
    } catch (e) {
      setRecentConversations([]);
      setRecentConversationsError(e instanceof Error ? e.message : "Recent conversations failed");
    }
  }, []);

  const loadFollowUpRecommendations = useCallback(async () => {
    setFollowUpError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/client-follow-up", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        recommendations?: FollowUpRecommendationRow[];
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Follow-up intelligence failed");
      setFollowUpRecommendations(Array.isArray(j.recommendations) ? j.recommendations : []);
    } catch (e) {
      setFollowUpRecommendations([]);
      setFollowUpError(e instanceof Error ? e.message : "Follow-up intelligence failed");
    }
  }, []);

  const queueFollowUpRecommendation = useCallback(
    async (rec: FollowUpRecommendationRow) => {
      const cid = clientIdTrim;
      if (!cid) {
        window.alert("Enter a CRM client UUID in the panel before queueing a follow-up approval.");
        return;
      }
      setFollowUpQueueBusyId(rec.id);
      try {
        const r = await fetch("/api/admin/executive-agent/follow-up-recommendations/queue", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: cid,
            note: rec.payloadTemplate.note,
            recommendationId: rec.id,
            proposedAction: "createTodo",
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!r.ok) {
          window.alert(j.message ?? j.error ?? "Queue failed");
          return;
        }
        void loadApprovals();
      } finally {
        setFollowUpQueueBusyId(null);
      }
    },
    [clientIdTrim, loadApprovals],
  );

  useEffect(() => {
    void loadSummary();
    void loadApprovals();
    void loadLiveMetrics();
    void loadRecentConversations();
    void loadFollowUpRecommendations();
    void loadBriefingToday();
  }, [loadSummary, loadApprovals, loadLiveMetrics, loadRecentConversations, loadFollowUpRecommendations, loadBriefingToday]);

  useEffect(() => {
    void loadLearningPendingPreview();
  }, [loadLearningPendingPreview]);

  useEffect(() => {
    void loadAgentIntel();
  }, [loadAgentIntel]);

  const sendChat = useCallback(async () => {
    const p = prompt.trim();
    if (!p) return;
    setBusy("chat");
    setChatError(null);
    setActivityFeed((prev) => [`You — ${p.slice(0, 120)}${p.length > 120 ? "…" : ""}`, ...prev].slice(0, 24));
    try {
      const r = await fetch("/api/admin/executive-agent/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          mode: "read",
          dryRun,
          selectedAgents,
          selectedTimeRange: timeRange,
          dashboardMode,
          ...(clientIdTrim ? { selectedClientId: clientIdTrim } : {}),
          ...(campaignIdTrim ? { selectedCampaignId: campaignIdTrim } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as ChatResult & { error?: string; message?: string };
      if (!r.ok) throw new Error(j.message ?? j.error ?? "Chat failed");
      setChatResult(j);
      setLastChatTurn({ prompt: p, answer: (j.answer ?? "").trim() });
      if (j.answer) {
        setActivityFeed((prev) => [`Executive — ${j.answer!.slice(0, 160)}${j.answer!.length > 160 ? "…" : ""}`, ...prev].slice(0, 24));
      }
      setSimSpeaking(true);
      window.setTimeout(() => setSimSpeaking(false), 1200);
      void loadApprovals();
      void loadSummary();
      void loadLiveMetrics();
      void loadLearningPendingPreview();
    } catch (e) {
      setChatResult(null);
      setLastChatTurn(null);
      setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(null);
    }
  }, [
    prompt,
    dryRun,
    clientIdTrim,
    campaignIdTrim,
    selectedAgents,
    timeRange,
    dashboardMode,
    loadApprovals,
    loadSummary,
    loadLiveMetrics,
    loadLearningPendingPreview,
  ]);

  const loadVoiceRail = useCallback(async (sessionId: string) => {
    try {
      const r = await fetch(`/api/admin/executive-agent/voice/${encodeURIComponent(sessionId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        turns?: Array<{
          id: string;
          transcriptText: string;
          responseText: string;
          proposedApprovalsCount: number;
          createdAt: Date | string | null;
        }>;
      };
      if (!r.ok || !Array.isArray(j.turns)) return;
      setVoiceRailTurns(
        j.turns.map((t) => ({
          id: t.id,
          transcriptText: t.transcriptText,
          responseText: t.responseText,
          proposedApprovalsCount: t.proposedApprovalsCount,
          createdAt: t.createdAt != null ? String(t.createdAt) : null,
        })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const speakExecutiveAnswer = useCallback(
    async (text: string, locale?: string): Promise<{ path: SpeakExecutiveAnswerPath; ms: number; error?: string | null }> => {
      if (typeof window === "undefined") return { path: "none", ms: 0 };
      const t0 = performance.now();
      const done = (path: SpeakExecutiveAnswerPath, err?: string | null) => ({
        path,
        ms: Math.round(performance.now() - t0),
        error: err ?? null,
      });
      const slice = text.slice(0, 8000);
      const ev = executiveOutputVoice;
      if (ev?.voiceProvider === "self_hosted_tts" && selfHostedHealth && !executiveSelfHostedVoiceReady(selfHostedHealth)) {
        window.speechSynthesis?.cancel();
        execAudioRef.current?.pause();
        if (!window.speechSynthesis) return done("browser_speech", "TTS unavailable");
        const u = new SpeechSynthesisUtterance(slice);
        u.lang = locale || "en-US";
        u.onstart = () => setSimSpeaking(true);
        u.onend = () => setSimSpeaking(false);
        u.onerror = () => setSimSpeaking(false);
        window.speechSynthesis.speak(u);
        return done("browser_speech");
      }
      if (ev && (ev.voiceProvider === "self_hosted_tts" || ev.voiceProvider === "elevenlabs" || ev.voiceProvider === "openai")) {
        try {
          window.speechSynthesis?.cancel();
          execAudioRef.current?.pause();
          const r = await fetch("/api/admin/executive-agent/voice/speak", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: slice,
              voiceId: ev.voiceId,
              voiceProvider: ev.voiceProvider,
            }),
          });
          const ct = r.headers.get("content-type") ?? "";
          if (r.ok && ct.includes("audio")) {
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            execAudioRef.current = audio;
            setSimSpeaking(true);
            audio.onended = () => {
              setSimSpeaking(false);
              URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
              setSimSpeaking(false);
              URL.revokeObjectURL(url);
            };
            await audio.play().catch(() => {
              setSimSpeaking(false);
              URL.revokeObjectURL(url);
            });
            if (ev.voiceProvider === "self_hosted_tts") return done("self_hosted_tts");
            if (ev.voiceProvider === "elevenlabs") return done("elevenlabs");
            return done("openai");
          }
        } catch {
          /* fall through */
        }
      }
      if (!window.speechSynthesis) return done("none", "TTS unavailable");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(slice);
      u.lang = locale || "en-US";
      u.onstart = () => setSimSpeaking(true);
      u.onend = () => setSimSpeaking(false);
      u.onerror = () => setSimSpeaking(false);
      window.speechSynthesis.speak(u);
      return done("browser_speech");
    },
    [executiveOutputVoice, selfHostedHealth],
  );

  const submitVoiceTurn = useCallback(
    async (transcriptText: string) => {
      if (!transcriptText.trim()) return;
      setBusy("voice_turn");
      setTranscript((prev) => `${prev}\n\nYou: ${transcriptText}`);
      mergeVoiceDiag({
        lastTranscript: transcriptText.trim(),
        lastError: null,
      });
      const orchStarted = performance.now();
      try {
        const r = await fetch("/api/admin/executive-agent/voice/turn", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: voiceSession?.sessionId,
            transcript: transcriptText,
            mode: "read",
            dryRun,
            selectedClientId: clientIdTrim || undefined,
            selectedCampaignId: campaignIdTrim || undefined,
            selectedAgents,
            selectedTimeRange: timeRange,
            dashboardMode,
          }),
        });
        const j = (await r.json().catch(() => ({}))) as ChatResult & {
          error?: string;
          turnId?: string;
          sessionId?: string;
          pendingVoiceIntent?: { intent: string; createdAt: string } | null;
        };
        if (!r.ok) throw new Error(j.error ?? "Voice turn failed");
        const answer = typeof j.answer === "string" ? j.answer : "";
        if (typeof j.sessionId === "string" && j.sessionId.trim()) {
          setVoiceSession((prev) => ({
            sessionId: j.sessionId,
            provider: prev?.provider ?? "browser_stt",
            transcript: prev?.transcript ?? null,
            capabilities: prev?.capabilities,
            status: prev?.status ?? "active",
            inputMode: prev?.inputMode ?? "browser_stt",
            outputMode: prev?.outputMode ?? "browser_tts",
            expiresAt: prev?.expiresAt,
            clientConfig: prev?.clientConfig,
          }));
        }
        setChatResult({
          answer: j.answer,
          requiresApproval: j.requiresApproval,
          plannerMeta: j.plannerMeta,
          suggestedMemoryItems: j.suggestedMemoryItems,
        });
        setVoicePendingAnalytics(
          j.pendingVoiceIntent?.intent === "analytics_clarification" ? j.pendingVoiceIntent : null,
        );
        const approvalN = j.requiresApproval?.length ?? j.plannerMeta?.proposedApprovalsCount ?? 0;
        if (approvalN > 0) setVoiceApprovalFlash(true);
        setTranscript(
          (prev) => `${prev}\nExecutive: ${answer.slice(0, 800)}${answer.length > 800 ? "…" : ""}`,
        );
        const short = j.plannerMeta?.voiceShortCircuit;
        mergeVoiceDiag({
          orchestratorMs: Math.round(performance.now() - orchStarted),
          lastResponse: answer,
          voiceShortCircuit: short === "greeting" || short === "analytics_clarification" ? short : "none",
          pendingVoiceIntent: j.pendingVoiceIntent?.intent ?? null,
          selectedTool: firstSelectedReadToolFromInsights(j.insights),
        });
        const speak = await speakExecutiveAnswer(answer, voiceSession?.clientConfig?.locale);
        mergeVoiceDiag({
          voiceProvider: speak.path,
          ttsMs: speak.ms,
          ...(speak.error ? { lastError: speak.error } : {}),
        });
        const railSid = (typeof j.sessionId === "string" && j.sessionId.trim() ? j.sessionId : voiceSession?.sessionId) ?? "";
        if (railSid) void loadVoiceRail(railSid);
        void loadApprovals();
        void loadExecutiveVoiceRuntimeDiagnostics();
        setActivityFeed((prev) =>
          [`Voice — ${approvalN ? `${approvalN} approval(s) proposed` : "read-only turn"}`, ...prev].slice(0, 24),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Turn failed";
        mergeVoiceDiag({
          orchestratorMs: Math.round(performance.now() - orchStarted),
          lastError: `voice route failure: ${msg}`,
        });
        setTranscript((prev) => `${prev}\n[Error] ${msg}`);
      } finally {
        setBusy(null);
      }
    },
    [
      voiceSession?.sessionId,
      voiceSession?.clientConfig?.locale,
      dryRun,
      clientIdTrim,
      campaignIdTrim,
      selectedAgents,
      timeRange,
      dashboardMode,
      loadVoiceRail,
      loadApprovals,
      speakExecutiveAnswer,
      mergeVoiceDiag,
      loadExecutiveVoiceRuntimeDiagnostics,
    ],
  );

  const transcribeAudioBlob = useCallback(
    async (blob: Blob) => {
      const fd = new FormData();
      fd.append("audio", blob, "clip.webm");
      if (resolvedVoiceSttProvider === "openai") fd.append("sttPreference", "openai");
      else if (resolvedVoiceSttProvider === "self_hosted_stt") fd.append("sttPreference", "self_hosted_stt");
      const loc = voiceSession?.clientConfig?.locale;
      if (loc?.trim()) fd.append("language", loc.trim().slice(0, 32));
      if (voiceSession?.sessionId?.trim()) fd.append("sessionId", voiceSession.sessionId.trim());
      const t0 = performance.now();
      const r = await fetch("/api/admin/executive-agent/voice/transcribe", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const ms = Math.round(performance.now() - t0);
      mergeVoiceDiag({ sttHttpStatus: r.status, sttAudioBlobSize: blob.size });
      const j = (await r.json().catch(() => ({}))) as {
        transcript?: string;
        confidence?: number | null;
        provider?: string;
        error?: string;
        message?: string;
      };
      if (!r.ok) {
        const err = typeof j.message === "string" && j.message.trim() ? j.message : j.error ?? `HTTP ${r.status}`;
        mergeVoiceDiag({
          sttError: err,
          sttTranscript: null,
          sttConfidence: null,
          speechRecognitionMs: ms,
        });
        throw new Error(err);
      }
      const tr = typeof j.transcript === "string" ? j.transcript.trim() : "";
      mergeVoiceDiag({
        sttError: null,
        sttTranscript: tr || null,
        sttConfidence: typeof j.confidence === "number" && Number.isFinite(j.confidence) ? j.confidence : null,
        speechRecognitionMs: ms,
      });
      return tr;
    },
    [
      voiceSession?.sessionId,
      voiceSession?.clientConfig?.locale,
      resolvedVoiceSttProvider,
      mergeVoiceDiag,
    ],
  );

  const runSelfHostedSttTestClip = useCallback(async () => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      setSttTestTranscript("MediaRecorder unavailable.");
      return;
    }
    setSttTestBusy(true);
    setSttTestTranscript(null);
    let stream: MediaStream | null = null;
    let ownStream = false;
    try {
      stream = voice.getActiveMediaStream();
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        ownStream = true;
      }
      const mime = pickMediaRecorderMimeType();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const blobDone = new Promise<Blob>((resolve, reject) => {
        mr.onerror = () => reject(new Error("MediaRecorder error"));
        mr.onstop = () => {
          const t = mr.mimeType || mime || "audio/webm";
          resolve(new Blob(chunks, { type: t }));
        };
      });
      mr.start(200);
      await new Promise<void>((res) => window.setTimeout(res, 2000));
      if (mr.state === "recording") mr.stop();
      const blob = await blobDone;
      if (blob.size < 1) throw new Error("Empty recording");
      const text = await transcribeAudioBlob(blob);
      setSttTestTranscript(text || "(empty transcript)");
      void loadSelfHostedSttHealth();
      void loadVoicePreflight();
      void loadExecutiveVoiceRuntimeDiagnostics();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server STT test failed";
      setSttTestTranscript(msg);
    } finally {
      if (ownStream) stream?.getTracks().forEach((tr) => tr.stop());
      setSttTestBusy(false);
    }
  }, [voice, transcribeAudioBlob, loadSelfHostedSttHealth, loadVoicePreflight, loadExecutiveVoiceRuntimeDiagnostics]);

  const runSelfHostedSttClip = useCallback(
    async (mode: "mic_near" | "oneshot") => {
      if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
        mergeVoiceDiag({ lastError: "MediaRecorder unavailable", sttError: "MediaRecorder unavailable" });
        if (mode === "mic_near") setChatError("Voice recording unavailable in this environment.");
        else setTranscript((t) => `${t}\nMediaRecorder unavailable.`);
        return;
      }
      if (voiceSttBusy || busy !== null) return;
      setVoiceSttUnsupported(false);
      setChatError(null);
      setVoiceSttBusy(true);
      mergeVoiceDiag({ sttError: null, sttHttpStatus: null, sttTranscript: null, sttConfidence: null });
      let stream: MediaStream | null = null;
      let ownStream = false;
      try {
        stream = voice.getActiveMediaStream();
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          ownStream = true;
        }
        const mime = pickMediaRecorderMimeType();
        const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        const chunks: Blob[] = [];
        mr.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        const blobDone = new Promise<Blob>((resolve, reject) => {
          mr.onerror = () => reject(new Error("MediaRecorder error"));
          mr.onstop = () => {
            const t = mr.mimeType || mime || "audio/webm";
            resolve(new Blob(chunks, { type: t }));
          };
        });
        sttRef.current = {
          stop: () => {
            try {
              if (mr.state === "recording") mr.stop();
            } catch {
              /* ignore */
            }
          },
        };
        mr.start(200);
        const capMs = 5500;
        await new Promise<void>((res) => window.setTimeout(res, capMs));
        if (mr.state === "recording") mr.stop();
        const blob = await blobDone;
        if (blob.size < 1) throw new Error("Empty recording");
        const text = await transcribeAudioBlob(blob);
        if (mode === "mic_near") {
          setPrompt(text);
          if (text) void submitVoiceTurn(text);
        } else if (text) {
          void submitVoiceTurn(text);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Server STT failed";
        mergeVoiceDiag({ lastError: msg, sttError: msg });
        if (mode === "mic_near") setChatError(msg);
        else setTranscript((t) => `${t}\n${msg}`);
      } finally {
        if (ownStream) stream?.getTracks().forEach((tr) => tr.stop());
        sttRef.current = null;
        setVoiceSttBusy(false);
      }
    },
    [voiceSttBusy, busy, voice, transcribeAudioBlob, submitVoiceTurn, mergeVoiceDiag],
  );

  const runMicNearInput = useCallback(() => {
    if (typeof window === "undefined") return;
    if (voiceSttInputMode === "self_hosted_stt" && !selfHostedSttReady) {
      setChatError(SELF_HOSTED_STT_DEV_HINT);
      mergeVoiceDiag({ lastError: "self-hosted STT unreachable" });
      return;
    }
    if (voiceSttInputMode === "openai_stt" && !voicePreflight?.openaiStt?.apiKeyPresent) {
      setChatError("OpenAI STT requires OPENAI_API_KEY on the server (see Voice preflight).");
      mergeVoiceDiag({ lastError: "OpenAI STT not configured" });
      return;
    }
    const provider = resolvedVoiceSttProvider;
    if (provider === "self_hosted_stt" || provider === "openai") {
      void runSelfHostedSttClip("mic_near");
      return;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      if (voiceSttInputMode === "browser_stt") {
        setVoiceSttUnsupported(true);
        mergeVoiceDiag({ lastError: "unsupported browser — SpeechRecognition API missing" });
        setChatError("Browser voice input unavailable.");
        return;
      }
      const selfHostedConfigured = Boolean(selfHostedSttHealth?.enabled && selfHostedSttHealth?.baseUrlPresent);
      if (voiceSttInputMode !== "browser_stt" && selfHostedConfigured) {
        if (selfHostedSttReady) {
          void runSelfHostedSttClip("mic_near");
          return;
        }
        setVoiceSttUnsupported(false);
        mergeVoiceDiag({
          lastError: "self-hosted STT unreachable",
        });
        setChatError(SELF_HOSTED_STT_DEV_HINT);
        return;
      }
      if (voicePreflight?.openaiStt?.apiKeyPresent) {
        void runSelfHostedSttClip("mic_near");
        return;
      }
      setVoiceSttUnsupported(true);
      mergeVoiceDiag({ lastError: "unsupported browser — SpeechRecognition API missing" });
      setChatError("Browser voice input unavailable.");
      return;
    }
    setVoiceSttUnsupported(false);
    if (voiceSttBusy || busy !== null) return;
    setChatError(null);
    setVoiceSttBusy(true);
    let accumulated = "";
    /** Full prompt shown in UI (final + interim); some engines omit isFinal before onend — use this for submit. */
    let lastMergedTranscript = "";
    let sttStarted = 0;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const piece = r[0]?.transcript ?? "";
        if (r.isFinal) accumulated = `${accumulated} ${piece}`.trim();
        else interim += piece;
      }
      const merged = `${accumulated}${accumulated && interim ? " " : ""}${interim}`.trim();
      lastMergedTranscript = merged;
      setPrompt(merged);
    };
    rec.onerror = () => {
      setVoiceSttBusy(false);
      mergeVoiceDiag({
        lastError: "speech recognition failed",
        speechRecognitionMs: sttStarted ? Math.round(performance.now() - sttStarted) : null,
      });
      setChatError("Browser voice input unavailable.");
    };
    rec.onend = () => {
      setVoiceSttBusy(false);
      const ms = sttStarted ? Math.round(performance.now() - sttStarted) : null;
      mergeVoiceDiag({ speechRecognitionMs: ms });
      const send = (lastMergedTranscript.trim() || accumulated.trim()).trim();
      if (send) void submitVoiceTurn(send);
    };
    try {
      sttStarted = performance.now();
      sttRef.current = { stop: () => rec.stop() };
      rec.start();
    } catch {
      setVoiceSttBusy(false);
      mergeVoiceDiag({ lastError: "speech recognition failed to start" });
      setChatError("Browser voice input unavailable.");
    }
  }, [
    voiceSttInputMode,
    selfHostedSttReady,
    selfHostedSttHealth,
    voicePreflight,
    resolvedVoiceSttProvider,
    voiceSttBusy,
    busy,
    submitVoiceTurn,
    mergeVoiceDiag,
    runSelfHostedSttClip,
  ]);

  const runOneShotDictation = useCallback(() => {
    if (typeof window === "undefined") return;
    if (voiceSttInputMode === "self_hosted_stt" && !selfHostedSttReady) {
      mergeVoiceDiag({ lastError: "self-hosted STT unreachable" });
      setTranscript((t) => `${t}\n${SELF_HOSTED_STT_DEV_HINT}`);
      return;
    }
    if (voiceSttInputMode === "openai_stt" && !voicePreflight?.openaiStt?.apiKeyPresent) {
      mergeVoiceDiag({ lastError: "OpenAI STT not configured" });
      setTranscript((t) => `${t}\nOpenAI STT requires OPENAI_API_KEY on the server.`);
      return;
    }
    const provider = resolvedVoiceSttProvider;
    if (provider === "self_hosted_stt" || provider === "openai") {
      void runSelfHostedSttClip("oneshot");
      return;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      if (voiceSttInputMode === "browser_stt") {
        setVoiceSttUnsupported(true);
        mergeVoiceDiag({ lastError: "unsupported browser — SpeechRecognition API missing" });
        setTranscript((t) => `${t}\nSpeech recognition is not available in this browser.`);
        return;
      }
      const selfHostedConfigured = Boolean(selfHostedSttHealth?.enabled && selfHostedSttHealth?.baseUrlPresent);
      if (voiceSttInputMode !== "browser_stt" && selfHostedConfigured) {
        if (selfHostedSttReady) {
          void runSelfHostedSttClip("oneshot");
          return;
        }
        setVoiceSttUnsupported(false);
        mergeVoiceDiag({ lastError: "self-hosted STT unreachable" });
        setTranscript((t) => `${t}\n${SELF_HOSTED_STT_DEV_HINT}`);
        return;
      }
      if (voicePreflight?.openaiStt?.apiKeyPresent) {
        void runSelfHostedSttClip("oneshot");
        return;
      }
      setVoiceSttUnsupported(true);
      mergeVoiceDiag({ lastError: "unsupported browser — SpeechRecognition API missing" });
      setTranscript((t) => `${t}\nSpeech recognition is not available in this browser.`);
      return;
    }
    setVoiceSttUnsupported(false);
    setVoiceSttBusy(true);
    let sttStarted = 0;
    const rec = new Ctor();
    rec.lang = voiceSession?.clientConfig?.locale || "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const text = ev.results[0]?.[0]?.transcript?.trim();
      setVoiceSttBusy(false);
      mergeVoiceDiag({
        speechRecognitionMs: sttStarted ? Math.round(performance.now() - sttStarted) : null,
      });
      if (text) void submitVoiceTurn(text);
    };
    rec.onerror = () => {
      setVoiceSttBusy(false);
      mergeVoiceDiag({
        lastError: "speech recognition failed",
        speechRecognitionMs: sttStarted ? Math.round(performance.now() - sttStarted) : null,
      });
    };
    rec.onend = () => {
      setVoiceSttBusy(false);
      mergeVoiceDiag({
        speechRecognitionMs: sttStarted ? Math.round(performance.now() - sttStarted) : null,
      });
    };
    try {
      sttStarted = performance.now();
      sttRef.current = { stop: () => rec.stop() };
      rec.start();
    } catch {
      setVoiceSttBusy(false);
      mergeVoiceDiag({ lastError: "speech recognition failed to start" });
    }
  }, [
    voiceSttInputMode,
    selfHostedSttReady,
    selfHostedSttHealth,
    voicePreflight,
    resolvedVoiceSttProvider,
    voiceSession,
    submitVoiceTurn,
    mergeVoiceDiag,
    runSelfHostedSttClip,
  ]);

  const startVoiceCommandSession = useCallback(async () => {
    setBusy("voice");
    setVoiceApprovalFlash(false);
    setVoiceSttUnsupported(false);
    setVoiceDiagBase({ ...INITIAL_VOICE_DIAG_FIELDS });
    try {
      const r = await fetch("/api/admin/executive-agent/voice/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "browser_webrtc" }),
      });
      const j = (await r.json().catch(() => ({}))) as VoiceSessionJson & { error?: string; sessionId?: string };
      if (!r.ok) throw new Error(j.error ?? "Voice start failed");
      setVoiceSession(j);
      setVoicePendingAnalytics(null);
      setTranscript(
        "Voice session active — dictate a command (browser STT) or rely on live mic for the orb. Writes require approval in the queue.",
      );
      if (j.sessionId) void loadVoiceRail(j.sessionId);
      void loadExecutiveOutputVoice();
      void loadSelfHostedHealth();
      void loadSelfHostedSttHealth();
      void loadVoicePreflight();
      void loadExecutiveVoiceRuntimeDiagnostics();
    } catch (e) {
      setVoiceSession(null);
      setVoiceRailTurns([]);
      setVoicePendingAnalytics(null);
      setVoiceDiagBase({ ...INITIAL_VOICE_DIAG_FIELDS });
      setTranscript(e instanceof Error ? e.message : "Voice session failed");
    } finally {
      setBusy(null);
    }
  }, [loadVoiceRail, loadExecutiveOutputVoice, loadSelfHostedHealth, loadSelfHostedSttHealth, loadVoicePreflight, loadExecutiveVoiceRuntimeDiagnostics]);

  const endVoiceCommandSession = useCallback(async () => {
    const sid = voiceSession?.sessionId;
    if (!sid) {
      setVoiceSession(null);
      setVoiceRailTurns([]);
      setVoicePendingAnalytics(null);
      setVoiceDiagBase({ ...INITIAL_VOICE_DIAG_FIELDS });
      setTranscript("");
      return;
    }
    setBusy("voice");
    try {
      await fetch("/api/admin/executive-agent/voice/end", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
    } finally {
      setVoiceSession(null);
      setVoiceRailTurns([]);
      setTranscript("");
      setVoiceApprovalFlash(false);
      setVoicePendingAnalytics(null);
      setVoiceDiagBase({ ...INITIAL_VOICE_DIAG_FIELDS });
      try {
        sttRef.current?.stop();
      } catch {
        /* ignore */
      }
      sttRef.current = null;
      setBusy(null);
    }
  }, [voiceSession?.sessionId]);

  const approve = useCallback(
    async (row: ApprovalRow) => {
      const r = await fetch(`/api/admin/executive-agent/approvals/${encodeURIComponent(row.id)}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        status?: string;
        error?: string;
      };
      setLastApprovalExec({
        id: row.id,
        action: row.proposedAction,
        ok: Boolean(j.ok),
        message: j.message ?? j.error ?? (r.ok ? "Executed." : "Request failed"),
        status: j.status,
      });
      if (!r.ok) {
        window.alert(j.message ?? j.error ?? "Approve failed");
        return;
      }
      void loadApprovals();
    },
    [loadApprovals],
  );

  const reject = useCallback(
    async (id: string) => {
      const r = await fetch(`/api/admin/executive-agent/approvals/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) return;
      void loadApprovals();
    },
    [loadApprovals],
  );

  const toggleVoiceMode = () => {
    setVoiceMode((v) => !v);
  };

  const orbIntensity = voice.listening ? Math.min(1, voice.rms * 2.2) : idlePulse;
  const orbMode: ExecutiveOrbMode = useMemo(() => {
    if (voice.error) return "alert";
    if (voiceApprovalFlash) return "alert";
    if (busy === "chat" || busy === "voice_turn") return "processing";
    if (simSpeaking) return "speaking";
    if (voiceSttBusy || (voiceMode && voice.listening && voice.speaking)) return "speaking";
    if (voiceMode && voice.listening) return "listening";
    return "idle";
  }, [voice.error, voice.listening, voice.speaking, busy, simSpeaking, voiceApprovalFlash, voiceSttBusy, voiceMode]);

  const applySubject = useCallback((subject: ExecutiveSubjectConfig) => {
    setActiveSubjectId(subject.id);
    setSubjectChatOpen(true);
    const tabLabel = (BOTTOM_TABS as readonly string[]).includes(subject.navLabel)
      ? (subject.navLabel as (typeof BOTTOM_TABS)[number])
      : "Command Center";
    setBottomTab(tabLabel);
    setDashboardMode(subject.dashboardMode);
    setCustomAgents(new Set(subject.delegateAgents));
    if (subject.id === "inbox") {
      setSubjectChatOpen(false);
      void loadExecutiveInboxAdmin();
    } else if (subject.id === "ai_agents") setDataPreset("ALL");
    else if (subject.id === "analytics") setDataPreset("BENTLEY");
    else if (subject.id === "crm_intelligence" || subject.id === "trust_jarva") setDataPreset("EXECUTIVE_ADMIN");
    else if (subject.id === "command_center" || subject.id === "new_command") setDataPreset("ALL");
  }, [loadExecutiveInboxAdmin]);

  const mapTabToMode = (tab: (typeof BOTTOM_TABS)[number]) => {
    applySubject(getExecutiveSubject(subjectIdFromBottomTab(tab)));
  };

  const topPages = liveMetrics?.topPages?.items ?? [];
  const trafficRows =
    liveMetrics?.trafficAttribution?.items?.map((r) => ({
      name: r.source,
      visitors: r.visitors,
      join: r.joinCommunityClicks,
      paypal: r.outboundPayPalClicks,
      revenue: r.potentialRevenue,
    })) ?? [];
  const trafficUnavailable = trafficRows.length === 0;
  const ta = liveMetrics?.trafficAttribution;
  const bentleyBrief = summary?.bentleyBridge?.platform;
  const bentleyClientSlice = summary?.bentleyBridge?.clientScoped;

  const runtimeHudLabel =
    busy === "chat"
      ? "Orchestrating"
      : busy === "voice_turn"
        ? "Voice turn"
        : busy === "voice"
          ? "Voice I/O"
          : busy === "summary"
            ? "Summary"
            : busy === "live"
              ? "Live metrics"
              : busy === "intel"
                ? "Intel"
                : busy != null
                  ? String(busy)
                  : simSpeaking
                    ? "Sim speaking"
                    : "Ready";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#02070d] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.07),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(0,183,255,0.05),transparent_48%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,229,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.035)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />

      <div className="relative z-10 mx-auto max-w-[1920px] px-3 pb-36 pt-3 sm:px-5">
        <header className="mb-3 space-y-3 border-b border-[#00e5ff]/18 pb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-[0.26em] text-white sm:text-xl">Executive Administration</h1>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[#00b7ff]/65">
                Permissioned orchestration: reads run under policy; writes queue for approval and audit. Filters shape tool
                routing — they do not bypass controls.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[#00e5ff]/22 bg-[#050b13]/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 shadow-[inset_0_0_22px_rgba(0,229,255,0.04)]">
            <div className="flex min-w-[8rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Data source</span>
              <select
                value={dataPreset}
                onChange={(e) => {
                  const v = e.target.value as DataPreset;
                  setDataPreset(v);
                  if (v !== "CUSTOM") setCustomAgents(new Set(EXECUTIVE_AGENT_KEYS));
                }}
                className="max-w-[11rem] rounded border border-[#00e5ff]/25 bg-[#02070d] px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal text-[#00e5ff] outline-none focus:border-[#00e5ff]/55"
              >
                {DATA_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p === "ALL"
                      ? "All agents"
                      : p === "EXECUTIVE_ADMIN"
                        ? "Executive Admin"
                        : p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden h-8 w-px bg-[#00e5ff]/15 sm:block" aria-hidden />
            <div className="flex min-w-[5rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Mode</span>
              <select
                value={dashboardMode}
                onChange={(e) => setDashboardMode(e.target.value as ExecutiveDashboardMode)}
                className="max-w-[10rem] rounded border border-[#00e5ff]/25 bg-[#02070d] px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal text-[#00e5ff] outline-none focus:border-[#00e5ff]/55"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden h-8 w-px bg-[#00e5ff]/15 sm:block" aria-hidden />
            <div className="flex min-w-[5rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Time</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as (typeof TIME_OPTIONS)[number])}
                className="rounded border border-[#00e5ff]/25 bg-[#02070d] px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal text-[#00e5ff] outline-none focus:border-[#00e5ff]/55"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden h-8 w-px bg-[#00e5ff]/15 md:block" aria-hidden />
            <div className="flex min-w-[7rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Voice input</span>
              <span className="text-[9px] font-semibold normal-case tracking-normal text-slate-200">
                {voiceSttInputMode.replace(/_/g, " ")}
              </span>
            </div>
            <div className="hidden h-8 w-px bg-[#00e5ff]/15 lg:block" aria-hidden />
            <div className="flex min-w-[6rem] flex-1 flex-col gap-0.5 lg:items-end">
              <span className="text-[#00b7ff]/55">Clock</span>
              <span className="text-[9px] font-semibold tabular-nums normal-case tracking-normal text-[#00e5ff]/90">
                {hudClock.toLocaleTimeString()}
              </span>
            </div>
            <div className="hidden h-8 w-px bg-[#00e5ff]/15 lg:block" aria-hidden />
            <div className="flex min-w-[6rem] flex-col gap-0.5 lg:items-end">
              <span className="text-[#00b7ff]/55">Runtime</span>
              <span
                className={`text-[9px] font-semibold normal-case tracking-normal ${
                  busy != null ? "text-amber-300" : "text-emerald-300/95"
                }`}
              >
                {runtimeHudLabel}
              </span>
            </div>
            <div className="hidden h-8 w-px bg-[#00e5ff]/15 xl:block" aria-hidden />
            <div className="hidden min-w-[10rem] flex-col gap-0.5 xl:flex">
              <span className="text-[#00b7ff]/55">Workspace client</span>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client UUID"
                className="w-full rounded border border-[#00e5ff]/25 bg-[#02070d] px-1.5 py-1 text-[9px] font-mono normal-case tracking-normal text-[#00e5ff] outline-none"
              />
            </div>
            <div className="hidden min-w-[10rem] flex-col gap-0.5 xl:flex">
              <span className="text-[#00b7ff]/55">Fulfillment order</span>
              <input
                value={workspaceOrderId}
                onChange={(e) => setWorkspaceOrderId(e.target.value)}
                placeholder="Order UUID"
                className="w-full rounded border border-[#00e5ff]/25 bg-[#02070d] px-1.5 py-1 text-[9px] font-mono normal-case tracking-normal text-[#00e5ff] outline-none"
              />
            </div>
          </div>
        </header>

        {activeSubjectId === "inbox" ? (
          <section className="mb-4 rounded-2xl border border-[#00e5ff]/28 bg-slate-950/70 p-4 shadow-[0_0_28px_rgba(0,229,255,0.08)] backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/90">
                  Admin Executive inbox
                </h2>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Broadcast to approved accounts or send a direct message · members reply from their dashboard inbox
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadExecutiveInboxAdmin()}
                className="rounded-full border border-[#00e5ff]/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#00e5ff] hover:bg-[#050b13]/40"
              >
                Refresh
              </button>
            </div>
            <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={inboxBroadcast}
                onChange={(e) => {
                  const on = e.target.checked;
                  setInboxBroadcast(on);
                  if (on) {
                    setInboxRecipientFilter("");
                    setInboxTarget("");
                  }
                }}
              />
              Broadcast to all approved accounts
            </label>
            {!inboxBroadcast ? (
              <div className="mb-3 max-w-md space-y-2">
                <div className="text-[10px] text-slate-500">
                  Direct message: pick one <span className="text-slate-400">approved and active</span> marketplace
                  account. {inboxRecipients.length} account{inboxRecipients.length === 1 ? "" : "s"} in this list (server
                  cap 2,500).
                </div>
                <input
                  type="search"
                  value={inboxRecipientFilter}
                  onChange={(e) => setInboxRecipientFilter(e.target.value)}
                  placeholder="Filter by username or email…"
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm placeholder:text-slate-600"
                  autoComplete="off"
                />
                <select
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                  value={inboxTarget === "" ? "" : String(inboxTarget)}
                  onChange={(e) => setInboxTarget(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select recipient…</option>
                  {filteredInboxRecipients.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.email}) — id {u.id}
                    </option>
                  ))}
                </select>
                {inboxRecipientFilter.trim() && filteredInboxRecipients.length === 0 ? (
                  <p className="text-[10px] text-amber-300/90">No accounts match that filter.</p>
                ) : null}
              </div>
            ) : null}
            <textarea
              className="mb-2 min-h-[96px] w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
              placeholder="Message body (optional if you attach files or a voice note)…"
              value={inboxBody}
              onChange={(e) => setInboxBody(e.target.value)}
            />
            <input
              ref={inboxFileInputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadInboxFileFromInput(f);
                e.target.value = "";
              }}
            />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inboxFileInputRef.current?.click()}
                disabled={inboxPendingAttachments.length >= 5}
                className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                Attach file
              </button>
              <button
                type="button"
                onClick={() => (inboxRecording ? stopInboxVoiceRecording() : void startInboxVoiceRecording())}
                disabled={inboxPendingAttachments.length >= 5}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  inboxRecording
                    ? "border-rose-500/60 bg-rose-950/50 text-rose-200"
                    : "border-slate-600 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                } disabled:opacity-40`}
              >
                {inboxRecording ? "Stop recording" : "Record voice"}
              </button>
              <span className="text-[10px] text-slate-500">Up to 5 attachments · 12 MB each · images, PDF, audio</span>
            </div>
            {inboxPendingAttachments.length ? (
              <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-900/40 px-2 py-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pending attachments</div>
                <ExecutiveInboxAttachmentsList items={inboxPendingAttachments} compact />
                <button
                  type="button"
                  className="mt-2 text-[10px] text-rose-300 hover:underline"
                  onClick={() => setInboxPendingAttachments([])}
                >
                  Clear all
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void sendExecutiveInbox()}
              className="rounded-lg bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Send
            </button>
            <h3 className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Thread (oldest first)</h3>
            <ul className="mt-1 max-h-[min(32rem,60vh)] space-y-3 overflow-y-auto pr-1 text-[11px] text-slate-400">
              {inboxMessages.length === 0 ? (
                <li className="text-xs text-slate-500">No messages yet — send a broadcast or direct message above.</li>
              ) : (
                [...inboxMessages].reverse().map((m) => (
                  <li key={String(m.id)} className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800/60 pb-1">
                      <span className="font-mono text-[9px] uppercase text-slate-500">{String(m.kind ?? "")}</span>
                      <span className="text-[10px] text-slate-500">{formatExecutiveInboxTimestamp(m.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[10px] leading-snug text-cyan-200/90">
                      {formatExecutiveInboxRoutingLine(m, inboxRecipients, inboxDirectory)}
                    </div>
                    {String(m.bodyText ?? "").trim() ? (
                      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{String(m.bodyText)}</div>
                    ) : (
                      <div className="mt-2 text-[10px] italic text-slate-600">(No text — attachments only)</div>
                    )}
                    <ExecutiveInboxAttachmentsList items={parseInboxAttachmentsJson(m.attachmentsJson)} compact />
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : (
          <>
            <ExecutiveSubjectWorkspacePanel
              subjectId={activeSubjectId}
              clientId={clientId}
              orderId={workspaceOrderId}
              onSkipperContext={setSubjectSkipperContext}
            />
            <ExecutiveDecisionQueuePanel
              subjectId={activeSubjectId}
              clientId={clientId}
              orderId={workspaceOrderId}
              threadId={selectedOpsThreadId}
              onSelectThread={(id) => setSelectedOpsThreadId(id)}
              onDecisionRecorded={onOperationalCoordinationChange}
            />
            <ExecutiveTaskQueuePanel
              subjectId={activeSubjectId}
              clientId={clientId}
              orderId={workspaceOrderId}
              threadId={selectedOpsThreadId}
              onTasksChanged={onOperationalCoordinationChange}
            />
            <div className="mb-4 flex flex-col gap-3 lg:flex-row">
              <SubjectThreadSidebar
                key={threadSidebarKey}
                subjectId={activeSubjectId}
                clientId={clientId}
                orderId={workspaceOrderId}
                selectedThreadId={selectedOpsThreadId}
                onSelectThread={setSelectedOpsThreadId}
              />
              <div className="min-w-0 flex-1">
                <ExecutiveThreadPanel
                  threadId={selectedOpsThreadId}
                  onSkipperContext={setThreadSkipperContext}
                  onDecisionRecorded={onOperationalCoordinationChange}
                  onCreateThread={async () => {
                    const title = window.prompt("Thread title");
                    if (!title?.trim()) return;
                    const r = await fetch("/api/admin/executive-agent/threads", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: title.trim(),
                        threadKind: "subject",
                        subjectId: activeSubjectId,
                        clientId: clientId.trim() || null,
                        orderId: workspaceOrderId.trim() || null,
                      }),
                    });
                    const j = (await r.json().catch(() => ({}))) as { thread?: { id: string } };
                    if (j.thread?.id) setSelectedOpsThreadId(j.thread.id);
                  }}
                />
              </div>
            </div>
            {workspaceOrderId.trim() ? (
              <FulfillmentThreadView
                orderId={workspaceOrderId.trim()}
                clientId={clientId.trim() || undefined}
                department={
                  activeSubjectId === "trust_jarva"
                    ? "TRUST"
                    : activeSubjectId === "revenue_os"
                      ? "REVENUE_OS"
                      : activeSubjectId === "smart_trust"
                        ? "SMART_TRUST"
                        : "WEBSITE"
                }
                subjectId={
                  activeSubjectId === "trust_jarva"
                    ? "trust_jarva"
                    : activeSubjectId === "revenue_os"
                      ? "revenue_os"
                      : activeSubjectId === "smart_trust"
                        ? "smart_trust"
                        : "site_builder"
                }
              />
            ) : null}
            {subjectChatOpen ? (
              <ExecutiveSubjectAgentChatPanel
                subject={activeSubject}
                clientId={clientId}
                campaignId={campaignId}
                dryRun={dryRun}
                timeRange={timeRange}
                busy={busy !== null}
                skipperWorkspaceContext={combinedSkipperWorkspaceContext}
                onClose={() => setSubjectChatOpen(false)}
              />
            ) : (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSubjectChatOpen(true)}
                  className="rounded-full border border-[#00e5ff]/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#00e5ff] hover:bg-[#050b13]/50"
                >
                  Open {activeSubject.shortLabel} agent chat
                </button>
              </div>
            )}
          </>
        )}

        {bottomTab === "Settings" ? (
          <section className="mb-4 rounded-2xl border border-[#00e5ff]/20 bg-slate-950/70 p-4 backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/90">
                Settings — Scheduled routines
              </h2>
              <button
                type="button"
                disabled={executiveRoutinesBusy}
                onClick={() => void loadExecutiveRoutines()}
                className="rounded-full border border-[#00e5ff]/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#00e5ff] hover:bg-[#050b13]/40 disabled:opacity-40"
              >
                Refresh
              </button>
            </div>
            {executiveRoutinesError ? <p className="mb-2 text-xs text-amber-200">{executiveRoutinesError}</p> : null}
            {executiveRoutinesBusy && executiveRoutines.length === 0 ? (
              <p className="text-xs text-slate-500">Loading routines…</p>
            ) : (
              <ul className="space-y-3 text-xs">
                {executiveRoutines.map((rt) => {
                  let out: { riskFlags?: string[]; summary?: Record<string, unknown>; ok?: boolean } = {};
                  if (rt.lastOutputJson) {
                    try {
                      out = JSON.parse(rt.lastOutputJson) as typeof out;
                    } catch {
                      out = {};
                    }
                  }
                  const flags = Array.isArray(out.riskFlags) ? out.riskFlags : [];
                  return (
                    <li
                      key={rt.id}
                      className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-slate-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-[#00e5ff]">{rt.routineType}</span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">{rt.cadence}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={rt.enabled}
                            disabled={executiveRoutinesBusy}
                            onChange={(e) => void patchExecutiveRoutine(rt.id, { enabled: e.target.checked })}
                          />
                          Enabled
                        </label>
                        <button
                          type="button"
                          disabled={executiveRoutinesBusy}
                          onClick={() => void runExecutiveRoutineNow(rt.id)}
                          className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-100 hover:bg-emerald-950/30 disabled:opacity-40"
                        >
                          Run now
                        </button>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Last run: {rt.lastRunAt ? new Date(rt.lastRunAt).toLocaleString() : "—"} · Next:{" "}
                        {rt.nextRunAt ? new Date(rt.nextRunAt).toLocaleString() : "—"}
                      </div>
                      {flags.length ? (
                        <div className="mt-2 text-[10px] text-amber-200/90">Risk flags: {flags.join(", ")}</div>
                      ) : null}
                      {out.summary && typeof out.summary === "object" ? (
                        <pre className="mt-2 max-h-24 overflow-auto rounded border border-slate-800/80 bg-slate-950/80 p-2 text-[9px] text-slate-500">
                          {JSON.stringify(out.summary).length > 600
                            ? `${JSON.stringify(out.summary).slice(0, 600)}…`
                            : JSON.stringify(out.summary)}
                        </pre>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {!executiveRoutinesBusy && executiveRoutines.length === 0 ? (
              <p className="text-xs text-slate-500">No routines yet — daily briefing seed runs when you open this tab.</p>
            ) : null}
            <div className="mt-8 border-t border-[#00e5ff]/15 pt-4">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/90">Knowledge base</h2>
              {knowledgeError ? <p className="mb-2 text-xs text-amber-200">{knowledgeError}</p> : null}
              <div className="mb-3 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                  placeholder="Title"
                  value={knowledgeTitle}
                  onChange={(e) => setKnowledgeTitle(e.target.value)}
                />
                <button
                  type="button"
                  disabled={knowledgeBusy}
                  onClick={() => void postKnowledgeNote()}
                  className="rounded-lg bg-[#00e5ff] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Save note
                </button>
              </div>
              <textarea
                className="mb-3 min-h-[72px] w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                placeholder="Note body"
                value={knowledgeBody}
                onChange={(e) => setKnowledgeBody(e.target.value)}
              />
              <div className="mb-4 flex flex-wrap gap-2">
                <input
                  className="min-w-[12rem] flex-1 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                  placeholder="https://… public page to crawl"
                  value={knowledgeCrawlUrl}
                  onChange={(e) => setKnowledgeCrawlUrl(e.target.value)}
                />
                <button
                  type="button"
                  disabled={knowledgeBusy}
                  onClick={() => void postKnowledgeCrawl()}
                  className="rounded-lg border border-violet-500/40 px-3 py-2 text-sm text-violet-100 disabled:opacity-40"
                >
                  Crawl URL
                </button>
              </div>
              <ul className="max-h-40 space-y-2 overflow-y-auto text-xs text-slate-300">
                {knowledgeDocs.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-2 rounded border border-slate-800/80 bg-[#050b13]/75 px-2 py-1">
                    <span className="truncate">
                      <span className="font-mono text-[10px] text-slate-500">{d.sourceType}</span> · {d.title}
                    </span>
                    <button type="button" className="shrink-0 text-rose-300 hover:underline" onClick={() => void deleteKnowledgeDoc(d.id)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 border-t border-[#00e5ff]/15 pt-4">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/90">Question history</h2>
              <ul className="max-h-52 space-y-2 overflow-y-auto text-[11px] text-slate-400">
                {questionHistory.map((q) => (
                  <li key={q.id} className="rounded border border-slate-800/80 bg-slate-950/40 px-2 py-1">
                    <div className="font-mono text-[9px] text-slate-600">{q.source}</div>
                    <div className="text-slate-200">Q: {(q.question ?? "").slice(0, 160)}</div>
                    <div className="text-slate-500">A: {(q.answer ?? "").slice(0, 200)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {dataPreset === "CUSTOM" ? (
          <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-violet-400/20 bg-slate-950/60 px-3 py-3">
            <span className="w-full text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/70">
              Agent multi-select
            </span>
            {EXECUTIVE_AGENT_KEYS.map((key) => {
              const on = customAgents.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setCustomAgents((prev) => {
                      const n = new Set(prev);
                      if (n.has(key)) n.delete(key);
                      else n.add(key);
                      return n;
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition ${
                    on
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-600/60 text-slate-500"
                  }`}
                >
                  {AGENT_LABEL[key]}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Left: site + traffic */}
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 rounded-2xl border border-[#00e5ff]/18 bg-[#050b13]/85 p-4 shadow-[0_0_28px_rgba(0,229,255,0.06)] backdrop-blur-md xl:col-span-3"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/80">Site overview</h2>
            <div className="grid grid-cols-2 gap-2">
              <MetricTile
                label="Pending"
                value={liveMetrics?.pendingAccounts.value ?? summary?.pendingAccounts?.pendingAllTime}
                unavailable={Boolean(liveMetrics?.pendingAccounts.unavailable && liveMetrics?.pendingAccounts.value == null)}
                error={liveMetricsError}
              />
              <MetricTile
                label="Approved active"
                value={liveMetrics?.approvedAccounts.value ?? summary?.approvedAccounts?.approvedActive}
                unavailable={Boolean(liveMetrics?.approvedAccounts.unavailable)}
                error={liveMetricsError}
              />
              <MetricTile
                label="Active accounts"
                value={liveMetrics?.activeAccounts.value}
                unavailable={Boolean(liveMetrics?.activeAccounts.unavailable)}
                error={liveMetricsError}
              />
              <MetricTile
                label="Campaigns"
                value={liveMetrics?.campaignCounts.value ?? summary?.platform?.socialCampaigns}
                unavailable={Boolean(liveMetrics?.campaignCounts.unavailable)}
                error={liveMetricsError}
              />
            </div>
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/60">
                Active visitors / page views
              </h3>
              <p className="text-xs text-slate-500">
                {liveMetrics?.activeVisitors.unavailable
                  ? "Not configured — connect analytics to populate."
                  : liveMetrics?.activeVisitors.value ?? "—"}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/60">
                Traffic sources
              </h3>
              {trafficUnavailable ? (
                <p className="text-xs text-slate-500">Breakdown unavailable — no analytics events yet for this window.</p>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trafficRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={48} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} allowDecimals={false} width={32} />
                      <Tooltip
                        cursor={{ fill: "rgba(0,229,255,0.08)" }}
                        contentStyle={{ background: "#050b13", border: "1px solid rgba(0,229,255,0.3)", fontSize: 11 }}
                      />
                      <Bar dataKey="visitors" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-slate-900/45 p-3">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                Join community conversion
              </h3>
              <p className="font-mono text-lg text-white">
                {ta?.joinCommunityConversionRate != null ? `${(ta.joinCommunityConversionRate * 100).toFixed(1)}%` : "—"}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">
                PayPal intent rate:{" "}
                <span className="font-mono text-[#00e5ff]">
                  {ta?.paypalIntentRate != null ? `${(ta.paypalIntentRate * 100).toFixed(1)}%` : "—"}
                </span>
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">
                PayPal potential revenue (est.):{" "}
                <span className="font-mono text-emerald-200">
                  {ta?.potentialRevenueTotal != null ? `$${ta.potentialRevenueTotal.toFixed(0)}` : "—"}
                </span>
                {ta?.communityPrice != null ? (
                  <span className="text-slate-600">{` · $${ta.communityPrice}/join`}</span>
                ) : null}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/60">Top pages</h3>
              {liveMetrics?.topPages.unavailable || topPages.length === 0 ? (
                <p className="text-xs text-slate-500">No page-level rollups configured.</p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {topPages.map((pg) => (
                    <li key={pg.path} className="flex justify-between gap-2 border-b border-[#00e5ff]/10 py-1 font-mono text-[#00e5ff]/80">
                      <span className="truncate">{pg.path}</span>
                      <span>{pg.visitors ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>

          {/* Second left: agents */}
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-3 rounded-2xl border border-violet-400/15 bg-[#050b13]/75 p-4 backdrop-blur-md xl:col-span-2"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">Agent network</h2>
            {agentIntelError ? <p className="text-xs text-amber-200/90">{agentIntelError}</p> : null}
            <ul className="space-y-2 text-xs">
              {displayAgents.map((a) => (
                <li
                  key={a.agentKey}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-200">{a.displayName}</span>
                      <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-violet-300/80">
                        {AGENT_DOMAIN_LABEL[a.agentKey]}
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        a.status === "online" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-600"
                      }`}
                    />
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                    <div>
                      Active: {a.activeConversations ?? "—"} · Total: {a.totalConversations ?? "—"}
                    </div>
                    <div className="font-mono uppercase tracking-wide text-slate-600">src: {a.source}</div>
                    {a.lastActivityAt ? (
                      <div className="text-slate-600">Last: {new Date(a.lastActivityAt).toLocaleString()}</div>
                    ) : null}
                  </div>
                </li>
              ))}
              {activeSubjectId === "ai_agents" ? (
                <li className="rounded-lg border border-dashed border-violet-500/30 bg-violet-950/20 px-2 py-2">
                  <div className="font-medium text-slate-200">Maania</div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-violet-300/80">PROPERTY</div>
                  <p className="mt-1 text-[10px] text-slate-500">Routed via Skipper — full Maania API wiring later.</p>
                </li>
              ) : null}
              {activeSubjectId === "trust_jarva" ? (
                <li className="rounded-lg border border-dashed border-cyan-500/30 bg-cyan-950/20 px-2 py-2">
                  <div className="font-medium text-slate-200">Jarva</div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">TRUST</div>
                  <p className="mt-1 text-[10px] text-slate-500">TRUST legal-review desk — use chat + TRUST fulfillment panel.</p>
                </li>
              ) : null}
              {activeSubjectId === "revenue_os" ? (
                <li className="rounded-lg border border-dashed border-fuchsia-500/30 bg-fuchsia-950/20 px-2 py-2">
                  <div className="font-medium text-slate-200">Bentley</div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-fuchsia-300/80">REVENUE OS</div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Campaign fulfillment desk — review packets and launch readiness checkpoints only.
                  </p>
                </li>
              ) : null}
              {activeSubjectId === "smart_trust" ? (
                <li className="rounded-lg border border-dashed border-amber-500/30 bg-amber-950/20 px-2 py-2">
                  <div className="font-medium text-slate-200">Skipper</div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-amber-300/80">SMART TRUST</div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Trust governance desk — review checkpoints and resolution records only.
                  </p>
                </li>
              ) : null}
            </ul>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/60">Activity</h3>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-[11px] text-slate-400">
              {activityFeed.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`} className="border-l border-[#00e5ff]/20 pl-2">
                  {line}
                </li>
              ))}
            </ul>
          </motion.aside>

          {/* Center */}
          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-4 xl:col-span-4"
          >
            <section className="rounded-2xl border border-amber-400/25 bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                  Today{"'"}s Executive Briefing
                </h2>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={briefingBusy || busy !== null}
                    onClick={() => void loadBriefingToday()}
                    className="rounded-full border border-amber-400/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-amber-100 hover:bg-amber-950/40 disabled:opacity-40"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    disabled={briefingBusy || busy !== null}
                    onClick={() => void generateBriefing()}
                    className="rounded-full border border-amber-300/50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-amber-50 hover:bg-amber-900/30 disabled:opacity-40"
                  >
                    Generate today
                  </button>
                </div>
              </div>
              {dailyBriefingError ? <p className="mb-2 text-xs text-amber-200/90">{dailyBriefingError}</p> : null}
              {briefingBusy && !dailyBriefing ? <p className="text-xs text-slate-500">Loading briefing…</p> : null}
              {dailyBriefing ? (
                <div className="space-y-3 text-xs text-slate-200">
                  <p className="font-medium text-amber-50/95">{dailyBriefing.headline}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00e5ff]/70">
                        Top priorities
                      </h3>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        {(dailyBriefing.priorities ?? []).slice(0, 3).map((p, i) => (
                          <li key={`p-${i}`} className="rounded border border-[#00e5ff]/10 bg-slate-900/40 px-2 py-1.5">
                            <div className="font-medium text-slate-100">{p.title}</div>
                            <div className="mt-0.5 text-slate-500">{p.detail}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/70">Risks</h3>
                      <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-400">
                        {(dailyBriefing.risks ?? []).slice(0, 6).map((p, i) => (
                          <li key={`r-${i}`}>· {p.title}</li>
                        ))}
                      </ul>
                      <h3 className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
                        Opportunities
                      </h3>
                      <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-slate-400">
                        {(dailyBriefing.opportunities ?? []).slice(0, 5).map((p, i) => (
                          <li key={`o-${i}`}>· {p.title}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">
                      Approvals waiting
                    </h3>
                    <ul className="max-h-24 space-y-1 overflow-y-auto font-mono text-[10px] text-violet-100/90">
                      {(dailyBriefing.approvalsNeeded ?? []).slice(0, 8).map((a) => (
                        <li key={a.id}>
                          {a.proposedAction}: {a.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Suggested first actions
                    </h3>
                    <ul className="space-y-1 text-[11px] text-slate-400">
                      {(dailyBriefing.suggestedFirstActions ?? []).slice(0, 6).map((p, i) => (
                        <li key={`a-${i}`}>
                          <span className="text-slate-200">{p.title}</span> — {p.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : !briefingBusy ? (
                <p className="text-xs text-slate-500">
                  No cached briefing for today — use Generate to build one from live signals and memory.
                </p>
              ) : null}
            </section>

            <div className="relative aspect-[5/4] max-h-[min(62vh,640px)] w-full max-w-xl mx-auto overflow-hidden rounded-3xl border border-[#00e5ff]/30 bg-[#02070d]/80 shadow-[0_0_48px_rgba(0,229,255,0.14),inset_0_0_40px_rgba(0,183,255,0.06)]">
              {executiveOutputVoice?.voiceProvider === "self_hosted_tts" &&
              selfHostedHealth &&
              !executiveSelfHostedVoiceReady(selfHostedHealth) ? (
                <div className="pointer-events-none absolute inset-x-0 -top-1 z-10 flex justify-center px-2">
                  <p className="max-w-md rounded-lg border border-amber-400/45 bg-amber-950/85 px-3 py-2 text-center text-[11px] leading-snug text-amber-50/95 shadow-lg">
                    Self-hosted voice engine unavailable. Falling back to browser voice.
                  </p>
                </div>
              ) : null}
              <ExecutiveOrb
                intensity={orbIntensity}
                mode={orbMode}
                activeAgentCount={selectedAgents.length}
                focusMode={dashboardMode.replace(/_/g, " ")}
              />
              <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-[#00e5ff]/35 bg-[#02070d]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]">
                {busy === "voice_turn"
                  ? "Processing"
                  : voiceApprovalFlash
                    ? "Approvals"
                    : voiceSttBusy
                      ? "Dictating"
                      : simSpeaking
                        ? "Speaking"
                        : voiceMode && voice.listening
                          ? "Live mic"
                          : "Standby"}
              </div>
              {voicePendingAnalytics ? (
                <p className="pointer-events-none absolute left-3 top-14 z-[5] max-w-[15rem] rounded-lg border border-[#00e5ff]/30 bg-[#02070d]/90 px-2 py-1.5 text-[10px] leading-snug text-[#00e5ff]/90 shadow-md">
                  Say <span className="font-semibold text-white">site visits</span>,{" "}
                  <span className="font-semibold text-white">active users</span>,{" "}
                  <span className="font-semibold text-white">traffic sources</span>, or{" "}
                  <span className="font-semibold text-white">conversions</span> to load today&apos;s analytics.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#00e5ff]/15 bg-[#050b13]/75 p-3 backdrop-blur-md sm:grid-cols-4">
              {[
                { k: "Threads (7d)", v: summary?.inbox?.threadsLast7d ?? liveMetrics?.engagement.value },
                { k: "CRM clients", v: summary?.platform?.crmClients },
                { k: "Marketplace users", v: summary?.platform?.marketplaceUsers },
                { k: "Social campaigns", v: summary?.platform?.socialCampaigns },
              ].map((x) => (
                <div key={x.k} className="rounded-lg border border-slate-800/80 bg-slate-900/30 px-2 py-2">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{x.k}</div>
                  <div className="mt-1 font-mono text-sm text-white">{x.v ?? "—"}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[#00e5ff]/15 bg-[#050b13]/75 p-3 backdrop-blur-md">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/70">Voice command</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                    Voice input
                    <select
                      value={voiceSttInputMode}
                      onChange={(e) => setVoiceSttInputMode(e.target.value as ExecutiveSttInputMode)}
                      className="rounded border border-slate-600 bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-mono normal-case tracking-normal text-[#00e5ff]"
                    >
                      <option value="auto">Auto</option>
                      <option value="browser_stt">Browser STT</option>
                      <option value="self_hosted_stt">Self-hosted STT</option>
                      <option value="openai_stt">OpenAI STT</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void startVoiceCommandSession()}
                    className="rounded-full border border-[#00e5ff]/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#00e5ff] hover:bg-[#050b13]/40 disabled:opacity-40"
                  >
                    Start session
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || !voiceSession?.sessionId}
                    onClick={() => void endVoiceCommandSession()}
                    className="rounded-full border border-slate-600 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    End session
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || voiceSttBusy}
                    onClick={() => runOneShotDictation()}
                    className="rounded-full border border-violet-400/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-950/30 disabled:opacity-40"
                  >
                    Dictate
                  </button>
                  </div>
                </div>
              </div>
              <div className="flex h-12 items-end justify-center gap-0.5 rounded-lg border border-[#00e5ff]/10 bg-slate-900/60 px-1 py-1">
                {(voice.bands.length ? voice.bands : Array.from({ length: 32 }, () => orbIntensity)).map((h, i) => (
                  <motion.span
                    key={i}
                    className="w-1 rounded-t bg-gradient-to-t from-[#00A3FF]/30 to-[#00A3FF]"
                    animate={{ height: Math.max(4, 4 + h * 44) }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Session: {voiceSession?.sessionId ?? "—"} · Provider: {voiceSession?.provider ?? "—"} · In:{" "}
                {voiceSession?.inputMode ?? "—"} · Out: {voiceSession?.outputMode ?? "—"}
              </p>
              {voice.error ? <p className="mt-1 text-xs text-red-300">{voice.error}</p> : null}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2 text-xs text-slate-300">
                  <span className="font-semibold text-[#00e5ff]/80">Live log</span>
                  <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-slate-400">{transcript || "—"}</p>
                </div>
                <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2 text-xs text-slate-300">
                  <span className="font-semibold text-[#00e5ff]/80">Turn rail</span>
                  <ul className="mt-1 max-h-32 space-y-2 overflow-y-auto text-[11px] text-slate-400">
                    {voiceRailTurns.length === 0 ? (
                      <li className="text-slate-600">No turns yet.</li>
                    ) : (
                      voiceRailTurns.map((t) => (
                        <li key={t.id} className="border-b border-slate-800/80 pb-2 last:border-0">
                          <div className="font-mono text-[10px] text-slate-500">
                            +{t.proposedApprovalsCount} approvals · {t.createdAt ?? ""}
                          </div>
                          <div className="text-slate-300">
                            You:{" "}
                            {t.transcriptText.length > 160 ? `${t.transcriptText.slice(0, 160)}…` : t.transcriptText}
                          </div>
                          <div className="text-slate-500">
                            Exec:{" "}
                            {t.responseText.length > 200 ? `${t.responseText.slice(0, 200)}…` : t.responseText}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-[#00e5ff]/15 bg-[#050b13]/75 p-4 backdrop-blur-md">
              <div className="flex gap-2">
                <textarea
                  className="min-h-[100px] min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none ring-0 focus:border-[#00e5ff]/50"
                  placeholder="Ask about accounts, campaigns, Site Builder, or CRM…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <button
                  type="button"
                  title="Speak to text (browser STT or self-hosted STT)"
                  aria-label="Microphone — speak to text"
                  disabled={busy !== null || voiceSttBusy}
                  onClick={() => runMicNearInput()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00e5ff]/40 bg-slate-900/80 text-[#00e5ff] hover:bg-[#050b13]/50 disabled:opacity-40"
                >
                  <Mic className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                  Dry run (no approval queue writes)
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                  placeholder="Client UUID (optional — enables Bentley client slice + follow-up approvals)"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                  placeholder="Campaign UUID (optional)"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void sendChat()}
                  className="rounded-xl bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#33b4ff] disabled:opacity-40"
                >
                  {busy === "chat" ? "Running…" : "Run orchestration"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void loadSummary()}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  Refresh summary
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void loadLiveMetrics()}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  Live metrics
                </button>
              </div>
              {chatError ? <p className="text-xs text-amber-200">{chatError}</p> : null}
              {chatResult?.plannerMeta ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Intent</span>
                  <span className="rounded-md bg-slate-800/90 px-2 py-0.5 font-medium text-slate-200">
                    {chatResult.plannerMeta.reasoningMode === "deterministic"
                      ? "Deterministic mode"
                      : chatResult.plannerMeta.reasoningMode === "llm"
                        ? "LLM mode"
                        : "Fallback mode"}
                  </span>
                  <span>
                    Confidence{" "}
                    <span className="font-mono text-[#00e5ff]/90">
                      {(Math.min(1, Math.max(0, chatResult.plannerMeta.confidence)) * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span>
                    Proposed approvals{" "}
                    <span className="font-mono text-amber-200/90">{chatResult.plannerMeta.proposedApprovalsCount}</span>
                  </span>
                </div>
              ) : null}
              {(() => {
                const items = chatResult?.suggestedMemoryItems ?? [];
                const visible = items.filter((s) => !dismissedMemorySuggestions[memorySuggestionKey(s)]);
                if (!visible.length) return null;
                return (
                  <div className="mt-3 rounded-lg border border-violet-400/25 bg-violet-950/20 p-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                      Memory suggestions (not saved until you confirm)
                    </div>
                    <ul className="space-y-2">
                      {visible.map((s) => {
                        const k = memorySuggestionKey(s);
                        return (
                          <li key={k} className="rounded-md border border-violet-500/15 bg-[#050b13]/75 p-2 text-[11px] text-slate-300">
                            <div className="font-medium text-violet-100">
                              [{s.memoryType}] {s.title}
                            </div>
                            <div className="mt-1 line-clamp-3 text-slate-500">{s.summary}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={memorySaveBusyKey === k || busy !== null}
                                onClick={() => void saveMemorySuggestion(s)}
                                className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-40"
                              >
                                {memorySaveBusyKey === k ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => dismissMemorySuggestion(s)}
                                className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                              >
                                Dismiss
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
              {chatResult?.answer ? <p className="text-sm leading-relaxed text-slate-200">{chatResult.answer}</p> : null}
              {chatResult?.answer && lastChatTurn ? (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-800/80 pt-2">
                  <span className="w-full text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Feedback</span>
                  <button
                    type="button"
                    disabled={busy !== null || learningFeedbackBusy !== null}
                    onClick={() => void onChatFeedbackHelpful()}
                    className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90 hover:bg-emerald-900/40 disabled:opacity-40"
                  >
                    {learningFeedbackBusy === "helpful" ? "…" : "Helpful"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || learningFeedbackBusy !== null}
                    onClick={() => void onChatFeedbackNotHelpful()}
                    className="rounded-full border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100/90 hover:bg-amber-900/40 disabled:opacity-40"
                  >
                    {learningFeedbackBusy === "not_helpful" ? "…" : "Not helpful"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || learningFeedbackBusy !== null}
                    onClick={() => void onChatFeedbackSaveMemory()}
                    className="rounded-full border border-violet-500/30 bg-violet-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100/90 hover:bg-violet-900/40 disabled:opacity-40"
                  >
                    {learningFeedbackBusy === "save_memory" ? "…" : "Save as memory"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || learningFeedbackBusy !== null}
                    onClick={() => void onChatFeedbackSuggestImprovement()}
                    className="rounded-full border border-[#00e5ff]/30 bg-[#050b13]/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#00e5ff]/90 hover:bg-[#0a1522]/50 disabled:opacity-40"
                  >
                    {learningFeedbackBusy === "suggest_improvement" ? "…" : "Suggest improvement"}
                  </button>
                </div>
              ) : null}
              {chatResult?.insights?.length ? (
                <ul className="max-h-40 space-y-2 overflow-y-auto text-xs text-slate-400">
                  {chatResult.insights.map((i) => (
                    <li key={i.title} className="border-b border-slate-800/60 pb-2">
                      <span className="font-semibold text-[#00e5ff]/90">{i.title}</span>
                      <div className="mt-0.5">{i.detail}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </motion.main>

          {/* Right */}
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4 rounded-2xl border border-[#00e5ff]/16 bg-[#050b13]/88 p-4 shadow-[0_0_24px_rgba(0,229,255,0.05)] backdrop-blur-md xl:col-span-3"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00b7ff]/85">Operations</h2>
            <div className="rounded-xl border border-red-400/20 bg-red-950/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-red-200/90">Pending approvals</span>
                <span className="rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-bold text-white">{approvals.length}</span>
              </div>
              {approvals.length === 0 ? (
                <p className="mt-2 text-[11px] text-slate-500">No pending proposals.</p>
              ) : (
                <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto text-[11px]">
                  {approvals.map((a) => (
                    <li key={a.id} id={`executive-approval-${a.id}`} className="rounded-lg border border-slate-700/50 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#00e5ff]/90">
                          {a.proposedAction}
                        </span>
                        <span className="text-[10px] text-slate-600">{a.id.slice(0, 8)}…</span>
                      </div>
                      <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800/80 bg-slate-950/80 p-2 font-mono text-[9px] text-slate-400">
                        {formatApprovalPayloadPreview(a.payloadJson)}
                      </pre>
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          className="rounded bg-emerald-600/90 px-2 py-1 text-[10px] text-white"
                          onClick={() => void approve(a)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-200"
                          onClick={() => void reject(a.id)}
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {lastApprovalExec ? (
                <div
                  className={`mt-3 rounded-lg border p-2 text-[11px] ${
                    lastApprovalExec.ok ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100/90" : "border-amber-500/30 bg-amber-950/20 text-amber-100/90"
                  }`}
                >
                  <div className="font-semibold uppercase tracking-wide text-[10px] text-slate-400">Last execution</div>
                  <div className="mt-1 font-mono text-[10px]">{lastApprovalExec.action}</div>
                  <p className="mt-1">{lastApprovalExec.message}</p>
                  {lastApprovalExec.status ? (
                    <p className="mt-1 text-[10px] text-slate-500">Status: {lastApprovalExec.status}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <ExecutiveOperationsBriefingPanel
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <ExecutiveKpiOverviewPanel />
            <OperationalHealthPanel />
            <FulfillmentForecastPanel />
            <ForecastRiskPanel />
            <ExecutiveOperatorPanel />
            <OperatorWorkloadPanel />
            <DelegationQueuePanel
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <EscalationPanel
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <ExecutiveSimulationPanel />
            <SimulationForecastPanel />
            <ScenarioComparisonPanel />
            <BottleneckCascadePanel />
            <ExecutiveKnowledgeGraphPanel />
            <StrategicMemoryPanel />
            <OrganizationalIntelligencePanel />
            <HistoricalContextPanel />
            <ExecutivePlanningPanel />
            <RecoveryPlanningPanel />
            <StaffingPlanningPanel />
            <InitiativePlanningPanel />
            <ExecutiveCommandCenterPanel />
            <IncidentIntelligencePanel />
            <LiveOperationalFeedPanel />
            <GovernanceAlertPanel />
            <CrisisCoordinationPanel />
            <ExecutiveAutomationPanel />
            <ExecutionApprovalPanel onExecuted={() => void loadApprovals()} />
            <RollbackControlPanel onRolledBack={() => void loadApprovals()} />
            <AutomationHistoryPanel />
            <ExecutiveAgentCoordinationPanel />
            <AgentWorkspacePanel />
            <AgentRoutingPanel
              onRouted={(approvalId) => {
                if (approvalId) {
                  document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                  });
                }
                void loadApprovals();
              }}
            />
            <CrossAgentEscalationPanel />
            <OperationalMemoryInsightsPanel />
            <FulfillmentOrdersPanel
              defaultClientId={clientIdTrim}
              onApprovalsRefresh={() => void loadApprovals()}
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <TrustFulfillmentOrdersPanel
              defaultClientId={clientIdTrim}
              onApprovalsRefresh={() => void loadApprovals()}
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <RevenueOsFulfillmentPanel
              defaultClientId={clientIdTrim}
              onApprovalsRefresh={() => void loadApprovals()}
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <SmartTrustOperationsPanel
              defaultClientId={clientIdTrim}
              onApprovalsRefresh={() => void loadApprovals()}
              onOpenApproval={(approvalId) => {
                document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
            />
            <div className="rounded-xl border border-[#00e5ff]/15 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/70">Recent conversations</h3>
              {recentConversationsError ? (
                <p className="mt-2 text-xs text-amber-200/90">{recentConversationsError}</p>
              ) : recentConversations.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No recent threads returned — sources may be empty or unavailable.</p>
              ) : (
                <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-[11px]">
                  {recentConversations.map((c) => (
                    <li key={c.id} className="rounded-lg border border-slate-700/50 p-2">
                      <div className="flex justify-between gap-2 text-slate-400">
                        <span className="font-medium text-slate-200">{c.displayName}</span>
                        <span className="shrink-0 font-mono text-[9px] uppercase">{c.source}</span>
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {c.agentKey} · {c.userLabel}
                        {c.clientId ? ` · client ${c.clientId.slice(0, 8)}…` : ""}
                      </div>
                      <p className="mt-1 line-clamp-2 text-slate-400">{c.snippet || "—"}</p>
                      <div className="mt-1 text-[10px] text-slate-600">{new Date(c.lastMessageAt).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-950/10 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">Follow-up signals</h3>
              {followUpError ? (
                <p className="mt-2 text-xs text-amber-200/90">{followUpError}</p>
              ) : followUpRecommendations.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No actionable recommendations right now.</p>
              ) : (
                <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto text-[11px]">
                  {followUpRecommendations.map((rec) => (
                    <li key={rec.id} className="rounded-lg border border-slate-700/50 p-2">
                      <div className="font-medium text-slate-200">{rec.title}</div>
                      <p className="mt-1 text-slate-400">{rec.detail}</p>
                      <button
                        type="button"
                        disabled={followUpQueueBusyId === rec.id}
                        onClick={() => void queueFollowUpRecommendation(rec)}
                        className="mt-2 rounded bg-[#00e5ff]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-40"
                      >
                        {followUpQueueBusyId === rec.id ? "Queueing…" : "Queue approval (internal note)"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10px] text-slate-600">
                Requires CRM client UUID in the panel — queues a createTodo proposal for explicit approval only.
              </p>
            </div>
            <div className="rounded-xl border border-violet-400/20 bg-violet-950/20 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/80">Bentley readiness</h3>
              {!bentleyBrief ? (
                <p className="mt-2 text-xs text-slate-500">Summary did not include Bentley bridge data.</p>
              ) : (
                <div className="mt-2 space-y-2 text-[11px] text-slate-400">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>Campaigns w/ payload: {bentleyBrief.campaignsWithBentleyPayloadApprox ?? "—"}</span>
                    <span>Scheduled posts: {bentleyBrief.postsScheduledApprox ?? "—"}</span>
                    <span>Draft/fail unsched.: {bentleyBrief.postsBlockedOrDraftUnscheduledApprox ?? "—"}</span>
                  </div>
                  <div>
                    Pending approvals (you): {bentleyBrief.pendingExecutiveApprovalsForAdmin ?? "—"} · Content360 platform:{" "}
                    {bentleyBrief.content360PlatformConfigured ? "configured" : "not configured"}
                  </div>
                  {bentleyBrief.unavailable ? (
                    <p className="text-amber-200/80">Platform-wide Bentley tables returned no rollups (partial or missing).</p>
                  ) : null}
                  {bentleyBrief.latestCadenceRuns && bentleyBrief.latestCadenceRuns.length > 0 ? (
                    <p className="text-slate-500">Latest cadence runs: {bentleyBrief.latestCadenceRuns.length} row(s) loaded.</p>
                  ) : (
                    <p className="text-slate-500">No recent cadence runs in window.</p>
                  )}
                  {bentleyBrief.notes && bentleyBrief.notes.length > 0 ? (
                    <ul className="list-disc pl-4 text-[10px] text-slate-600">
                      {bentleyBrief.notes.slice(0, 4).map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  ) : null}
                  {clientIdTrim && bentleyClientSlice ? (
                    <div className="rounded border border-slate-700/60 p-2 text-[10px] text-slate-500">
                      Client slice — campaigns w/ payload: {bentleyClientSlice.campaignsWithPayload ?? "—"}, scheduled:{" "}
                      {bentleyClientSlice.scheduledPosts ?? "—"}, stuck: {bentleyClientSlice.stuckDraftOrFailed ?? "—"}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[#00e5ff]/12 bg-[#02070d]/70 p-3 text-xs shadow-[inset_0_0_20px_rgba(0,229,255,0.04)]">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00b7ff]/70">System health</h3>
              <ul className="mt-2 space-y-1">
                <li className="flex justify-between">
                  <span>Database</span>
                  <span className="text-emerald-300">{liveMetrics?.systemHealth.database ?? "ok"}</span>
                </li>
                <li className="flex justify-between">
                  <span>API services</span>
                  <span className="text-emerald-300">{liveMetrics?.systemHealth.apiServices ?? "ok"}</span>
                </li>
                <li className="flex justify-between">
                  <span>Read tools</span>
                  <span className="text-emerald-300">{liveMetrics?.systemHealth.executiveReadTools ?? "ok"}</span>
                </li>
              </ul>
            </div>
            {voicePreflight?.nextSteps && voicePreflight.nextSteps.length > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-50/95 shadow-[inset_0_0_16px_rgba(251,191,36,0.06)]">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">Voice preflight</h3>
                <p className="mt-1 text-[10px] text-amber-100/80">Server checks (no secrets). Fix env on the deployment, then refresh.</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-50/90">
                  {voicePreflight.nextSteps.slice(0, 6).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <VoiceCommandDiagnosticsPanel
              data={voiceDiagnostics}
              defaultCollapsed={false}
              voiceSttInputMode={voiceSttInputMode}
              voiceSessionId={voiceSession?.sessionId ?? null}
              voicePendingAnalytics={voicePendingAnalytics}
              onTestSttHealth={() => void refreshExecutiveVoiceSttDiagnostics()}
              onTestSelfHostedStt={() => void runSelfHostedSttTestClip()}
              sttTestBusy={sttTestBusy}
              sttTestTranscript={sttTestTranscript}
            />
            {learningPendingPreview ? (
              <div className="rounded-xl border border-violet-500/20 bg-violet-950/15 p-3 text-[11px] text-slate-300">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/80">SKIPPER learning inbox</h3>
                <p className="mt-1 text-slate-400">
                  Pending: {learningPendingPreview.improvements} prompt suggestion(s),{" "}
                  {learningPendingPreview.capabilities} capability note(s), {learningPendingPreview.overlays} overlay(s) awaiting
                  activation.
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Review via{" "}
                  <code className="rounded bg-slate-900 px-1 py-0.5 text-[9px]">GET /api/admin/executive-agent/learning/pending</code>{" "}
                  — overlays never auto-apply without admin action.
                </p>
              </div>
            ) : null}
            {summaryError ? <p className="text-xs text-amber-200">{summaryError}</p> : null}
            {chatResult?.charts?.length ? (
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/70">Charts</h3>
                {chatResult.charts.map((c) => (
                  <div key={c.title} className="rounded-lg border border-slate-700/50 p-2 text-[11px]">
                    <div className="font-medium text-slate-200">{c.title}</div>
                    <ul className="mt-1 space-y-0.5 text-slate-400">
                      {c.series.map((s) => (
                        <li key={s.label} className="flex justify-between gap-2">
                          <span>{s.label}</span>
                          <span className="text-[#00e5ff]">{s.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.aside>
        </div>
      </div>

      <ExecutiveSubjectNavBar activeSubjectId={activeSubjectId} onSelectSubject={applySubject} />
    </div>
  );
}

function MetricTile({
  label,
  value,
  unavailable,
  error,
}: {
  label: string;
  value?: number | null;
  unavailable?: boolean;
  error: string | null;
}) {
  const show = error ? "—" : value ?? (unavailable ? "—" : "—");
  return (
    <div className="rounded-xl border border-[#00e5ff]/15 bg-[#02070d]/80 p-2 shadow-[inset_0_0_16px_rgba(0,229,255,0.03)]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#00b7ff]/60">{label}</div>
      <div className="mt-1 font-mono text-lg text-white">{show}</div>
      {unavailable && value == null ? <div className="text-[9px] text-slate-600">Unavailable</div> : null}
    </div>
  );
}
