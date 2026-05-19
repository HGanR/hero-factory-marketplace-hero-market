import { and, count, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  bentleyCadenceRuns,
  campaignPosts,
  campaigns,
  executiveAgentApprovals,
} from "@/lib/db/schema";
import { isContent360PlatformConfiguredFromEnv } from "@/lib/content360/content360-platform-env-read";
import type { ExecutiveToolContext } from "@/lib/executive-agent/executive-agent-tools";

type Db = MySql2Database<typeof schema>;

export type BentleyCadenceRunSummary = {
  id: string;
  clientId: string;
  runType: string;
  runStatus: string;
  startedAt: string;
};

export type BentleyExecutiveBridgeSummary = {
  latestCadenceRuns: BentleyCadenceRunSummary[];
  campaignsWithBentleyPayloadApprox: number | null;
  postsScheduledApprox: number | null;
  postsBlockedOrDraftUnscheduledApprox: number | null;
  pendingExecutiveApprovalsForAdmin: number | null;
  content360PlatformConfigured: boolean;
  notes: string[];
  unavailable: boolean;
};

const empty = (): BentleyExecutiveBridgeSummary => ({
  latestCadenceRuns: [],
  campaignsWithBentleyPayloadApprox: null,
  postsScheduledApprox: null,
  postsBlockedOrDraftUnscheduledApprox: null,
  pendingExecutiveApprovalsForAdmin: null,
  content360PlatformConfigured: false,
  notes: [],
  unavailable: false,
});

/**
 * Read-only executive rollup for Bentley / Revenue OS posture.
 * Each subsection degrades independently when tables or env are missing.
 */
export async function summarizeBentleyExecutiveBridge(
  db: Db,
  ctx: ExecutiveToolContext,
): Promise<BentleyExecutiveBridgeSummary> {
  const out = empty();
  out.content360PlatformConfigured = isContent360PlatformConfiguredFromEnv();

  try {
    const rows = await db
      .select({
        id: bentleyCadenceRuns.id,
        clientId: bentleyCadenceRuns.clientId,
        runType: bentleyCadenceRuns.runType,
        runStatus: bentleyCadenceRuns.runStatus,
        startedAt: bentleyCadenceRuns.startedAt,
      })
      .from(bentleyCadenceRuns)
      .orderBy(desc(bentleyCadenceRuns.startedAt))
      .limit(8);
    out.latestCadenceRuns = rows.map((r) => ({
      id: r.id,
      clientId: (r.clientId ?? "").trim(),
      runType: r.runType,
      runStatus: r.runStatus,
      startedAt: r.startedAt.toISOString(),
    }));
  } catch (e) {
    out.notes.push(`bentley_cadence_runs: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const [row] = await db
      .select({ n: count() })
      .from(campaigns)
      .where(isNotNull(campaigns.bentleyGenerationJson));
    out.campaignsWithBentleyPayloadApprox = Number(row?.n ?? 0);
  } catch (e) {
    out.campaignsWithBentleyPayloadApprox = null;
    out.notes.push(`campaigns bentley payload: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const [row] = await db.select({ n: count() }).from(campaignPosts).where(eq(campaignPosts.status, "SCHEDULED"));
    out.postsScheduledApprox = Number(row?.n ?? 0);
  } catch (e) {
    out.postsScheduledApprox = null;
    out.notes.push(`scheduled posts: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const [row] = await db
      .select({ n: count() })
      .from(campaignPosts)
      .where(
        and(
          isNull(campaignPosts.scheduledAt),
          or(eq(campaignPosts.status, "DRAFT"), eq(campaignPosts.status, "FAILED")),
        ),
      );
    out.postsBlockedOrDraftUnscheduledApprox = Number(row?.n ?? 0);
  } catch (e) {
    out.postsBlockedOrDraftUnscheduledApprox = null;
    out.notes.push(`blocked/draft posts: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const [row] = await db
      .select({ n: count() })
      .from(executiveAgentApprovals)
      .where(and(eq(executiveAgentApprovals.adminUserId, ctx.adminUserId), eq(executiveAgentApprovals.status, "pending")));
    out.pendingExecutiveApprovalsForAdmin = Number(row?.n ?? 0);
  } catch (e) {
    out.pendingExecutiveApprovalsForAdmin = null;
    out.notes.push(`executive approvals: ${e instanceof Error ? e.message : String(e)}`);
  }

  out.unavailable =
    out.latestCadenceRuns.length === 0 &&
    out.campaignsWithBentleyPayloadApprox == null &&
    out.postsScheduledApprox == null &&
    out.postsBlockedOrDraftUnscheduledApprox == null &&
    out.pendingExecutiveApprovalsForAdmin == null;

  return out;
}

/**
 * Optional client-scoped slice (uses existing campaign tables only; no writes).
 */
export async function summarizeBentleyLaunchReadinessForClient(
  db: Db,
  clientId: string,
): Promise<{
  campaignsWithPayload: number | null;
  scheduledPosts: number | null;
  stuckDraftOrFailed: number | null;
  notes: string[];
}> {
  const cid = clientId.trim();
  const notes: string[] = [];
  if (!cid) {
    return { campaignsWithPayload: null, scheduledPosts: null, stuckDraftOrFailed: null, notes: ["missing_client_id"] };
  }

  let campaignsWithPayload: number | null = null;
  let scheduledPosts: number | null = null;
  let stuckDraftOrFailed: number | null = null;

  try {
    const [row] = await db
      .select({ n: count() })
      .from(campaigns)
      .where(and(eq(campaigns.clientId, cid), isNotNull(campaigns.bentleyGenerationJson)));
    campaignsWithPayload = Number(row?.n ?? 0);
  } catch (e) {
    notes.push(`client campaigns: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const [row] = await db
      .select({ n: count() })
      .from(campaignPosts)
      .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
      .where(and(eq(campaigns.clientId, cid), eq(campaignPosts.status, "SCHEDULED")));
    scheduledPosts = Number(row?.n ?? 0);
  } catch (e) {
    notes.push(`client scheduled: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const [row] = await db
      .select({ n: count() })
      .from(campaignPosts)
      .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.clientId, cid),
          isNull(campaignPosts.scheduledAt),
          or(eq(campaignPosts.status, "DRAFT"), eq(campaignPosts.status, "FAILED")),
        ),
      );
    stuckDraftOrFailed = Number(row?.n ?? 0);
  } catch (e) {
    notes.push(`client stuck posts: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { campaignsWithPayload, scheduledPosts, stuckDraftOrFailed, notes };
}
