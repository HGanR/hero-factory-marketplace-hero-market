"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ExecutiveCollapsibleTile } from "./ExecutiveCollapsibleTile";
import { ExecutiveSubjectNavBar } from "./ExecutiveSubjectNavBar";
import { operationalOrbBadgeLabel } from "./ExecutivePresencePanel";
import { OperationalPresenceStatusBar } from "./OperationalPresenceStatusBar";
import { ExecutiveInterruptionPanel } from "./ExecutiveInterruptionPanel";
import { ExecutiveCommandPromptSelector } from "./ExecutiveCommandPromptSelector";
import { ExecutiveSkipperCommandStage } from "./ExecutiveSkipperCommandStage";
import { ExecutiveCommandHudContent } from "./ExecutiveCommandHudContent";
import { ExecutiveBentleyCampaignProvider } from "./ExecutiveBentleyCampaignProvider";
import { tryExecutiveBentleyVoiceBridge } from "@/lib/revenue-os/executive-bentley-voice-bridge";
import type { ExecutiveOrbCanvasProps } from "./ExecutiveOrbCanvas";
import type { ExecutiveVoiceDiagnostics } from "./VoiceCommandDiagnosticsPanel";
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
import type { ExecutivePresenceSnapshot } from "@/lib/executive-agent/executive-presence-types";
import type {
  AmbientExecutiveSignal,
  AmbientOrbState,
  ExecutiveAmbientSignalOverview,
} from "@/lib/executive-agent/executive-ambient-signal-types";
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
import {
  executiveCommandPromptForOperationalKind,
  resolveExecutiveCommandPromptFromVoice,
  type ExecutiveCommandPromptId,
} from "@/lib/executive-agent/executive-command-prompts";
import { executiveInboxUploadErrorMessage } from "@/lib/executive-inbox/executive-inbox-upload-errors";
import {
  normalizeExecutiveInboxUploadFile,
  pickExecutiveInboxMediaRecorderMimeType,
} from "@/lib/executive-inbox/executive-inbox-upload-mime";
import { useExecutiveCinematicPresence } from "@/lib/executive-agent/executive-cinematic-presence";
import {
  getExecutiveAudioPresence,
  isExecutiveAudioPresenceEnabled,
  setExecutiveAudioPresenceEnabled,
} from "@/lib/executive-agent/executive-audio-presence";
import { resolveVoiceOperationalQuery } from "@/lib/executive-agent/executive-voice-operational-phrases";

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
    voiceShortCircuit?: "greeting" | "analytics_clarification" | "operational_query" | "operational_followup";
    pendingVoiceIntent?: { intent: string; createdAt: string };
    voiceUiAction?: {
      type: "play_inbox_audio";
      messageId: string;
      attachmentId: string;
      url: string;
      filename: string;
      mimeType: string;
    };
    voiceOperationalData?: { phoneQueueRevealed?: boolean };
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
  "Stephon",
  "Analytics",
  "Inbox",
  "Tasks",
  "Jarva",
  "TROO TOWN",
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
  const [executivePresence, setExecutivePresence] = useState<ExecutivePresenceSnapshot | null>(null);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [dismissedInterruptions, setDismissedInterruptions] = useState<Set<string>>(() => new Set());
  const [ambientOverview, setAmbientOverview] = useState<ExecutiveAmbientSignalOverview | null>(null);
  const [ambientOrbState, setAmbientOrbState] = useState<AmbientOrbState | null>(null);
  const [ambientInterruptions, setAmbientInterruptions] = useState<AmbientExecutiveSignal[]>([]);
  const [ambientLoading, setAmbientLoading] = useState(false);
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
  const [analyticsFocusSeq, setAnalyticsFocusSeq] = useState(0);
  const [activeCommandPromptId, setActiveCommandPromptId] = useState<ExecutiveCommandPromptId | null>(null);
  const [bentleyCampaignModeActive, setBentleyCampaignModeActive] = useState(false);
  const [hudSummary, setHudSummary] = useState<string | null>(null);
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
  const [voiceOpsRefreshSeq, setVoiceOpsRefreshSeq] = useState(0);
  const [voicePhoneQueueRevealed, setVoicePhoneQueueRevealed] = useState(false);
  const [voicePendingInboxAudio, setVoicePendingInboxAudio] = useState<{
    messageId: string;
    attachmentId: string;
    url: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [voicePendingOperational, setVoicePendingOperational] = useState<{ intent: string; createdAt: string } | null>(
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
    kind: "file" | "audio" | "site_project";
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    projectType?: "vercel_nextjs";
  };
  const [inboxPendingAttachments, setInboxPendingAttachments] = useState<InboxPendingAttachment[]>([]);
  const [inboxUploadError, setInboxUploadError] = useState<string | null>(null);
  const [inboxUploadBusy, setInboxUploadBusy] = useState(false);
  const [inboxRecording, setInboxRecording] = useState(false);
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
      setInboxUploadError(null);
      setInboxUploadBusy(true);
      try {
        const normalized = normalizeExecutiveInboxUploadFile(file);
        const form = new FormData();
        form.append("file", normalized);
        const r = await fetch("/api/admin/executive-agent/inbox/upload", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as {
          attachment?: InboxPendingAttachment;
          error?: string;
          message?: string;
        };
        if (r.ok && j.attachment) {
          appendInboxUploaded(j.attachment);
          return;
        }
        setInboxUploadError(executiveInboxUploadErrorMessage(j.error, j.message));
      } finally {
        setInboxUploadBusy(false);
      }
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
      const mime = pickExecutiveInboxMediaRecorderMimeType();
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
        const j = (await r.json().catch(() => ({}))) as {
          attachment?: InboxPendingAttachment;
          error?: string;
          message?: string;
        };
        if (r.ok && j.attachment) {
          appendInboxUploaded(j.attachment);
        } else {
          setInboxUploadError(executiveInboxUploadErrorMessage(j.error, j.message));
        }
      };
      mr.start(250);
      setInboxRecording(true);
    } catch {
      setInboxRecording(false);
      setInboxUploadError("Microphone permission is required to record a voice note.");
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

  const loadExecutivePresence = useCallback(async () => {
    setPresenceLoading(true);
    setPresenceError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/presence/snapshot", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutivePresenceSnapshot & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Executive presence failed");
      setExecutivePresence(j);
    } catch (e) {
      setExecutivePresence(null);
      setPresenceError(e instanceof Error ? e.message : "Executive presence failed");
    } finally {
      setPresenceLoading(false);
    }
  }, []);

  const loadAmbientSignals = useCallback(async () => {
    setAmbientLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/signals/overview?audit=0", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        overview?: ExecutiveAmbientSignalOverview;
        orbState?: AmbientOrbState;
        interruptions?: AmbientExecutiveSignal[];
        error?: string;
      };
      if (r.ok && j.overview) {
        setAmbientOverview(j.overview);
        setAmbientOrbState(j.orbState ?? null);
        setAmbientInterruptions(j.interruptions ?? []);
      } else {
        setAmbientOverview(null);
        setAmbientOrbState(null);
        setAmbientInterruptions([]);
      }
    } catch {
      setAmbientOverview(null);
      setAmbientOrbState(null);
    } finally {
      setAmbientLoading(false);
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
    void loadExecutivePresence();
    void loadAmbientSignals();
    void loadRecentConversations();
    void loadFollowUpRecommendations();
    void loadBriefingToday();
  }, [
    loadSummary,
    loadApprovals,
    loadLiveMetrics,
    loadExecutivePresence,
    loadAmbientSignals,
    loadRecentConversations,
    loadFollowUpRecommendations,
    loadBriefingToday,
  ]);

  useEffect(() => {
    const id = window.setInterval(() => void loadAmbientSignals(), 45_000);
    return () => window.clearInterval(id);
  }, [loadAmbientSignals]);

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
        const bentleyLocal = tryExecutiveBentleyVoiceBridge(transcriptText);
        if (bentleyLocal.handled) {
          setActiveCommandPromptId("bentley_campaign");
          setBentleyCampaignModeActive(true);
          const answer = bentleyLocal.answer;
          if (bentleyLocal.hudSummary) setHudSummary(bentleyLocal.hudSummary);
          setTranscript(
            (prev) => `${prev}\nExecutive: ${answer.slice(0, 800)}${answer.length > 800 ? "…" : ""}`,
          );
          mergeVoiceDiag({
            orchestratorMs: Math.round(performance.now() - orchStarted),
            lastResponse: answer,
            voiceShortCircuit: "operational_query",
          });
          const speak = await speakExecutiveAnswer(answer, voiceSession?.clientConfig?.locale);
          mergeVoiceDiag({
            voiceProvider: speak.path,
            ttsMs: speak.ms,
            ...(speak.error ? { lastError: speak.error } : {}),
          });
          setActivityFeed((prev) => [`Voice — Bentley campaign intake`, ...prev].slice(0, 24));
          setBusy(null);
          return;
        }

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
          plannerMeta?: ChatResult["plannerMeta"] & Record<string, unknown>;
        };
        if (!r.ok) throw new Error(j.error ?? "Voice turn failed");
        const answer = typeof j.answer === "string" ? j.answer : "";
        const promptFromVoice = resolveExecutiveCommandPromptFromVoice(transcriptText);
        const opKind = resolveVoiceOperationalQuery(transcriptText);
        const promptFromOp = opKind ? executiveCommandPromptForOperationalKind(opKind) : null;
        const nextPrompt = promptFromVoice ?? promptFromOp;
        if (nextPrompt) setActiveCommandPromptId(nextPrompt);
        if (answer.trim()) setHudSummary(answer.trim());
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
        const opIntent = j.pendingVoiceIntent?.intent;
        if (
          opIntent === "inbox_audio_confirm" ||
          opIntent === "registration_phone_offer" ||
          opIntent === "registration_phone_queue"
        ) {
          setVoicePendingOperational(j.pendingVoiceIntent ?? null);
        } else {
          setVoicePendingOperational(null);
        }
        const uiAction = j.plannerMeta?.voiceUiAction;
        if (uiAction?.type === "play_inbox_audio" && uiAction.url) {
          setVoicePendingInboxAudio({
            messageId: uiAction.messageId,
            attachmentId: uiAction.attachmentId,
            url: uiAction.url,
            filename: uiAction.filename,
            mimeType: uiAction.mimeType,
          });
        }
        if (j.plannerMeta?.voiceOperationalData?.phoneQueueRevealed) {
          setVoicePhoneQueueRevealed(true);
        }
        setVoiceOpsRefreshSeq((n) => n + 1);
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

  const orbIntensity = voice.listening
    ? Math.min(1, voice.rms * 2.2)
    : Math.max(idlePulse, 0.04 + (ambientOrbState?.blendedIntensity ?? 0) * 0.38);
  const orbMode: ExecutiveOrbMode = useMemo(() => {
    if (voice.error) return "alert";
    if (voiceApprovalFlash) return "approval_waiting";
    if (busy === "chat" || busy === "voice_turn") return "processing";
    if (simSpeaking) return "speaking";
    if (voiceSttBusy || (voiceMode && voice.listening && voice.speaking)) return "speaking";
    if (voiceMode && voice.listening) return "listening";
    const operational = executivePresence?.orbState ?? "idle";
    return operational as ExecutiveOrbMode;
  }, [
    voice.error,
    voice.listening,
    voice.speaking,
    busy,
    simSpeaking,
    voiceApprovalFlash,
    voiceSttBusy,
    voiceMode,
    executivePresence?.orbState,
  ]);

  const orbStandbyLabel = useMemo(() => {
    if (busy === "voice_turn") return "Processing";
    if (voiceApprovalFlash) return "Approvals";
    if (voiceSttBusy) return "Dictating";
    if (simSpeaking) return "Speaking";
    if (voiceMode && voice.listening) return "Live mic";
    if (executivePresence?.orbState) return operationalOrbBadgeLabel(executivePresence.orbState);
    return "Standby";
  }, [busy, voiceApprovalFlash, voiceSttBusy, simSpeaking, voiceMode, voice.listening, executivePresence?.orbState]);

  const cinematic = useExecutiveCinematicPresence({
    presenceMode: ambientOverview?.presenceMode,
    ambientOverview,
    ambientOrbState,
    interruptions: ambientInterruptions,
    baseOrbIntensity: orbIntensity,
    orbMode,
    voiceRms: voice.rms,
    voiceSpeaking: voice.speaking,
    voiceListening: voiceMode && voice.listening,
    simSpeaking,
    voiceApprovalFlash,
    processing: busy === "chat" || busy === "voice_turn",
    activePromptId: activeCommandPromptId,
  });

  const [cinematicAudioEnabled, setCinematicAudioEnabled] = useState(false);
  useEffect(() => {
    setCinematicAudioEnabled(isExecutiveAudioPresenceEnabled());
  }, []);

  const prevPromptRef = useRef<ExecutiveCommandPromptId | null>(null);
  useEffect(() => {
    if (activeCommandPromptId && activeCommandPromptId !== prevPromptRef.current) {
      getExecutiveAudioPresence().play("command_accepted");
      prevPromptRef.current = activeCommandPromptId;
    }
    if (!activeCommandPromptId) prevPromptRef.current = null;
  }, [activeCommandPromptId]);

  useEffect(() => {
    const top = ambientInterruptions[0]?.severity;
    if (top === "critical" || top === "high") {
      getExecutiveAudioPresence().play(top === "critical" ? "operational_alert" : "interruption");
    }
  }, [ambientInterruptions[0]?.id, ambientInterruptions[0]?.severity]);

  const applySubject = useCallback((subject: ExecutiveSubjectConfig) => {
    setActiveSubjectId(subject.id);
    const tabLabel = (BOTTOM_TABS as readonly string[]).includes(subject.navLabel)
      ? (subject.navLabel as (typeof BOTTOM_TABS)[number])
      : "Command Center";
    setBottomTab(tabLabel);
    setDashboardMode(subject.dashboardMode);
    setCustomAgents(new Set(subject.delegateAgents));
    if (subject.id === "inbox") {
      void loadExecutiveInboxAdmin();
    } else if (subject.id === "analytics") {
      setDataPreset("ALL");
      setActiveCommandPromptId("analytics");
      setAnalyticsFocusSeq((n) => n + 1);
    } else if (subject.id === "revenue_os") {
      setDataPreset("ALL");
      setActiveCommandPromptId("bentley_campaign");
      setBentleyCampaignModeActive(true);
    } else if (subject.id === "ai_agents") setDataPreset("ALL");
    else if (subject.id === "crm_intelligence" || subject.id === "trust_jarva") setDataPreset("EXECUTIVE_ADMIN");
    else if (subject.id === "troo_town") setDataPreset("ALL");
    else if (subject.id === "command_center" || subject.id === "new_command") setDataPreset("ALL");
  }, [loadExecutiveInboxAdmin]);

  const mapTabToMode = (tab: (typeof BOTTOM_TABS)[number]) => {
    applySubject(getExecutiveSubject(subjectIdFromBottomTab(tab)));
  };

  const topPages = liveMetrics?.topPages?.items ?? [];
  const landingCtas = liveMetrics?.landingCtaPerformance?.items ?? [];
  const landingCtasUnavailable = Boolean(liveMetrics?.landingCtaPerformance?.unavailable);
  const approvedActivity = liveMetrics?.approvedUserActivity;
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

  const operationsSidebarProps = useMemo(
    () => ({
      approvals,
      onApprove: (row: (typeof approvals)[number]) => void approve(row),
      onReject: (id: string) => void reject(id),
      lastApprovalExec,
      clientIdTrim,
      onLoadApprovals: () => void loadApprovals(),
      recentConversations,
      recentConversationsError,
      followUpRecommendations,
      followUpError,
      followUpQueueBusyId,
      onQueueFollowUp: (rec: FollowUpRecommendationRow) => void queueFollowUpRecommendation(rec),
      bentleyBrief,
      bentleyClientSlice,
      liveMetricsSystemHealth: liveMetrics?.systemHealth,
      voicePreflight,
      voiceDiagnostics,
      voiceSttInputMode,
      voiceSessionId: voiceSession?.sessionId ?? null,
      voicePendingAnalytics,
      onTestSttHealth: () => void refreshExecutiveVoiceSttDiagnostics(),
      onTestSelfHostedStt: () => void runSelfHostedSttTestClip(),
      sttTestBusy,
      sttTestTranscript,
      learningPendingPreview,
      summaryError,
      chatCharts: chatResult?.charts ?? null,
    }),
    [
      approvals,
      approve,
      reject,
      lastApprovalExec,
      clientIdTrim,
      loadApprovals,
      recentConversations,
      recentConversationsError,
      followUpRecommendations,
      followUpError,
      followUpQueueBusyId,
      queueFollowUpRecommendation,
      bentleyBrief,
      bentleyClientSlice,
      liveMetrics?.systemHealth,
      voicePreflight,
      voiceDiagnostics,
      voiceSttInputMode,
      voiceSession?.sessionId,
      voicePendingAnalytics,
      refreshExecutiveVoiceSttDiagnostics,
      runSelfHostedSttTestClip,
      sttTestBusy,
      sttTestTranscript,
      learningPendingPreview,
      summaryError,
      chatResult?.charts,
    ],
  );

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
    <ExecutiveBentleyCampaignProvider
      adminUserId=""
      clientId={clientIdTrim}
      pendingApprovals={approvals.filter((a) => a.status === "pending").length}
      content360Configured={summary?.bentleyBridge?.platform?.content360PlatformConfigured}
      campaignModeActive={bentleyCampaignModeActive}
      setCampaignModeActive={setBentleyCampaignModeActive}
    >
    <div className="relative min-h-screen overflow-x-hidden bg-[#00050A] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,163,255,0.07),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(0,183,255,0.05),transparent_48%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,163,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,163,255,0.035)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />

      <div className="relative z-10 mx-auto max-w-[1920px] px-3 pb-36 pt-3 sm:px-5">
        <header className="mb-3 space-y-3 border-b border-[#00A3FF]/18 pb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-[0.26em] text-white sm:text-xl">
                {activeSubjectId === "site_builder"
                  ? "Stephon"
                  : activeSubjectId === "troo_town"
                    ? "Evaana Desk"
                    : "Executive Administration"}
              </h1>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[#00b7ff]/65">
                {activeSubjectId === "site_builder"
                  ? "Site Builder intelligence — Stephon operator conversations feed usability feedback for the engine (read-only, no autonomous product changes)."
                  : activeSubjectId === "troo_town"
                    ? "TROO TOWN desk — Evaana visitor conversations and Skipper-governed follow-ups only."
                    : "Permissioned orchestration: reads run under policy; writes queue for approval and audit. Filters shape tool routing — they do not bypass controls."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[#00A3FF]/22 bg-[#000814]/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 shadow-[inset_0_0_22px_rgba(0,163,255,0.04)]">
            <div className="flex min-w-[8rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Data source</span>
              <select
                value={dataPreset}
                onChange={(e) => {
                  const v = e.target.value as DataPreset;
                  setDataPreset(v);
                  if (v !== "CUSTOM") setCustomAgents(new Set(EXECUTIVE_AGENT_KEYS));
                }}
                className="max-w-[11rem] rounded border border-[#00A3FF]/25 bg-[#00050A] px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal text-[#00A3FF] outline-none focus:border-[#00A3FF]/55"
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
            <div className="hidden h-8 w-px bg-[#00A3FF]/15 sm:block" aria-hidden />
            <div className="flex min-w-[5rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Mode</span>
              <select
                value={dashboardMode}
                onChange={(e) => setDashboardMode(e.target.value as ExecutiveDashboardMode)}
                className="max-w-[10rem] rounded border border-[#00A3FF]/25 bg-[#00050A] px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal text-[#00A3FF] outline-none focus:border-[#00A3FF]/55"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden h-8 w-px bg-[#00A3FF]/15 sm:block" aria-hidden />
            <div className="flex min-w-[5rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Time</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as (typeof TIME_OPTIONS)[number])}
                className="rounded border border-[#00A3FF]/25 bg-[#00050A] px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal text-[#00A3FF] outline-none focus:border-[#00A3FF]/55"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden h-8 w-px bg-[#00A3FF]/15 md:block" aria-hidden />
            <div className="flex min-w-[7rem] flex-col gap-0.5">
              <span className="text-[#00b7ff]/55">Voice input</span>
              <span className="text-[9px] font-semibold normal-case tracking-normal text-slate-200">
                {voiceSttInputMode.replace(/_/g, " ")}
              </span>
            </div>
            <div className="hidden h-8 w-px bg-[#00A3FF]/15 lg:block" aria-hidden />
            <div className="flex min-w-[6rem] flex-1 flex-col gap-0.5 lg:items-end">
              <span className="text-[#00b7ff]/55">Clock</span>
              <span className="text-[9px] font-semibold tabular-nums normal-case tracking-normal text-[#00A3FF]/90">
                {hudClock.toLocaleTimeString()}
              </span>
            </div>
            <div className="hidden h-8 w-px bg-[#00A3FF]/15 lg:block" aria-hidden />
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
            <div className="hidden h-8 w-px bg-[#00A3FF]/15 xl:block" aria-hidden />
            <div className="hidden min-w-[10rem] flex-col gap-0.5 xl:flex">
              <span className="text-[#00b7ff]/55">Workspace client</span>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client UUID"
                className="w-full rounded border border-[#00A3FF]/25 bg-[#00050A] px-1.5 py-1 text-[9px] font-mono normal-case tracking-normal text-[#00A3FF] outline-none"
              />
            </div>
            <div className="hidden min-w-[10rem] flex-col gap-0.5 xl:flex">
              <span className="text-[#00b7ff]/55">Fulfillment order</span>
              <input
                value={workspaceOrderId}
                onChange={(e) => setWorkspaceOrderId(e.target.value)}
                placeholder="Order UUID"
                className="w-full rounded border border-[#00A3FF]/25 bg-[#00050A] px-1.5 py-1 text-[9px] font-mono normal-case tracking-normal text-[#00A3FF] outline-none"
              />
            </div>
          </div>
        </header>

        {activeSubjectId === "inbox" ? (
          <section className="mb-4 rounded-2xl border border-[#00A3FF]/28 bg-slate-950/70 p-4 shadow-[0_0_28px_rgba(0,163,255,0.08)] backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00A3FF]/90">
                  Admin Executive inbox
                </h2>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Broadcast to approved accounts or send a direct message · members reply from their dashboard inbox
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadExecutiveInboxAdmin()}
                className="rounded-full border border-[#00A3FF]/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#00A3FF] hover:bg-[#000814]/40"
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
              placeholder="Message body (optional if you attach files, a website project ZIP, or a voice note)…"
              value={inboxBody}
              onChange={(e) => setInboxBody(e.target.value)}
            />
            <input
              id="skipper-inbox-file"
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,audio/*"
              disabled={inboxUploadBusy || inboxPendingAttachments.length >= 5}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadInboxFileFromInput(f);
                e.target.value = "";
              }}
            />
            <input
              id="skipper-inbox-zip"
              type="file"
              className="sr-only"
              accept=".zip,application/zip,application/x-zip-compressed"
              disabled={inboxUploadBusy || inboxPendingAttachments.length >= 5}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadInboxFileFromInput(f);
                e.target.value = "";
              }}
            />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor="skipper-inbox-zip"
                className={`cursor-pointer rounded-lg border border-cyan-500/45 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-900/50 ${
                  inboxUploadBusy || inboxPendingAttachments.length >= 5 ? "pointer-events-none opacity-40" : ""
                }`}
              >
                {inboxUploadBusy ? "Uploading…" : "Upload website project (.zip)"}
              </label>
              <label
                htmlFor="skipper-inbox-file"
                className={`cursor-pointer rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 ${
                  inboxUploadBusy || inboxPendingAttachments.length >= 5 ? "pointer-events-none opacity-40" : ""
                }`}
              >
                {inboxUploadBusy ? "Uploading…" : "Attach file"}
              </label>
              <button
                type="button"
                onClick={() => (inboxRecording ? stopInboxVoiceRecording() : void startInboxVoiceRecording())}
                disabled={inboxUploadBusy || inboxPendingAttachments.length >= 5}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  inboxRecording
                    ? "border-rose-500/60 bg-rose-950/50 text-rose-200"
                    : "border-slate-600 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                } disabled:opacity-40`}
              >
                {inboxRecording ? "Stop recording" : "Record voice"}
              </button>
              <span className="text-[10px] text-slate-500">
                Up to 5 attachments · 12 MB files · 50 MB website ZIP · Vercel/Next.js exports
              </span>
            </div>
            {inboxUploadError ? <p className="mb-2 text-xs text-amber-300">{inboxUploadError}</p> : null}
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
              className="rounded-lg bg-[#00A3FF] px-4 py-2 text-sm font-semibold text-slate-950"
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
        ) : null}

        {bottomTab === "Settings" ? (
          <section className="mb-4 rounded-2xl border border-[#00A3FF]/20 bg-slate-950/70 p-4 backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00A3FF]/90">
                Settings — Scheduled routines
              </h2>
              <button
                type="button"
                disabled={executiveRoutinesBusy}
                onClick={() => void loadExecutiveRoutines()}
                className="rounded-full border border-[#00A3FF]/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#00A3FF] hover:bg-[#000814]/40 disabled:opacity-40"
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
                        <span className="font-mono text-[11px] text-[#00A3FF]">{rt.routineType}</span>
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
            <div className="mt-8 border-t border-[#00A3FF]/15 pt-4">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00A3FF]/90">Knowledge base</h2>
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
                  className="rounded-lg bg-[#00A3FF] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
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
                  <li key={d.id} className="flex items-start justify-between gap-2 rounded border border-slate-800/80 bg-[#000814]/75 px-2 py-1">
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
            <div className="mt-8 border-t border-[#00A3FF]/15 pt-4">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00A3FF]/90">Question history</h2>
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

        <div
          className="mx-auto max-w-7xl space-y-3"
          style={cinematic.commandFocusCssVars as CSSProperties}
        >
          <div
            className="space-y-4 transition-opacity duration-500"
            style={{ opacity: cinematic.commandFocus.active ? "var(--cmd-focus-rail-opacity, 0.72)" : 1 }}
          >
            <OperationalPresenceStatusBar
              overview={ambientOverview}
              orbState={ambientOrbState}
              loading={ambientLoading}
            />

            <ExecutiveInterruptionPanel
              interruptions={ambientInterruptions}
              loading={ambientLoading}
              dismissedIds={dismissedInterruptions}
              onDismiss={(id) => setDismissedInterruptions((prev) => new Set([...prev, id]))}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <ExecutiveCommandPromptSelector
                value={activeCommandPromptId}
                onChange={(id) => {
                  setActiveCommandPromptId(id);
                  setHudSummary(null);
                }}
              />
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                <input
                  type="checkbox"
                  checked={cinematicAudioEnabled}
                  onChange={(e) => {
                    setCinematicAudioEnabled(e.target.checked);
                    setExecutiveAudioPresenceEnabled(e.target.checked);
                  }}
                />
                Cinematic audio
              </label>
            </div>
          </div>

          {cinematic.topInterruptionLevel === "crisis_overlay" ? (
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.08),transparent_65%)]"
            />
          ) : null}

          <ExecutiveSkipperCommandStage
            activePromptId={activeCommandPromptId}
            hudSummary={hudSummary ?? chatResult?.answer ?? null}
            orbIntensity={orbIntensity}
            orbMode={orbMode}
            activeAgentCount={selectedAgents.length}
            dashboardModeLabel={dashboardMode.replace(/_/g, " ")}
            operationalState={executivePresence?.orbState}
            orbStandbyLabel={orbStandbyLabel}
            ambientPulse={ambientOrbState?.pulseActive}
            cinematic={cinematic}
            voicePendingAnalytics={Boolean(voicePendingAnalytics)}
            voicePendingOperational={voicePendingOperational}
            selfHostedFallbackBanner={
              executiveOutputVoice?.voiceProvider === "self_hosted_tts" &&
              selfHostedHealth &&
              !executiveSelfHostedVoiceReady(selfHostedHealth) ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-2 pt-2">
                  <p className="max-w-md rounded-lg border border-amber-400/45 bg-amber-950/85 px-3 py-2 text-center text-[11px] text-amber-50/95">
                    Self-hosted voice engine unavailable. Falling back to browser voice.
                  </p>
                </div>
              ) : null
            }
            voiceSttBusy={voiceSttBusy}
            voiceListening={Boolean(voiceMode && voice.listening)}
            voiceBusy={busy !== null || voiceSttBusy}
            onMicClick={() => runMicNearInput()}
            hudContent={
              activeCommandPromptId ? (
                <ExecutiveCommandHudContent
                  activePromptId={activeCommandPromptId}
                  liveMetrics={liveMetrics}
                  liveMetricsError={liveMetricsError}
                  summary={summary}
                  trafficRows={trafficRows}
                  trafficUnavailable={trafficUnavailable}
                  landingCtas={landingCtas}
                  landingCtasUnavailable={landingCtasUnavailable}
                  approvedActivity={approvedActivity}
                  topPages={topPages}
                  ta={ta}
                  busyLive={busy === "live"}
                  dailyBriefing={dailyBriefing}
                  briefingBusy={briefingBusy}
                  dailyBriefingError={dailyBriefingError}
                  onLoadBriefingToday={() => void loadBriefingToday()}
                  onGenerateBriefing={() => void generateBriefing()}
                  briefingBusyFlag={briefingBusy || busy !== null}
                  executivePresence={executivePresence}
                  presenceLoading={presenceLoading}
                  presenceError={presenceError}
                  voiceOpsRefreshSeq={voiceOpsRefreshSeq}
                  voicePhoneQueueRevealed={voicePhoneQueueRevealed}
                  voicePendingInboxAudio={voicePendingInboxAudio}
                  onPlayInboxAudio={(action) => {
                    if (execAudioRef.current) {
                      execAudioRef.current.pause();
                      execAudioRef.current = null;
                    }
                    const audio = new Audio(action.url);
                    execAudioRef.current = audio;
                    void audio.play().catch(() => undefined);
                  }}
                  displayAgents={displayAgents}
                  agentIntelError={agentIntelError}
                  activityFeed={activityFeed}
                  activeSubjectId={activeSubjectId}
                  activeSubject={activeSubject}
                  clientId={clientId}
                  campaignId={campaignId}
                  workspaceOrderId={workspaceOrderId}
                  selectedOpsThreadId={selectedOpsThreadId}
                  setSelectedOpsThreadId={setSelectedOpsThreadId}
                  threadSidebarKey={threadSidebarKey}
                  onOperationalCoordinationChange={onOperationalCoordinationChange}
                  setSubjectSkipperContext={setSubjectSkipperContext}
                  setThreadSkipperContext={setThreadSkipperContext}
                  dryRun={dryRun}
                  timeRange={timeRange}
                  busy={busy !== null}
                  combinedSkipperWorkspaceContext={combinedSkipperWorkspaceContext}
                  operationsProps={operationsSidebarProps}
                  bentleyCampaignHudProps={{
                    pendingApprovals: approvals.filter((a) => a.status === "pending").length,
                    content360Configured: summary?.bentleyBridge?.platform?.content360PlatformConfigured,
                  }}
                  AGENT_DOMAIN_LABEL={AGENT_DOMAIN_LABEL}
                />
              ) : null
            }
          />

          <ExecutiveCollapsibleTile title="Voice & orchestration" subtitle="Session controls and Skipper dialogue" defaultCollapsed>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[10px]">
                <button type="button" disabled={busy !== null} onClick={() => void startVoiceCommandSession()} className="rounded-full border border-[#00A3FF]/40 px-2 py-1 uppercase text-[#00A3FF]">
                  Start session
                </button>
                <button type="button" disabled={busy !== null || !voiceSession?.sessionId} onClick={() => void endVoiceCommandSession()} className="rounded-full border border-slate-600 px-2 py-1 uppercase text-slate-300">
                  End session
                </button>
                <button type="button" disabled={busy !== null} onClick={() => void loadSummary()} className="rounded-full border border-slate-600 px-2 py-1 uppercase text-slate-300">
                  Refresh summary
                </button>
                <button type="button" disabled={busy !== null} onClick={() => void loadLiveMetrics()} className="rounded-full border border-slate-600 px-2 py-1 uppercase text-slate-300">
                  Live metrics
                </button>
              </div>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#00A3FF]/50"
                placeholder="Ask about accounts, campaigns, Site Builder, or CRM…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy !== null} onClick={() => void sendChat()} className="rounded-xl bg-[#00A3FF] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">
                  {busy === "chat" ? "Running…" : "Run orchestration"}
                </button>
                <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                  Dry run
                </label>
              </div>
              {chatError ? <p className="text-xs text-amber-200">{chatError}</p> : null}
              {chatResult?.answer && !hudSummary ? <p className="text-sm text-slate-200">{chatResult.answer}</p> : null}
            </div>
          </ExecutiveCollapsibleTile>
        </div>
      </div>

      <ExecutiveSubjectNavBar activeSubjectId={activeSubjectId} onSelectSubject={applySubject} />
    </div>
    </ExecutiveBentleyCampaignProvider>
  );
}
