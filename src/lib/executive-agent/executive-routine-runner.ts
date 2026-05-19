import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentRoutines } from "@/lib/db/schema";
import { summarizeBentleyExecutiveBridge } from "@/lib/executive-agent/bentley-executive-bridge";
import { listStaleActiveClientIdsForExecutiveRoutine } from "@/lib/executive-agent/client-followup-intelligence";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { insertExecutiveApproval, listExecutiveApprovals } from "@/lib/executive-agent/executive-agent-approvals-store";
import { isWriteAction } from "@/lib/executive-agent/executive-agent-policy";
import { redactSecretsFromExecutivePrompt } from "@/lib/executive-agent/executive-agent-prompt-redact";
import * as Tools from "@/lib/executive-agent/executive-agent-tools";
import { buildExecutiveDailyBriefing, briefingDateUtc } from "@/lib/executive-agent/executive-briefing-builder";
import { redactExecutiveBriefingJsonValue } from "@/lib/executive-agent/executive-briefing-redact";
import { upsertExecutiveBriefingForAdminDate } from "@/lib/executive-agent/executive-memory-store";
import { runSkipperLearningDigestRoutine } from "@/lib/executive-agent/skipper-learning-digest-routine";
import { computeNextExecutiveRoutineRunAt, type ExecutiveRoutineCadence } from "@/lib/executive-agent/executive-routine-schedule";
import {
  createExecutiveRoutine,
  findExecutiveRoutineByType,
  getExecutiveRoutineForAdmin,
  listDueExecutiveRoutinesForCron,
  persistExecutiveRoutineRunResult,
} from "@/lib/executive-agent/executive-routine-store";

type Db = MySql2Database<typeof schema>;

export type ExecutiveRoutineRunResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  riskFlags: string[];
  summary: Record<string, unknown>;
};

function parseRoutineConfigJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rt(s: string): string {
  return redactSecretsFromExecutivePrompt(s.slice(0, 2000));
}

async function auditRoutineRun(
  db: Db,
  row: typeof executiveAgentRoutines.$inferSelect,
  output: Record<string, unknown>,
  triggeredBy: "cron" | "admin"
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: row.adminUserId,
    prompt: `executive_routine:${triggeredBy}:${row.routineType}`,
    toolName: "executive_routine.run",
    actionType: "system",
    targetType: "executive_routine",
    targetId: row.id,
    inputJson: JSON.stringify({ routineType: row.routineType, triggeredBy }).slice(0, 50_000),
    outputJson: JSON.stringify(output).slice(0, 50_000),
    approvalStatus: "not_required",
  });
}

/**
 * Runs a single routine row. Does not call approval executors or mutate CRM rows directly.
 * Allowed side effects: briefing upsert, approval queue inserts (createTodo), audit + routine timestamps.
 */
export async function runExecutiveRoutineRow(
  db: Db,
  row: typeof executiveAgentRoutines.$inferSelect,
  opts: { triggeredBy: "cron" | "admin"; force?: boolean }
): Promise<ExecutiveRoutineRunResult> {
  const now = new Date();
  if (opts.triggeredBy === "cron" && !row.enabled) {
    return { ok: true, skipped: true, reason: "disabled", riskFlags: [], summary: {} };
  }
  const notDue = row.nextRunAt.getTime() > now.getTime();
  if (!opts.force && notDue) {
    return { ok: true, skipped: true, reason: "not_due", riskFlags: [], summary: {} };
  }

  const riskFlags: string[] = [];
  const summary: Record<string, unknown> = {};
  const cadence = row.cadence as ExecutiveRoutineCadence;
  const ctx: Tools.ExecutiveToolContext = {
    db,
    adminUserId: row.adminUserId,
    selectedClientId: null,
    selectedCampaignId: null,
  };

  try {
    switch (row.routineType) {
      case "daily_briefing": {
        const briefing = await buildExecutiveDailyBriefing(db, row.adminUserId, {
          now,
          briefingDate: briefingDateUtc(now),
        });
        const safe = redactExecutiveBriefingJsonValue(briefing);
        await upsertExecutiveBriefingForAdminDate(db, row.adminUserId, briefing.meta.briefingDate, JSON.stringify(safe));
        summary.briefingDate = briefing.meta.briefingDate;
        summary.headline = safe.headline;
        if (briefing.risks.length) riskFlags.push("briefing_risks_present");
        break;
      }
      case "stale_client_scan": {
        const cfg = parseRoutineConfigJson(row.configJson);
        const max = Math.min(50, Math.max(1, Number(cfg.maxApprovalsPerRun ?? 5) || 5));
        const ids = await listStaleActiveClientIdsForExecutiveRoutine(db, max);
        let queued = 0;
        for (const clientId of ids) {
          const proposedAction = "createTodo";
          if (!isWriteAction(proposedAction)) continue;
          const approvalId = randomUUID();
          const note =
            "[Scheduled routine: stale_client_scan] Active CRM client has no internal notes in the last 30 days — add a note or follow-up.";
          await insertExecutiveApproval(db, {
            id: approvalId,
            adminUserId: row.adminUserId,
            proposedAction,
            targetType: "client",
            targetId: clientId,
            payloadJson: JSON.stringify({ clientId, note, recommendationId: "routine:stale_client_scan" }).slice(
              0,
              100_000,
            ),
          });
          await insertExecutiveAgentAuditLog(db, {
            id: randomUUID(),
            adminUserId: row.adminUserId,
            prompt: "executive_routine:stale_client_scan",
            toolName: "executive_routine.queue_approval",
            actionType: "write_proposal",
            targetType: "approval_queue",
            targetId: approvalId,
            inputJson: JSON.stringify({ clientId }).slice(0, 50_000),
            outputJson: null,
            approvalStatus: "pending",
          });
          queued += 1;
        }
        summary.approvalsQueued = queued;
        summary.staleClientSampleSize = ids.length;
        if (queued > 0) riskFlags.push("stale_clients_followups_queued");
        break;
      }
      case "pending_account_scan": {
        const pending = await Tools.getPendingAccounts(ctx);
        summary.pendingAllTime = pending.pendingAllTime;
        summary.pendingApprox30d = pending.pendingApprox30d;
        if (Number(pending.pendingAllTime ?? 0) > 0) riskFlags.push("pending_marketplace_accounts");
        break;
      }
      case "bentley_readiness_scan": {
        const bentley = await summarizeBentleyExecutiveBridge(db, ctx);
        summary.bentleyUnavailable = bentley.unavailable;
        summary.postsScheduledApprox = bentley.postsScheduledApprox;
        summary.postsBlockedOrDraftUnscheduledApprox = bentley.postsBlockedOrDraftUnscheduledApprox;
        if (bentley.unavailable) riskFlags.push("bentley_data_partially_unavailable");
        if (
          typeof bentley.postsBlockedOrDraftUnscheduledApprox === "number" &&
          bentley.postsBlockedOrDraftUnscheduledApprox > 0
        ) {
          riskFlags.push("bentley_stuck_or_draft_posts");
        }
        break;
      }
      case "approval_digest": {
        const pending = await listExecutiveApprovals(db, { adminUserId: row.adminUserId, status: "pending", limit: 100 });
        summary.pendingApprovalCount = pending.length;
        summary.sampleTitles = pending
          .slice(0, 10)
          .map((a) => rt(`${a.proposedAction} (${a.id.slice(0, 8)}…)`));
        if (pending.length > 0) riskFlags.push("pending_executive_approvals");
        break;
      }
      case "skipper_learning_digest": {
        const digest = await runSkipperLearningDigestRoutine(db, row.adminUserId);
        summary.skipperLearningDigest = digest;
        if (digest.promptSuggestionsQueued + digest.capabilitySuggestionsQueued > 0) {
          riskFlags.push("skipper_learning_pending_review");
        }
        break;
      }
    }

    const output = redactExecutiveBriefingJsonValue({
      ok: true,
      routineType: row.routineType,
      ranAt: now.toISOString(),
      riskFlags,
      summary,
    }) as Record<string, unknown>;

    await persistExecutiveRoutineRunResult(db, row.id, {
      lastRunAt: now,
      nextRunAt: computeNextExecutiveRoutineRunAt(cadence, now),
      lastOutputJson: JSON.stringify(output),
    });
    await auditRoutineRun(db, row, output, opts.triggeredBy);
    return { ok: true, riskFlags, summary: output };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const output = redactExecutiveBriefingJsonValue({
      ok: false,
      routineType: row.routineType,
      ranAt: now.toISOString(),
      error: msg,
      riskFlags,
      summary,
    }) as Record<string, unknown>;
    await persistExecutiveRoutineRunResult(db, row.id, {
      lastRunAt: now,
      nextRunAt: computeNextExecutiveRoutineRunAt(cadence, now),
      lastOutputJson: JSON.stringify(output),
    });
    await auditRoutineRun(db, row, output, opts.triggeredBy);
    return { ok: false, riskFlags, summary: output };
  }
}

export async function runExecutiveRoutineByIdForAdmin(db: Db, id: string, adminUserId: number) {
  const row = await getExecutiveRoutineForAdmin(db, id, adminUserId);
  if (!row) return null;
  return runExecutiveRoutineRow(db, row, { triggeredBy: "admin", force: true });
}

export async function runDueExecutiveRoutinesForCron(db: Db, now = new Date()) {
  const due = await listDueExecutiveRoutinesForCron(db, now);
  const results: Array<{ routineId: string; adminUserId: number; routineType: string; status: string }> = [];
  for (const row of due) {
    const r = await runExecutiveRoutineRow(db, row, { triggeredBy: "cron" });
    const status = r.skipped ? "skipped" : r.ok ? "ok" : "error";
    results.push({ routineId: row.id, adminUserId: row.adminUserId, routineType: row.routineType, status });
  }
  return { processed: due.length, results };
}

/** Ensure a default daily briefing routine exists (idempotent). */
export async function ensureDefaultDailyBriefingRoutine(db: Db, adminUserId: number) {
  const existing = await findExecutiveRoutineByType(db, adminUserId, "daily_briefing");
  if (existing) return existing;
  const now = new Date();
  const r = await createExecutiveRoutine(db, {
    adminUserId,
    routineType: "daily_briefing",
    cadence: "daily",
    enabled: true,
    configJson: "{}",
    nextRunAt: computeNextExecutiveRoutineRunAt("daily", now),
  });
  return r.row;
}

/** Idempotent default for SKIPPER learning digest (daily). */
export async function ensureSkipperLearningDigestRoutine(db: Db, adminUserId: number) {
  const existing = await findExecutiveRoutineByType(db, adminUserId, "skipper_learning_digest");
  if (existing) return existing;
  const now = new Date();
  const r = await createExecutiveRoutine(db, {
    adminUserId,
    routineType: "skipper_learning_digest",
    cadence: "daily",
    enabled: true,
    configJson: "{}",
    nextRunAt: computeNextExecutiveRoutineRunAt("daily", now),
  });
  return r.row;
}
