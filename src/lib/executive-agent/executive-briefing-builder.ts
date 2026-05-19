import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { summarizeBentleyExecutiveBridge } from "@/lib/executive-agent/bentley-executive-bridge";
import {
  buildFollowUpRecommendations,
  gatherClientFollowUpSignals,
} from "@/lib/executive-agent/client-followup-intelligence";
import { listExecutiveApprovals } from "@/lib/executive-agent/executive-agent-approvals-store";
import * as Tools from "@/lib/executive-agent/executive-agent-tools";
import { listExecutiveVoiceTurnsSinceForAdmin } from "@/lib/executive-agent/executive-agent-voice-store";
import { redactSecretsFromExecutivePrompt } from "@/lib/executive-agent/executive-agent-prompt-redact";
import { buildLiveMetricsResponse, type LiveMetricsResponse } from "@/lib/executive-agent/executive-live-metrics";
import { isExecutiveMemoryItemActive } from "@/lib/executive-agent/executive-memory-active";
import { listExecutiveMemoryItems } from "@/lib/executive-agent/executive-memory-store";
import { loadRecentConversationsForExecutive } from "@/lib/executive-agent/executive-recent-conversations";

type Db = MySql2Database<typeof schema>;

export type ExecutiveBriefingBullet = { title: string; detail: string };

export type ExecutiveDailyBriefing = {
  headline: string;
  priorities: ExecutiveBriefingBullet[];
  risks: ExecutiveBriefingBullet[];
  opportunities: ExecutiveBriefingBullet[];
  approvalsNeeded: Array<{ id: string; title: string; proposedAction: string }>;
  clientFollowUps: ExecutiveBriefingBullet[];
  agentSignals: ExecutiveBriefingBullet[];
  bentleyStatus: { headline: string; detail: string; notes: string[]; unavailable: boolean };
  systemHealth: LiveMetricsResponse["systemHealth"] & { note?: string };
  suggestedFirstActions: ExecutiveBriefingBullet[];
  meta: {
    briefingDate: string;
    generatedAt: string;
    memoryItemsUsed: number;
    voiceChatTurns24h: number;
    recentConversationsSample: number;
  };
};

function rt(s: string): string {
  return redactSecretsFromExecutivePrompt(s.slice(0, 4000));
}

async function safePick<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

export function briefingDateUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function buildExecutiveDailyBriefing(
  db: Db,
  adminUserId: number,
  opts?: { now?: Date; briefingDate?: string }
): Promise<ExecutiveDailyBriefing> {
  const now = opts?.now ?? new Date();
  const briefingDate = opts?.briefingDate ?? briefingDateUtc(now);
  const ctx: Tools.ExecutiveToolContext = {
    db,
    adminUserId,
    selectedClientId: null,
    selectedCampaignId: null,
  };

  const pending = await safePick(() => Tools.getPendingAccounts(ctx));
  const approved = await safePick(() => Tools.getApprovedAccounts(ctx));
  const active = await safePick(() => Tools.getActiveAccounts(ctx));
  const platform = await safePick(() => Tools.getPlatformAnalyticsSummary(ctx));
  const inbox = await safePick(() => Tools.getInboxEngagementSummary(ctx));
  const bentley = await safePick(() => summarizeBentleyExecutiveBridge(db, ctx));
  const approvals = await safePick(() => listExecutiveApprovals(db, { adminUserId, status: "pending", limit: 40 }));
  const signals = await safePick(() => gatherClientFollowUpSignals(db, ctx));
  const recommendations = signals ? buildFollowUpRecommendations(signals) : [];
  const convos = (await safePick(() => loadRecentConversationsForExecutive(db, 14))) ?? [];
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const voiceTurns = (await safePick(() => listExecutiveVoiceTurnsSinceForAdmin(db, adminUserId, since24h, 50))) ?? [];
  const memoryRows = (await safePick(() => listExecutiveMemoryItems(db, { adminUserId, limit: 50, activeOnly: true, now }))) ?? [];
  const activeMemory = memoryRows.filter((r) => isExecutiveMemoryItemActive(r, now));

  const inboxObj = inbox as { threadsLast7d?: number; unavailable?: boolean; message?: string } | undefined;
  const snap = {
    pendingAllTime: pending?.pendingAllTime ?? null,
    pendingApprox30d: pending?.pendingApprox30d ?? null,
    approvedActive: approved?.approvedActive ?? null,
    approvedInactive: approved?.approvedInactive ?? null,
    activeUsers: active?.activeUsers ?? null,
    marketplaceUsers: platform?.marketplaceUsers ?? null,
    crmClients: platform?.crmClients ?? null,
    socialCampaigns: platform?.socialCampaigns ?? null,
    threadsLast7d: inboxObj?.threadsLast7d ?? null,
    inboxUnavailable: Boolean(inboxObj?.unavailable),
    inboxMessage: typeof inboxObj?.message === "string" ? inboxObj.message : undefined,
  };
  const live = buildLiveMetricsResponse(snap, now.toISOString());

  const pendingN = pending?.pendingAllTime ?? 0;
  const inactiveApproved = approved?.approvedInactive ?? 0;
  const approvalsList = approvals ?? [];
  const pendingApprovalsN = approvalsList.length;

  const headlineParts: string[] = [];
  if (pendingN > 0) headlineParts.push(`${pendingN} marketplace account(s) pending approval`);
  if (pendingApprovalsN > 0) headlineParts.push(`${pendingApprovalsN} executive approval(s) waiting`);
  if (!headlineParts.length) headlineParts.push("Queues look clear — review signals and memory for proactive work.");
  const headline = rt(headlineParts.join(" · "));

  const priorityCandidates: ExecutiveBriefingBullet[] = [];
  if (pendingN > 0) {
    priorityCandidates.push({
      title: "Clear pending marketplace accounts",
      detail: rt(`${pendingN} total pending; ~${pending?.pendingApprox30d ?? "?"} in the last 30 days.`),
    });
  }
  if (inactiveApproved > 0) {
    priorityCandidates.push({
      title: "Approved but inactive accounts",
      detail: rt(`${inactiveApproved} approved user(s) are inactive — consider re-engagement or hygiene review.`),
    });
  }
  for (const m of activeMemory.filter((x) => x.memoryType === "client_priority" || x.memoryType === "decision").slice(0, 4)) {
    priorityCandidates.push({
      title: rt(m.title),
      detail: rt(m.summary.slice(0, 400)),
    });
  }
  if (pendingApprovalsN > 0) {
    priorityCandidates.push({
      title: "Review executive approval queue",
      detail: rt(`${pendingApprovalsN} open proposal(s) require admin decision.`),
    });
  }
  for (const m of activeMemory) {
    if (priorityCandidates.length >= 12) break;
    if (m.memoryType === "client_priority" || m.memoryType === "decision") continue;
    priorityCandidates.push({ title: rt(m.title), detail: rt(m.summary.slice(0, 400)) });
  }
  const prioritiesTop3 =
    priorityCandidates.length > 0
      ? priorityCandidates.slice(0, 3)
      : [{ title: "Review executive signals", detail: "No urgent queue items detected — skim approvals and memory." }];

  const risks: ExecutiveBriefingBullet[] = [];
  const stuck = bentley?.postsBlockedOrDraftUnscheduledApprox;
  if (typeof stuck === "number" && stuck > 0) {
    risks.push({
      title: "Campaign posts may be stuck (draft/failed, unscheduled)",
      detail: rt(`Approx ${stuck} post row(s) without schedule — see Bentley bridge.`),
    });
  }
  for (const r of recommendations.filter((x) => x.severity === "warning").slice(0, 5)) {
    risks.push({ title: rt(r.title), detail: rt(r.detail) });
  }
  if (bentley?.unavailable) {
    risks.push({
      title: "Bentley readiness data partially unavailable",
      detail: rt((bentley.notes?.[0] ?? "Some rollup queries did not return data.").slice(0, 400)),
    });
  }
  if (live.pendingAccounts.unavailable && live.approvedAccounts.unavailable) {
    risks.push({
      title: "Account metrics unavailable",
      detail: "Could not load marketplace account summaries — check database connectivity.",
    });
  }

  const opportunities: ExecutiveBriefingBullet[] = [];
  const crmN = platform?.crmClients;
  if (typeof crmN === "number" && crmN > 0) {
    opportunities.push({
      title: "CRM footprint",
      detail: rt(`${crmN} CRM client record(s) — align executive todos with high-value relationships.`),
    });
  }
  const sched = bentley?.postsScheduledApprox;
  if (typeof sched === "number" && sched > 0) {
    opportunities.push({
      title: "Scheduled social pipeline",
      detail: rt(`${sched} scheduled post(s) in flight — monitor for launch windows.`),
    });
  }
  for (const r of recommendations.filter((x) => x.severity === "info").slice(0, 3)) {
    opportunities.push({ title: rt(r.title), detail: rt(r.detail) });
  }

  const approvalsNeeded = approvalsList.slice(0, 25).map((a) => {
    let extra = "";
    try {
      const p = JSON.parse(a.payloadJson) as Record<string, unknown>;
      if (typeof p.note === "string") extra = p.note.slice(0, 160);
      else if (typeof p.clientId === "string") extra = `client ${p.clientId}`;
    } catch {
      extra = "";
    }
    const titleBase = extra ? `${a.proposedAction} — ${extra}` : a.proposedAction;
    return {
      id: a.id,
      title: rt(titleBase.slice(0, 240)),
      proposedAction: a.proposedAction,
    };
  });

  const clientFollowUps: ExecutiveBriefingBullet[] = recommendations.slice(0, 12).map((r) => ({
    title: rt(r.title),
    detail: rt(r.detail),
  }));

  const agentSignals: ExecutiveBriefingBullet[] = [];
  agentSignals.push({
    title: "Voice / chat turns (24h)",
    detail: rt(`${voiceTurns.length} orchestrator turn(s) logged in the last 24 hours.`),
  });
  for (const c of convos.slice(0, 6)) {
    agentSignals.push({
      title: rt(`${c.displayName} (${c.agentKey})`),
      detail: rt(c.snippet.slice(0, 220)),
    });
  }

  const bentleyUnavailable = bentley?.unavailable ?? true;
  const bentleyHeadline = bentleyUnavailable ? "Bentley bridge: limited data" : "Bentley bridge: live rollups";
  const bentleyDetail =
    typeof bentley?.postsScheduledApprox === "number"
      ? `Scheduled posts (approx): ${bentley.postsScheduledApprox}; payloads: ${bentley.campaignsWithBentleyPayloadApprox ?? "—"}; stuck/draft: ${bentley.postsBlockedOrDraftUnscheduledApprox ?? "—"}.`
    : "Some Bentley metrics could not be computed — see notes.";
  const bentleyStatus = {
    headline: rt(bentleyHeadline),
    detail: rt(bentleyDetail),
    notes: (bentley?.notes ?? []).map((n) => rt(n)).slice(0, 8),
    unavailable: bentleyUnavailable,
  };

  const systemHealth: ExecutiveDailyBriefing["systemHealth"] = {
    ...live.systemHealth,
    note:
      !pending && !approved
        ? "Partial data: account summaries failed to load."
        : undefined,
  };

  const suggestedFirstActions: ExecutiveBriefingBullet[] = [];
  if (approvalsList[0]) {
    suggestedFirstActions.push({
      title: "Open first pending approval",
      detail: rt(`Start with ${approvalsList[0]!.proposedAction} (${approvalsList[0]!.id.slice(0, 8)}…).`),
    });
  }
  if (pendingN > 0) {
    suggestedFirstActions.push({
      title: "Process oldest pending marketplace accounts",
      detail: "Work the pending queue before new submissions age further.",
    });
  }
  if (recommendations[0]) {
    suggestedFirstActions.push({
      title: rt(recommendations[0]!.title),
      detail: rt(recommendations[0]!.detail.slice(0, 300)),
    });
  }
  suggestedFirstActions.push({
    title: "Skim executive memory",
    detail: `${activeMemory.length} active memory item(s) inform today's priorities.`,
  });

  return {
    headline,
    priorities: prioritiesTop3,
    risks: risks.slice(0, 8),
    opportunities: opportunities.slice(0, 8),
    approvalsNeeded,
    clientFollowUps,
    agentSignals,
    bentleyStatus,
    systemHealth,
    suggestedFirstActions: suggestedFirstActions.slice(0, 8),
    meta: {
      briefingDate,
      generatedAt: now.toISOString(),
      memoryItemsUsed: activeMemory.length,
      voiceChatTurns24h: voiceTurns.length,
      recentConversationsSample: convos.length,
    },
  };
}
