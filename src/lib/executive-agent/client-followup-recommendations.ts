/**
 * Pure recommendation builder (no DB) — safe for unit tests without `server-only`.
 */

export type FollowUpRecommendation = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning";
  proposedAction: "createTodo";
  /** Text for the eventual approved `createTodo` note — no CRM client is implied until the admin supplies one when queueing. */
  payloadTemplate: { note: string };
  /** `createTodo` always needs a real CRM `clientId`; the dashboard collects it before calling the approvals queue API. */
  requiresClientId: true;
};

export type ClientFollowUpSignals = {
  pendingAccountsApprox30d: number | null;
  approvedInactiveAccounts: number | null;
  clientsStaleCount: number | null;
  campaignsWithOutputsNoScheduledPost: number | null;
  pendingExecutiveApprovals: number | null;
  /** Distinct CRM clients with engagement thread activity in 7d but no internal note in 7d (best-effort). */
  clientsWithEngagementNoAdminNote7d: number | null;
  /** ISO timestamps of recent client notes (best-effort) */
  recentNoteActivitySample: string[];
};

export function buildFollowUpRecommendations(signals: ClientFollowUpSignals): FollowUpRecommendation[] {
  const out: FollowUpRecommendation[] = [];
  const rec = (r: Omit<FollowUpRecommendation, "requiresClientId" | "proposedAction">) =>
    out.push({ ...r, proposedAction: "createTodo", requiresClientId: true });

  if (signals.pendingExecutiveApprovals != null && signals.pendingExecutiveApprovals > 0) {
    rec({
      id: "exec-approvals-pending",
      title: "Executive approvals waiting",
      detail: `${signals.pendingExecutiveApprovals} proposal(s) require review in the approval queue.`,
      severity: "warning",
      payloadTemplate: {
        note: `[Executive follow-up] Review ${signals.pendingExecutiveApprovals} pending executive approval(s).`,
      },
    });
  }
  if (signals.pendingAccountsApprox30d != null && signals.pendingAccountsApprox30d > 0) {
    rec({
      id: "pending-accounts-30d",
      title: "Pending marketplace accounts (30d)",
      detail: `${signals.pendingAccountsApprox30d} account(s) submitted in the last 30 days still need approval.`,
      severity: "info",
      payloadTemplate: {
        note: `[Executive follow-up] ${signals.pendingAccountsApprox30d} marketplace account(s) pending approval (30d window).`,
      },
    });
  }
  if (signals.approvedInactiveAccounts != null && signals.approvedInactiveAccounts > 0) {
    rec({
      id: "approved-inactive",
      title: "Approved but inactive accounts",
      detail: `${signals.approvedInactiveAccounts} approved user(s) are currently inactive — consider re-engagement.`,
      severity: "info",
      payloadTemplate: {
        note: `[Executive follow-up] ${signals.approvedInactiveAccounts} approved marketplace account(s) are inactive.`,
      },
    });
  }
  if (signals.clientsStaleCount != null && signals.clientsStaleCount > 0) {
    rec({
      id: "clients-no-notes",
      title: "Active CRM clients without recent internal notes",
      detail: `${signals.clientsStaleCount} active client(s) have no internal notes in the last 30 days.`,
      severity: "warning",
      payloadTemplate: {
        note: `[Executive follow-up] ${signals.clientsStaleCount} active CRM client(s) lack internal notes in 30d.`,
      },
    });
  }
  if (signals.campaignsWithOutputsNoScheduledPost != null && signals.campaignsWithOutputsNoScheduledPost > 0) {
    rec({
      id: "bentley-output-no-schedule",
      title: "Campaign posts with Bentley payload but no schedule",
      detail: `${signals.campaignsWithOutputsNoScheduledPost} post row(s) look stuck in draft/failed without scheduledAt.`,
      severity: "warning",
      payloadTemplate: {
        note: `[Executive follow-up] ${signals.campaignsWithOutputsNoScheduledPost} campaign post(s) have Bentley output but no schedule.`,
      },
    });
  }
  if (signals.clientsWithEngagementNoAdminNote7d != null && signals.clientsWithEngagementNoAdminNote7d > 0) {
    rec({
      id: "engagement-no-admin-note",
      title: "Engagement threads without matching admin notes (7d)",
      detail: `${signals.clientsWithEngagementNoAdminNote7d} CRM client(s) had thread activity in 7d without an internal note in the same window.`,
      severity: "warning",
      payloadTemplate: {
        note: `[Executive follow-up] ${signals.clientsWithEngagementNoAdminNote7d} client(s) with engagement but no internal admin note (7d).`,
      },
    });
  }
  return out;
}
