import type { RevenueOsKpiSnapshotDto } from "@/lib/fulfillment/revenue-os-fulfillment-dtos";

export type CampaignPostStatusCounts = {
  draft: number;
  scheduled: number;
  published: number;
  failed: number;
};

export function countPostsByStatus(
  posts: Array<{ status: string }>
): CampaignPostStatusCounts {
  const out: CampaignPostStatusCounts = { draft: 0, scheduled: 0, published: 0, failed: 0 };
  for (const p of posts) {
    const s = p.status.toUpperCase();
    if (s === "DRAFT") out.draft += 1;
    else if (s === "SCHEDULED") out.scheduled += 1;
    else if (s === "PUBLISHED" || s === "POSTED") out.published += 1;
    else if (s === "FAILED") out.failed += 1;
  }
  return out;
}

export function assessKpiHealth(input: {
  campaignStatus: string | null;
  postCounts: CampaignPostStatusCounts;
  hasBentleyPayload: boolean;
  launchReadinessApproved: boolean;
}): RevenueOsKpiSnapshotDto["kpiHealth"] {
  if (!input.hasBentleyPayload && !input.campaignStatus) return "unknown";
  if (input.postCounts.failed > 0 && input.postCounts.published === 0) return "at_risk";
  if (input.postCounts.scheduled > 0 && !input.launchReadinessApproved) return "watch";
  if (input.postCounts.published > 0) return "healthy";
  if (input.hasBentleyPayload && input.postCounts.draft > 0) return "watch";
  return "unknown";
}

export function buildPostLaunchOperationalNotes(input: {
  postCounts: CampaignPostStatusCounts;
  campaignStatus: string | null;
  daysSinceUpdate: number | null;
}): string[] {
  const notes: string[] = [];
  if (input.postCounts.published > 0) {
    notes.push(
      `Post-launch: ${input.postCounts.published} published post(s) — monitor performance in platform analytics (read-only).`
    );
  }
  if (input.postCounts.failed > 0) {
    notes.push(`${input.postCounts.failed} post(s) in FAILED — human triage required; no autonomous retry.`);
  }
  if (input.campaignStatus?.toUpperCase() === "ACTIVE" && input.postCounts.scheduled === 0 && input.postCounts.draft > 0) {
    notes.push("Campaign ACTIVE with draft posts only — launch execution still requires owner approval outside fulfillment.");
  }
  if (input.daysSinceUpdate != null && input.daysSinceUpdate >= 14 && input.postCounts.published === 0) {
    notes.push("No published posts in 14+ days since campaign update — possible stall.");
  }
  return notes;
}

export function buildRevenueOsKpiSnapshot(input: {
  campaignStatus: string | null;
  posts: Array<{ status: string }>;
  hasBentleyPayload: boolean;
  launchReadinessApproved: boolean;
  daysSinceUpdate: number | null;
}): RevenueOsKpiSnapshotDto {
  const postCounts = countPostsByStatus(input.posts);
  const kpiHealth = assessKpiHealth({
    campaignStatus: input.campaignStatus,
    postCounts,
    hasBentleyPayload: input.hasBentleyPayload,
    launchReadinessApproved: input.launchReadinessApproved,
  });
  return {
    campaignStatus: input.campaignStatus,
    postCounts,
    kpiHealth,
    postLaunchNotes: buildPostLaunchOperationalNotes({
      postCounts,
      campaignStatus: input.campaignStatus,
      daysSinceUpdate: input.daysSinceUpdate,
    }),
  };
}
