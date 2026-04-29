/**
 * Server-side counts for autonomy readiness (merged with client workflow in API route).
 */

import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bentleyAutonomousActionAudit,
  bentleyOptimizationRuns,
  campaignPosts,
  campaigns,
  revenueOsDeploymentFeedback,
} from "@/lib/db/schema";

export type BentleyAutonomyServerFacts = {
  campaignCount: number;
  postsForLatestCampaign: number;
  deploymentFeedbackRows: number;
  optimizationRunsCount: number;
  governanceAuditRows: number;
};

export async function fetchBentleyAutonomyServerFacts(input: {
  userId: string;
  clientId: string;
}): Promise<BentleyAutonomyServerFacts> {
  const uid = input.userId.trim();
  const cid = input.clientId.trim();
  const db = await getDb();

  const campScope = cid
    ? and(eq(campaigns.userId, uid), eq(campaigns.clientId, cid))
    : eq(campaigns.userId, uid);

  const [cRes] = await db.select({ n: count() }).from(campaigns).where(campScope);
  const campaignCount = Number(cRes?.n ?? 0);

  const [pRes] = await db
    .select({ n: count() })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(campScope);
  const postsForLatestCampaign = Number(pRes?.n ?? 0);

  const dfScope = cid
    ? and(eq(revenueOsDeploymentFeedback.userId, uid), eq(campaigns.clientId, cid))
    : eq(revenueOsDeploymentFeedback.userId, uid);

  const [dfRes] = await db
    .select({ n: count() })
    .from(revenueOsDeploymentFeedback)
    .innerJoin(campaigns, eq(revenueOsDeploymentFeedback.campaignId, campaigns.id))
    .where(dfScope);
  const deploymentFeedbackRows = Number(dfRes?.n ?? 0);

  const optScope = cid
    ? and(eq(bentleyOptimizationRuns.userId, uid), eq(bentleyOptimizationRuns.clientId, cid))
    : eq(bentleyOptimizationRuns.userId, uid);

  const [optRes] = await db.select({ n: count() }).from(bentleyOptimizationRuns).where(optScope);
  const optimizationRunsCount = Number(optRes?.n ?? 0);

  const auScope = cid
    ? and(eq(bentleyAutonomousActionAudit.userId, uid), eq(bentleyAutonomousActionAudit.clientId, cid))
    : eq(bentleyAutonomousActionAudit.userId, uid);

  const [auRes] = await db.select({ n: count() }).from(bentleyAutonomousActionAudit).where(auScope);
  const governanceAuditRows = Number(auRes?.n ?? 0);

  return {
    campaignCount,
    postsForLatestCampaign,
    deploymentFeedbackRows,
    optimizationRunsCount,
    governanceAuditRows,
  };
}
