/**
 * Union of owned campaigns and assignment-based access for GET /api/campaigns.
 */

import type { CampaignRow } from "@/lib/db/schema";
import type { CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import {
  normalizeReviewerRole,
  userCanFinalizePublishApproval,
} from "@/lib/revenue-os/campaign-reviewer-role";

export type CampaignListAccessSource = "owner" | "assignment";

/** One row after merging owner list + assignment join (before finalize flags). */
export type MergedAccessibleCampaign = {
  campaign: CampaignRow;
  viewerCampaignReviewerRole: CampaignReviewerRole;
  accessSource: CampaignListAccessSource;
};

function campaignCreatedAtMs(c: CampaignRow): number {
  const t = c.createdAt;
  if (t instanceof Date) return t.getTime();
  if (typeof t === "string") return Date.parse(t);
  return 0;
}

/**
 * Owner rows win over assignment for the same campaign id (no duplicate list entries).
 * Sort: newest `createdAt` first (matches legacy owner-only list ordering intent).
 */
export function mergeOwnedAndAssignedCampaignRows(args: {
  ownedRows: CampaignRow[];
  assignedRows: { campaign: CampaignRow; assignmentRole: string }[];
}): MergedAccessibleCampaign[] {
  const byId = new Map<string, MergedAccessibleCampaign>();

  for (const c of args.ownedRows) {
    byId.set(c.id, {
      campaign: c,
      viewerCampaignReviewerRole: "owner",
      accessSource: "owner",
    });
  }

  for (const { campaign, assignmentRole } of args.assignedRows) {
    if (byId.has(campaign.id)) continue;
    byId.set(campaign.id, {
      campaign,
      viewerCampaignReviewerRole: normalizeReviewerRole(assignmentRole),
      accessSource: "assignment",
    });
  }

  return [...byId.values()].sort(
    (a, b) => campaignCreatedAtMs(b.campaign) - campaignCreatedAtMs(a.campaign)
  );
}

export type CampaignListApiItem = {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  startAt: Date | string | null;
  endAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  viewerCampaignReviewerRole: CampaignReviewerRole;
  viewerMayFinalizePublishApproval: boolean;
  accessSource: CampaignListAccessSource;
};

export function mapMergedCampaignToListApiItem(
  m: MergedAccessibleCampaign,
  opts: { adminSession: boolean }
): CampaignListApiItem {
  const c = m.campaign;
  return {
    id: c.id,
    name: c.name,
    objective: c.objective ?? null,
    status: c.status,
    startAt: c.startAt ?? null,
    endAt: c.endAt ?? null,
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
    viewerCampaignReviewerRole: m.viewerCampaignReviewerRole,
    viewerMayFinalizePublishApproval: userCanFinalizePublishApproval(m.viewerCampaignReviewerRole, {
      adminSession: opts.adminSession,
    }),
    accessSource: m.accessSource,
  };
}
