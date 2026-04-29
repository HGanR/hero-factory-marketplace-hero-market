/**
 * Background / batched publish-approval SLA scan across campaigns (Part 21).
 * Reuses {@link runCampaignPublishApprovalSlaScan} for reminder + UTM dedupe semantics.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { campaignPosts, campaignReviewerAssignments, campaigns } from "@/lib/db/schema";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import {
  runCampaignPublishApprovalSlaScan,
  utmParamsToStringRecord,
} from "@/lib/revenue-os/publish-approval-sla-scan";
import {
  type InternalJobBoundedError,
  pushBoundedInternalJobError,
} from "@/lib/revenue-os/internal-batch-job-run";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Posts in these statuses may still need publish approval before go-live. */
export const SLA_BATCH_PROBE_POST_STATUSES = ["SCHEDULED", "RETRY_SCHEDULED", "DRAFT"] as const;

const DEFAULT_MAX_CAMPAIGNS = 40;
const DEFAULT_MAX_POST_PROBE_ROWS = 5000;
const ABS_MAX_CAMPAIGNS = 200;
const ABS_MIN_CAMPAIGNS = 1;
const ABS_MAX_PROBE_ROWS = 20000;
const ABS_MIN_PROBE_ROWS = 200;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * SQL prefilter: posts that might be effectively `pending_approval` (explicit status or missing key when worker gate on).
 * Final eligibility is still checked in JS via {@link resolveEffectiveApprovalStatus}.
 */
export function plausiblePendingApprovalProbeWhereSql(workerRequiresApproval: boolean) {
  const approvalStatusJson = sql`JSON_UNQUOTE(JSON_EXTRACT(${campaignPosts.utmParams}, '$.bentley_approval_status'))`;
  const normApprovalStatus = sql`LOWER(REPLACE(TRIM(IFNULL(${approvalStatusJson}, '')), '-', '_'))`;
  const explicitPending = sql`${normApprovalStatus} IN ('pending_approval', 'pending')`;
  const missingApprovalStatus = sql`(
    ${campaignPosts.utmParams} IS NULL
    OR JSON_TYPE(JSON_EXTRACT(${campaignPosts.utmParams}, '$.bentley_approval_status')) IS NULL
    OR TRIM(IFNULL(${approvalStatusJson}, '')) = ''
  )`;
  return workerRequiresApproval
    ? sql`(${explicitPending} OR ${missingApprovalStatus})`
    : explicitPending;
}

/**
 * Distinct campaign ids (stable order: first-seen by probe row order = recent `updatedAt` first).
 */
export function collectCampaignIdsForPublishApprovalSlaBatchScan(
  rows: { campaignId: string; utmParams: unknown }[],
  workerRequiresApproval: boolean,
  maxCampaigns: number
): { campaignIdsToScan: string[]; campaignsSkipped: number } {
  const distinctPending: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const utmRec = utmParamsToStringRecord(row.utmParams);
    if (resolveEffectiveApprovalStatus(workerRequiresApproval, utmRec) !== "pending_approval") continue;
    if (seen.has(row.campaignId)) continue;
    seen.add(row.campaignId);
    distinctPending.push(row.campaignId);
  }
  const capped = clamp(maxCampaigns, ABS_MIN_CAMPAIGNS, ABS_MAX_CAMPAIGNS);
  const campaignIdsToScan = distinctPending.slice(0, capped);
  const campaignsSkipped = distinctPending.length - campaignIdsToScan.length;
  return { campaignIdsToScan, campaignsSkipped };
}

export type PublishApprovalSlaScanAllSummary = {
  campaignsScanned: number;
  postsChecked: number;
  remindersCreated: number;
  campaignsSkipped: number;
  errors: number;
  approvalGateDisabled: boolean;
};

export type PublishApprovalSlaScanAllRunResult = PublishApprovalSlaScanAllSummary & {
  boundedErrors: InternalJobBoundedError[];
};

/**
 * Load a bounded sample of posts that plausibly need SLA attention; used to pick distinct campaigns.
 */
export async function loadPlausiblePendingPostProbeRows(
  db: Db,
  args: { workerRequiresApproval: boolean; maxPostProbeRows: number }
): Promise<{ campaignId: string; utmParams: unknown }[]> {
  const maxRows = clamp(args.maxPostProbeRows, ABS_MIN_PROBE_ROWS, ABS_MAX_PROBE_ROWS);
  const predicate = plausiblePendingApprovalProbeWhereSql(args.workerRequiresApproval);
  return db
    .select({ campaignId: campaignPosts.campaignId, utmParams: campaignPosts.utmParams })
    .from(campaignPosts)
    .where(and(inArray(campaignPosts.status, [...SLA_BATCH_PROBE_POST_STATUSES]), predicate))
    .orderBy(desc(campaignPosts.updatedAt))
    .limit(maxRows);
}

export type PublishApprovalSlaScanAllDeps = {
  loadProbeRows?: typeof loadPlausiblePendingPostProbeRows;
  runCampaignScan?: typeof runCampaignPublishApprovalSlaScan;
};

/**
 * One campaign: load row + assignments + posts, then {@link runCampaignPublishApprovalSlaScan}.
 * Failures return `ok: false` (non-fatal for batch callers).
 */
export async function executePublishApprovalSlaScanForCampaign(
  db: Db,
  args: {
    campaignId: string;
    workerRequiresApproval: boolean;
    now?: Date;
    runCampaignScan?: typeof runCampaignPublishApprovalSlaScan;
  }
): Promise<
  | { ok: true; checked: number; remindersSent: number }
  | { ok: false; reason: "campaign_missing" | "error"; detailMessage?: string }
> {
  const runOne = args.runCampaignScan ?? runCampaignPublishApprovalSlaScan;
  try {
    const campRows = await db.select().from(campaigns).where(eq(campaigns.id, args.campaignId)).limit(1);
    const camp = campRows[0];
    if (!camp) {
      return { ok: false, reason: "campaign_missing" };
    }

    const assignRows = await db
      .select({ userId: campaignReviewerAssignments.userId, role: campaignReviewerAssignments.role })
      .from(campaignReviewerAssignments)
      .where(eq(campaignReviewerAssignments.campaignId, args.campaignId));

    const postRows = await db
      .select({ id: campaignPosts.id, utmParams: campaignPosts.utmParams })
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, args.campaignId));

    const r = await runOne(db, {
      campaignId: args.campaignId,
      campaignName: camp.name ?? "",
      clientId: camp.clientId ?? "",
      ownerUserId: camp.userId,
      publishApprovalChainJson: camp.publishApprovalChainJson,
      posts: postRows,
      workerRequiresApproval: args.workerRequiresApproval,
      assignmentRows: assignRows,
      now: args.now,
    });

    return { ok: true, checked: r.checked, remindersSent: r.remindersSent };
  } catch (e) {
    const detailMessage = e instanceof Error ? e.message : String(e);
    console.error("[publish-approval-sla-scan-batch] campaign failed", args.campaignId, e);
    return { ok: false, reason: "error", detailMessage };
  }
}

/**
 * Scan up to `maxCampaigns` campaigns that have at least one effectively pending post (under worker gate).
 * Per-campaign failures increment `errors` and do not stop the batch.
 *
 * `deps` is optional; used in tests to inject probe rows without hitting the database.
 */
export async function runPublishApprovalSlaScanAllCampaigns(
  db: Db,
  options?: {
    workerRequiresApproval?: boolean;
    maxCampaigns?: number;
    maxPostProbeRows?: number;
    now?: Date;
    deps?: PublishApprovalSlaScanAllDeps;
  }
): Promise<PublishApprovalSlaScanAllRunResult> {
  const workerRequiresApproval = options?.workerRequiresApproval ?? readScheduledPublishRequireApprovalEnv();

  if (!workerRequiresApproval) {
    return {
      campaignsScanned: 0,
      postsChecked: 0,
      remindersCreated: 0,
      campaignsSkipped: 0,
      errors: 0,
      approvalGateDisabled: true,
      boundedErrors: [],
    };
  }

  const maxCampaigns = options?.maxCampaigns ?? DEFAULT_MAX_CAMPAIGNS;
  const maxPostProbeRows = options?.maxPostProbeRows ?? DEFAULT_MAX_POST_PROBE_ROWS;
  const loadProbe = options?.deps?.loadProbeRows ?? loadPlausiblePendingPostProbeRows;
  const runCampaignScan = options?.deps?.runCampaignScan ?? runCampaignPublishApprovalSlaScan;

  const probeRows = await loadProbe(db, {
    workerRequiresApproval,
    maxPostProbeRows,
  });

  const { campaignIdsToScan, campaignsSkipped } = collectCampaignIdsForPublishApprovalSlaBatchScan(
    probeRows,
    workerRequiresApproval,
    maxCampaigns
  );

  let campaignsScanned = 0;
  let postsChecked = 0;
  let remindersCreated = 0;
  let errors = 0;
  const boundedErrors: InternalJobBoundedError[] = [];

  for (const campaignId of campaignIdsToScan) {
    const res = await executePublishApprovalSlaScanForCampaign(db, {
      campaignId,
      workerRequiresApproval,
      now: options?.now,
      runCampaignScan,
    });
    if (!res.ok) {
      errors += 1;
      const msg =
        res.reason === "campaign_missing"
          ? "campaign_missing"
          : truncateSlaErrorDetail(res.detailMessage ?? res.reason);
      pushBoundedInternalJobError(boundedErrors, { campaignId, message: msg });
      continue;
    }
    campaignsScanned += 1;
    postsChecked += res.checked;
    remindersCreated += res.remindersSent;
  }

  return {
    campaignsScanned,
    postsChecked,
    remindersCreated,
    campaignsSkipped,
    errors,
    approvalGateDisabled: false,
    boundedErrors,
  };
}

function truncateSlaErrorDetail(s: string): string {
  return s.length > 500 ? `${s.slice(0, 499)}…` : s;
}
