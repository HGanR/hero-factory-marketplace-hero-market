"use client";

import { motion } from "framer-motion";
import type { ExecutiveVoiceDiagnostics } from "./VoiceCommandDiagnosticsPanel";
import { ExecutiveOperationsBriefingPanel } from "./ExecutiveOperationsBriefingPanel";
import { ExecutiveKpiOverviewPanel } from "./ExecutiveKpiOverviewPanel";
import { OperationalHealthPanel } from "./OperationalHealthPanel";
import { FulfillmentForecastPanel } from "./FulfillmentForecastPanel";
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
import { IncidentIntelligencePanel } from "./IncidentIntelligencePanel";
import { ExecutiveOperationalFeedPanel } from "./ExecutiveOperationalFeedPanel";
import { LiveAgentActivityPanel } from "./LiveAgentActivityPanel";
import { AmbientSignalPanel } from "./AmbientSignalPanel";
import { GovernanceAlertPanel } from "./GovernanceAlertPanel";
import { CrisisCoordinationPanel } from "./CrisisCoordinationPanel";
import { ExecutiveAutomationPanel } from "./ExecutiveAutomationPanel";
import { ExecutionApprovalPanel } from "./ExecutionApprovalPanel";
import { RollbackControlPanel } from "./RollbackControlPanel";
import { AutomationHistoryPanel } from "./AutomationHistoryPanel";
import { ExecutiveAgentCoordinationPanel } from "./ExecutiveAgentCoordinationPanel";
import { AgentWorkspacePanel } from "./AgentWorkspacePanel";
import { AgentRoutingPanel } from "./AgentRoutingPanel";
import { CrossAgentEscalationPanel } from "./CrossAgentEscalationPanel";
import { ExecutiveWorkflowFabricPanel } from "./ExecutiveWorkflowFabricPanel";
import { WorkflowLifecyclePanel } from "./WorkflowLifecyclePanel";
import { WorkflowDependencyPanel } from "./WorkflowDependencyPanel";
import { WorkflowRecoveryPanel } from "./WorkflowRecoveryPanel";
import { WorkflowContinuityPanel } from "./WorkflowContinuityPanel";
import { OperationalMemoryInsightsPanel } from "./OperationalMemoryInsightsPanel";
import { FulfillmentOrdersPanel } from "./FulfillmentOrdersPanel";
import { TrustFulfillmentOrdersPanel } from "./TrustFulfillmentOrdersPanel";
import { RevenueOsFulfillmentPanel } from "./RevenueOsFulfillmentPanel";
import { SmartTrustOperationsPanel } from "./SmartTrustOperationsPanel";
import { VoiceCommandDiagnosticsPanel } from "./VoiceCommandDiagnosticsPanel";
import { ExecutiveCollapsibleTile, ExecutiveEmbeddedStack } from "./ExecutiveCollapsibleTile";
import type { ExecutiveSttInputMode } from "@/lib/voices/stt-provider";

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

type BentleyBriefSlice = {
  campaignsWithBentleyPayloadApprox?: number | null;
  postsScheduledApprox?: number | null;
  postsBlockedOrDraftUnscheduledApprox?: number | null;
  pendingExecutiveApprovalsForAdmin?: number | null;
  content360PlatformConfigured?: boolean;
  unavailable?: boolean;
  latestCadenceRuns?: unknown[];
  notes?: string[];
  campaignsWithPayload?: number | null;
  scheduledPosts?: number | null;
  stuckDraftOrFailed?: number | null;
};

type ChatChart = { title: string; series: Array<{ label: string; value: string | number }> };

export type ExecutiveOperationsSidebarProps = {
  approvals: ApprovalRow[];
  onApprove: (row: ApprovalRow) => void;
  onReject: (id: string) => void;
  lastApprovalExec: {
    id: string;
    action: string;
    ok: boolean;
    message: string;
    status?: string;
  } | null;
  clientIdTrim: string;
  onLoadApprovals: () => void;
  recentConversations: RecentConversationRow[];
  recentConversationsError: string | null;
  followUpRecommendations: FollowUpRecommendationRow[];
  followUpError: string | null;
  followUpQueueBusyId: string | null;
  onQueueFollowUp: (rec: FollowUpRecommendationRow) => void;
  bentleyBrief?: BentleyBriefSlice | null;
  bentleyClientSlice?: BentleyBriefSlice | null;
  liveMetricsSystemHealth?: {
    database?: string;
    apiServices?: string;
    executiveReadTools?: string;
  } | null;
  voicePreflight?: { nextSteps?: string[] } | null;
  voiceDiagnostics: ExecutiveVoiceDiagnostics;
  voiceSttInputMode: ExecutiveSttInputMode;
  voiceSessionId?: string | null;
  voicePendingAnalytics?: { intent: string; createdAt: string } | null;
  onTestSttHealth: () => void;
  onTestSelfHostedStt: () => void;
  sttTestBusy?: boolean;
  sttTestTranscript?: string | null;
  learningPendingPreview?: {
    improvements: number;
    capabilities: number;
    overlays: number;
  } | null;
  summaryError: string | null;
  chatCharts?: ChatChart[] | null;
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

function scrollToApproval(approvalId: string) {
  document.getElementById(`executive-approval-${approvalId}`)?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

export function ExecutiveOperationsSidebar(props: ExecutiveOperationsSidebarProps) {
  const {
    approvals,
    onApprove,
    onReject,
    lastApprovalExec,
    clientIdTrim,
    onLoadApprovals,
    recentConversations,
    recentConversationsError,
    followUpRecommendations,
    followUpError,
    followUpQueueBusyId,
    onQueueFollowUp,
    bentleyBrief,
    bentleyClientSlice,
    liveMetricsSystemHealth,
    voicePreflight,
    voiceDiagnostics,
    voiceSttInputMode,
    voiceSessionId,
    voicePendingAnalytics,
    onTestSttHealth,
    onTestSelfHostedStt,
    sttTestBusy,
    sttTestTranscript,
    learningPendingPreview,
    summaryError,
    chatCharts,
  } = props;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-2 xl:col-span-4 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto xl:pr-1"
    >
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00b7ff]/85">
        Operations
      </p>

      <ExecutiveCollapsibleTile
        title="Pending approvals"
        subtitle="Explicit approve / reject only"
        badge={
          approvals.length > 0 ? (
            <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
              {approvals.length}
            </span>
          ) : null
        }
      >
        {approvals.length === 0 ? (
          <p className="text-[11px] text-slate-500">No pending proposals.</p>
        ) : (
          <ul className="max-h-52 space-y-2 overflow-y-auto text-[11px]">
            {approvals.map((a) => (
              <li key={a.id} id={`executive-approval-${a.id}`} className="rounded-lg border border-slate-700/50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#00A3FF]/90">
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
                    onClick={() => void onApprove(a)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-200"
                    onClick={() => void onReject(a.id)}
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
              lastApprovalExec.ok
                ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100/90"
                : "border-amber-500/30 bg-amber-950/20 text-amber-100/90"
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
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Operations briefing" subtitle="Urgent desk actions and cross-dept signals">
        <ExecutiveOperationsBriefingPanel onOpenApproval={scrollToApproval} />
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="KPI & forecasting" subtitle="Advisory metrics — no autonomous actions">
        <ExecutiveEmbeddedStack>
          <ExecutiveKpiOverviewPanel />
          <OperationalHealthPanel />
          <FulfillmentForecastPanel />
          <ForecastRiskPanel />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Operators & delegation" subtitle="Registry, workload, escalation paths">
        <ExecutiveEmbeddedStack>
          <ExecutiveOperatorPanel />
          <OperatorWorkloadPanel />
          <DelegationQueuePanel onOpenApproval={scrollToApproval} />
          <EscalationPanel onOpenApproval={scrollToApproval} />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Simulation & intelligence" subtitle="What-if, knowledge graph, memory">
        <ExecutiveEmbeddedStack>
          <ExecutiveSimulationPanel />
          <SimulationForecastPanel />
          <ScenarioComparisonPanel />
          <BottleneckCascadePanel />
          <ExecutiveKnowledgeGraphPanel />
          <StrategicMemoryPanel />
          <OrganizationalIntelligencePanel />
          <HistoricalContextPanel />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Planning" subtitle="Recovery, staffing, initiatives — advisory only">
        <ExecutiveEmbeddedStack>
          <ExecutivePlanningPanel />
          <RecoveryPlanningPanel />
          <StaffingPlanningPanel />
          <InitiativePlanningPanel />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Incidents & governance" subtitle="Live feed, alerts, crisis coordination">
        <ExecutiveEmbeddedStack>
          <IncidentIntelligencePanel />
          <AmbientSignalPanel />
          <ExecutiveOperationalFeedPanel />
          <LiveAgentActivityPanel />
          <GovernanceAlertPanel />
          <CrisisCoordinationPanel />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Automation" subtitle="Approval-gated execution and rollback">
        <ExecutiveEmbeddedStack>
          <ExecutiveAutomationPanel />
          <ExecutionApprovalPanel onExecuted={onLoadApprovals} />
          <RollbackControlPanel onRolledBack={onLoadApprovals} />
          <AutomationHistoryPanel />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Multi-agent & workflows" subtitle="Coordination, routing, persistent fabric">
        <ExecutiveEmbeddedStack>
          <ExecutiveAgentCoordinationPanel />
          <AgentWorkspacePanel />
          <AgentRoutingPanel
            onRouted={(approvalId) => {
              if (approvalId) scrollToApproval(approvalId);
              onLoadApprovals();
            }}
          />
          <CrossAgentEscalationPanel />
          <ExecutiveWorkflowFabricPanel />
          <WorkflowLifecyclePanel />
          <WorkflowDependencyPanel />
          <WorkflowRecoveryPanel />
          <WorkflowContinuityPanel />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Operational memory" subtitle="Learning from desk history — read-only">
        <OperationalMemoryInsightsPanel />
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="WEBSITE fulfillment" subtitle="Site Builder queue and payment confirm">
        <FulfillmentOrdersPanel
          defaultClientId={clientIdTrim}
          onApprovalsRefresh={onLoadApprovals}
          onOpenApproval={scrollToApproval}
        />
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="TRUST fulfillment" subtitle="Legal review packets — no trust apply">
        <TrustFulfillmentOrdersPanel
          defaultClientId={clientIdTrim}
          onApprovalsRefresh={onLoadApprovals}
          onOpenApproval={scrollToApproval}
        />
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="REVENUE_OS & SMART_TRUST" subtitle="Campaign and governance desks">
        <ExecutiveEmbeddedStack>
          <RevenueOsFulfillmentPanel
            defaultClientId={clientIdTrim}
            onApprovalsRefresh={onLoadApprovals}
            onOpenApproval={scrollToApproval}
          />
          <SmartTrustOperationsPanel
            defaultClientId={clientIdTrim}
            onApprovalsRefresh={onLoadApprovals}
            onOpenApproval={scrollToApproval}
          />
        </ExecutiveEmbeddedStack>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Conversations & signals" subtitle="Recent threads, follow-ups, Bentley">
        <div className="space-y-3">
          <div>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00A3FF]/70">
              Recent conversations
            </h4>
            {recentConversationsError ? (
              <p className="text-xs text-amber-200/90">{recentConversationsError}</p>
            ) : recentConversations.length === 0 ? (
              <p className="text-xs text-slate-500">No recent threads returned.</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto text-[11px]">
                {recentConversations.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-700/50 p-2">
                    <div className="flex justify-between gap-2 text-slate-400">
                      <span className="font-medium text-slate-200">{c.displayName}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase">{c.source}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-slate-400">{c.snippet || "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              Follow-up signals
            </h4>
            {followUpError ? (
              <p className="text-xs text-amber-200/90">{followUpError}</p>
            ) : followUpRecommendations.length === 0 ? (
              <p className="text-xs text-slate-500">No actionable recommendations right now.</p>
            ) : (
              <ul className="max-h-36 space-y-2 overflow-y-auto text-[11px]">
                {followUpRecommendations.map((rec) => (
                  <li key={rec.id} className="rounded-lg border border-slate-700/50 p-2">
                    <div className="font-medium text-slate-200">{rec.title}</div>
                    <p className="mt-1 text-slate-400">{rec.detail}</p>
                    <button
                      type="button"
                      disabled={followUpQueueBusyId === rec.id}
                      onClick={() => void onQueueFollowUp(rec)}
                      className="mt-2 rounded bg-[#00A3FF]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-40"
                    >
                      {followUpQueueBusyId === rec.id ? "Queueing…" : "Queue approval"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
              Bentley readiness
            </h4>
            {!bentleyBrief ? (
              <p className="text-xs text-slate-500">Summary did not include Bentley bridge data.</p>
            ) : (
              <div className="space-y-1 text-[11px] text-slate-400">
                <p>
                  Campaigns w/ payload: {bentleyBrief.campaignsWithBentleyPayloadApprox ?? "—"} · Scheduled:{" "}
                  {bentleyBrief.postsScheduledApprox ?? "—"}
                </p>
                <p>
                  Pending approvals: {bentleyBrief.pendingExecutiveApprovalsForAdmin ?? "—"} · Content360:{" "}
                  {bentleyBrief.content360PlatformConfigured ? "configured" : "not configured"}
                </p>
                {clientIdTrim && bentleyClientSlice ? (
                  <p className="text-[10px] text-slate-500">
                    Client slice — payload: {bentleyClientSlice.campaignsWithPayload ?? "—"}, scheduled:{" "}
                    {bentleyClientSlice.scheduledPosts ?? "—"}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="System & voice" subtitle="Health checks and voice diagnostics">
        <div className="space-y-3">
          <div className="rounded-lg border border-[#00A3FF]/12 bg-[#00050A]/70 p-2 text-xs">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00b7ff]/70">System health</h4>
            <ul className="mt-2 space-y-1">
              <li className="flex justify-between">
                <span>Database</span>
                <span className="text-emerald-300">{liveMetricsSystemHealth?.database ?? "ok"}</span>
              </li>
              <li className="flex justify-between">
                <span>API services</span>
                <span className="text-emerald-300">{liveMetricsSystemHealth?.apiServices ?? "ok"}</span>
              </li>
              <li className="flex justify-between">
                <span>Read tools</span>
                <span className="text-emerald-300">{liveMetricsSystemHealth?.executiveReadTools ?? "ok"}</span>
              </li>
            </ul>
          </div>
          {voicePreflight?.nextSteps && voicePreflight.nextSteps.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-[11px] text-amber-50/95">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">Voice preflight</h4>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px]">
                {voicePreflight.nextSteps.slice(0, 4).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <VoiceCommandDiagnosticsPanel
            data={voiceDiagnostics}
            defaultCollapsed
            voiceSttInputMode={voiceSttInputMode}
            voiceSessionId={voiceSessionId}
            voicePendingAnalytics={voicePendingAnalytics}
            onTestSttHealth={onTestSttHealth}
            onTestSelfHostedStt={onTestSelfHostedStt}
            sttTestBusy={sttTestBusy}
            sttTestTranscript={sttTestTranscript}
          />
          {learningPendingPreview ? (
            <div className="rounded-lg border border-violet-500/20 bg-violet-950/15 p-2 text-[11px] text-slate-300">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/80">
                SKIPPER learning inbox
              </h4>
              <p className="mt-1 text-slate-400">
                Pending: {learningPendingPreview.improvements} suggestion(s), {learningPendingPreview.capabilities}{" "}
                capability note(s), {learningPendingPreview.overlays} overlay(s).
              </p>
            </div>
          ) : null}
          {summaryError ? <p className="text-xs text-amber-200">{summaryError}</p> : null}
          {chatCharts && chatCharts.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A3FF]/70">Charts</h4>
              {chatCharts.map((c) => (
                <div key={c.title} className="rounded-lg border border-slate-700/50 p-2 text-[11px]">
                  <div className="font-medium text-slate-200">{c.title}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </ExecutiveCollapsibleTile>
    </motion.aside>
  );
}
