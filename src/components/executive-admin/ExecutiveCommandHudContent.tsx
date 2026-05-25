"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";
import type { LiveMetricsResponse } from "@/lib/executive-agent/executive-live-metrics";
import type { ExecutivePresenceSnapshot } from "@/lib/executive-agent/executive-presence-types";
import type { ExecutiveSubjectConfig, ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type { AgentIntelligenceRecord, ExecutiveAgentKey } from "@/lib/executive-agent/agent-intelligence-bus";
import { ExecutiveVoiceOperationsPanel } from "./ExecutiveVoiceOperationsPanel";
import { ExecutiveRevenueValueTile } from "./ExecutiveRevenueValueTile";
import { ExecutiveLiveSiteOverviewTile } from "./ExecutiveLiveSiteOverviewTile";
import { ExecutivePresenceSidebarTiles } from "./ExecutivePresencePanel";
import { ExecutiveCommandCenterPanel } from "./ExecutiveCommandCenterPanel";
import { ExecutiveSubjectWorkspacePanel } from "./ExecutiveSubjectWorkspacePanel";
import { ExecutiveDecisionQueuePanel } from "./ExecutiveDecisionQueuePanel";
import { ExecutiveTaskQueuePanel } from "./ExecutiveTaskQueuePanel";
import { FulfillmentThreadView } from "./FulfillmentThreadView";
import { SubjectThreadSidebar } from "./SubjectThreadSidebar";
import { ExecutiveThreadPanel } from "./ExecutiveThreadPanel";
import { ExecutiveSubjectAgentChatPanel } from "./ExecutiveSubjectAgentChatPanel";
import { TrooTownEvanaPanel } from "./TrooTownEvanaPanel";
import { StephonSiteBuilderPanel } from "./StephonSiteBuilderPanel";
import { ExecutiveNeuroPanel } from "./neuro/ExecutiveNeuroPanel";
import {
  ExecutiveOperationsHudModule,
  type ExecutiveOperationsSidebarProps,
} from "./ExecutiveOperationsSidebar";

type DailyBriefingView = {
  headline?: string;
  priorities?: Array<{ title: string; detail: string }>;
  risks?: Array<{ title: string; detail: string }>;
  opportunities?: Array<{ title: string; detail: string }>;
  approvalsNeeded?: Array<{ id: string; proposedAction: string; title: string }>;
  suggestedFirstActions?: Array<{ title: string; detail: string }>;
};

export type ExecutiveCommandHudContentProps = {
  activePromptId: ExecutiveCommandPromptId;
  liveMetrics: LiveMetricsResponse | null;
  liveMetricsError: string | null;
  summary: {
    pendingAccounts?: { pendingAllTime?: number };
    approvedAccounts?: { approvedActive?: number };
    platform?: { socialCampaigns?: number; crmClients?: number; marketplaceUsers?: number };
    inbox?: { threadsLast7d?: number };
  } | null;
  trafficRows: Array<{ name: string; visitors: number }>;
  trafficUnavailable: boolean;
  landingCtas: LiveMetricsResponse["landingCtaPerformance"]["items"];
  landingCtasUnavailable: boolean;
  approvedActivity: LiveMetricsResponse["approvedUserActivity"];
  topPages: LiveMetricsResponse["topPages"]["items"];
  ta: LiveMetricsResponse["trafficAttribution"] | undefined;
  busyLive: boolean;
  dailyBriefing: DailyBriefingView | null;
  briefingBusy: boolean;
  dailyBriefingError: string | null;
  onLoadBriefingToday: () => void;
  onGenerateBriefing: () => void;
  briefingBusyFlag: boolean;
  executivePresence: ExecutivePresenceSnapshot | null;
  presenceLoading: boolean;
  presenceError: string | null;
  voiceOpsRefreshSeq: number;
  voicePhoneQueueRevealed: boolean;
  voicePendingInboxAudio: {
    messageId: string;
    attachmentId: string;
    url: string;
    filename: string;
    mimeType: string;
  } | null;
  onPlayInboxAudio: (action: { url: string }) => void;
  displayAgents: AgentIntelligenceRecord[];
  agentIntelError: string | null;
  activityFeed: string[];
  activeSubjectId: ExecutiveSubjectId;
  activeSubject: ExecutiveSubjectConfig;
  clientId: string;
  campaignId: string;
  workspaceOrderId: string;
  selectedOpsThreadId: string | null;
  setSelectedOpsThreadId: (id: string | null) => void;
  threadSidebarKey: number;
  onOperationalCoordinationChange: () => void;
  setSubjectSkipperContext: (ctx: string | null) => void;
  setThreadSkipperContext: (ctx: string | null) => void;
  dryRun: boolean;
  timeRange: string;
  busy: boolean;
  combinedSkipperWorkspaceContext: string | null;
  operationsProps: ExecutiveOperationsSidebarProps;
  AGENT_DOMAIN_LABEL: Record<ExecutiveAgentKey, string>;
};

function HudMetricTile({
  label,
  value,
  unavailable,
}: {
  label: string;
  value?: number | null;
  unavailable?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#00A3FF]/15 bg-[#00050A]/80 p-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#00b7ff]/60">{label}</div>
      <div className="mt-1 font-mono text-lg text-white">{value ?? "—"}</div>
      {unavailable && value == null ? <div className="text-[9px] text-slate-600">Unavailable</div> : null}
    </div>
  );
}

const OPS_PROMPTS: ExecutiveCommandPromptId[] = [
  "pending_approvals",
  "operations_briefing",
  "kpi_forecasting",
  "operators_delegation",
  "simulation_intelligence",
  "planning",
  "incidents_governance",
  "automation",
  "multi_agent_workflows",
  "operational_memory",
  "website_fulfillment",
  "trust_fulfillment",
  "revenue_os_smart_trust",
  "conversations_signals",
  "system_voice",
];

export function ExecutiveCommandHudContent(props: ExecutiveCommandHudContentProps) {
  const { activePromptId } = props;

  if (OPS_PROMPTS.includes(activePromptId)) {
    return <ExecutiveOperationsHudModule moduleId={activePromptId} {...props.operationsProps} />;
  }

  switch (activePromptId) {
    case "revenue_overview":
      return (
        <div className="grid grid-cols-1 gap-3">
          <ExecutiveRevenueValueTile
            pendingAccounts={props.liveMetrics?.pendingAccounts.value ?? props.summary?.pendingAccounts?.pendingAllTime}
            approvedAccounts={props.liveMetrics?.approvedAccounts.value ?? props.summary?.approvedAccounts?.approvedActive}
            loading={props.busyLive && !props.liveMetrics && !props.summary}
          />
          <ExecutiveLiveSiteOverviewTile metrics={props.liveMetrics} loading={props.busyLive && !props.liveMetrics} error={props.liveMetricsError} />
        </div>
      );
    case "analytics":
      return (
        <div className="space-y-3">
          <ExecutiveLiveSiteOverviewTile metrics={props.liveMetrics} loading={props.busyLive && !props.liveMetrics} error={props.liveMetricsError} />
          <div className="grid grid-cols-2 gap-2">
            <HudMetricTile label="Pending" value={props.liveMetrics?.pendingAccounts.value ?? props.summary?.pendingAccounts?.pendingAllTime} unavailable={props.liveMetrics?.pendingAccounts.unavailable} />
            <HudMetricTile label="Approved" value={props.liveMetrics?.approvedAccounts.value ?? props.summary?.approvedAccounts?.approvedActive} unavailable={props.liveMetrics?.approvedAccounts.unavailable} />
          </div>
          {!props.trafficUnavailable ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={props.trafficRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} width={32} />
                  <Tooltip contentStyle={{ background: "#000814", border: "1px solid rgba(0,163,255,0.3)", fontSize: 11 }} />
                  <Bar dataKey="visitors" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Traffic breakdown unavailable for this window.</p>
          )}
        </div>
      );
    case "agent_activity":
    case "inbox_signals":
    case "new_registrations":
      return (
        <ExecutiveVoiceOperationsPanel
          refreshSignal={props.voiceOpsRefreshSeq}
          phoneQueueRevealed={props.voicePhoneQueueRevealed}
          pendingInboxAudio={props.voicePendingInboxAudio}
          onPlayInboxAudio={props.onPlayInboxAudio}
        />
      );
    case "executive_briefing":
      return (
        <div className="space-y-3 text-xs text-slate-200">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={props.briefingBusyFlag} onClick={props.onLoadBriefingToday} className="rounded-full border border-amber-400/35 px-2 py-0.5 text-[9px] uppercase text-amber-100">
              Refresh
            </button>
            <button type="button" disabled={props.briefingBusyFlag} onClick={props.onGenerateBriefing} className="rounded-full border border-amber-300/50 px-2 py-0.5 text-[9px] uppercase text-amber-50">
              Generate
            </button>
          </div>
          {props.dailyBriefingError ? <p className="text-amber-200/90">{props.dailyBriefingError}</p> : null}
          {props.dailyBriefing ? (
            <>
              <p className="font-medium text-amber-50/95">{props.dailyBriefing.headline}</p>
              <ul className="space-y-1 text-[11px] text-slate-400">
                {(props.dailyBriefing.priorities ?? []).slice(0, 4).map((p, i) => (
                  <li key={i}>
                    <span className="text-slate-200">{p.title}</span> — {p.detail}
                  </li>
                ))}
              </ul>
            </>
          ) : props.briefingBusy ? (
            <p className="text-slate-500">Loading briefing…</p>
          ) : (
            <p className="text-slate-500">No cached briefing for today.</p>
          )}
        </div>
      );
    case "executive_posture":
      return (
        <ExecutivePresenceSidebarTiles
          presence={props.executivePresence}
          loading={props.presenceLoading}
          error={props.presenceError}
        />
      );
    case "agent_network":
      return (
        <ul className="space-y-2 text-xs">
          {props.displayAgents.map((a) => (
            <li key={a.agentKey} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-200">{a.displayName}</span>
                <span className={`h-2 w-2 rounded-full ${a.status === "online" ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
              <div className="mt-1 text-[10px] text-slate-500">{props.AGENT_DOMAIN_LABEL[a.agentKey]}</div>
            </li>
          ))}
          {props.agentIntelError ? <p className="text-amber-200/90">{props.agentIntelError}</p> : null}
        </ul>
      );
    case "subject_workspace":
      return (
        <ExecutiveSubjectWorkspacePanel
          embedded
          subjectId={props.activeSubjectId}
          clientId={props.clientId}
          orderId={props.workspaceOrderId}
          onSkipperContext={props.setSubjectSkipperContext}
        />
      );
    case "decision_queue":
      return (
        <ExecutiveDecisionQueuePanel
          embedded
          subjectId={props.activeSubjectId}
          clientId={props.clientId}
          orderId={props.workspaceOrderId}
          threadId={props.selectedOpsThreadId}
          onSelectThread={props.setSelectedOpsThreadId}
          onDecisionRecorded={props.onOperationalCoordinationChange}
        />
      );
    case "task_queue":
      return (
        <ExecutiveTaskQueuePanel
          embedded
          subjectId={props.activeSubjectId}
          clientId={props.clientId}
          orderId={props.workspaceOrderId}
          threadId={props.selectedOpsThreadId}
          onTasksChanged={props.onOperationalCoordinationChange}
        />
      );
    case "gps":
      return props.workspaceOrderId.trim() ? (
        <FulfillmentThreadView
          embedded
          orderId={props.workspaceOrderId.trim()}
          clientId={props.clientId.trim() || undefined}
          department="WEBSITE"
          subjectId={props.activeSubjectId}
        />
      ) : (
        <p className="text-xs text-slate-500">Set a fulfillment order UUID to open GPS case scope.</p>
      );
    case "threads":
      return (
        <SubjectThreadSidebar
          embedded
          key={props.threadSidebarKey}
          subjectId={props.activeSubjectId}
          clientId={props.clientId}
          orderId={props.workspaceOrderId}
          selectedThreadId={props.selectedOpsThreadId}
          onSelectThread={props.setSelectedOpsThreadId}
        />
      );
    case "operational_thread":
      return (
        <ExecutiveThreadPanel
          embedded
          threadId={props.selectedOpsThreadId}
          onSkipperContext={props.setThreadSkipperContext}
          onDecisionRecorded={props.onOperationalCoordinationChange}
        />
      );
    case "command_center":
      return <ExecutiveCommandCenterPanel embedded />;
    case "command_agent_chat":
      return (
        <ExecutiveSubjectAgentChatPanel
          subject={props.activeSubject}
          clientId={props.clientId}
          campaignId={props.campaignId}
          dryRun={props.dryRun}
          timeRange={props.timeRange}
          busy={props.busy}
          skipperWorkspaceContext={props.combinedSkipperWorkspaceContext}
          onClose={() => {}}
        />
      );
    default:
      if (props.activeSubjectId === "troo_town") return <TrooTownEvanaPanel embedded />;
      if (props.activeSubjectId === "site_builder") return <StephonSiteBuilderPanel embedded />;
      if (props.activeSubjectId === "neuro") return <ExecutiveNeuroPanel embedded />;
      return <p className="text-xs text-slate-500">Module ready — select a related subject if content is empty.</p>;
  }
}
