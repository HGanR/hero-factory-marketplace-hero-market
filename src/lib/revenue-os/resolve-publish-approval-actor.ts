/**
 * Resolve the acting user for publish approval PATCH actions (conservative; expandable).
 */

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import type { CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import type { RevenueOsApprovalActorRole } from "@/lib/revenue-os/publish-approval-governance-types";

function governanceActorRoleFromCampaignReviewer(r: CampaignReviewerRole): RevenueOsApprovalActorRole {
  switch (r) {
    case "owner":
      return "operator";
    case "approver":
      return "publisher";
    case "editor":
      return "operator";
    case "reviewer":
      return "reviewer";
  }
}

export type ResolvedPublishApprovalActor = {
  /** Authenticated marketplace user id, or null (session-only / anonymous). */
  userId: number | null;
  /** Display label stored on the post (username, email, or fallback). */
  label: string;
  role: RevenueOsApprovalActorRole;
  /** True when we have a real authenticated user id to persist. */
  identityBacked: boolean;
  /**
   * External client review surface: write `bentley_approved_by` + actor role from `label` without user id
   * (see `applyIdentity` in publish-approval-governance-merge).
   */
  useLabelOnlyGovernance?: boolean;
};

function parseOwnerNumericId(campaignOwnerUserId: string | null | undefined): number | null {
  if (campaignOwnerUserId == null || !String(campaignOwnerUserId).trim()) return null;
  const n = Number(String(campaignOwnerUserId).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * @param campaignOwnerUserId — `campaigns.userId` for the post’s campaign (varchar numeric string).
 * @param campaignReviewerRole — normalized assignment role when resolving a campaign-scoped approval write.
 */
export async function resolvePublishApprovalActor(args: {
  campaignOwnerUserId?: string | null;
  campaignReviewerRole?: CampaignReviewerRole;
}): Promise<ResolvedPublishApprovalActor> {
  const uid = await getAuthedUserId();
  const cookieStore = await cookies();
  const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());

  if (uid == null) {
    return {
      userId: null,
      label: "local_session",
      role: "operator",
      identityBacked: false,
    };
  }

  let label = `User #${uid}`;
  try {
    const db = await getDb();
    const rows = await db
      .select({ email: marketplaceUsers.email, username: marketplaceUsers.username })
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.id, uid))
      .limit(1);
    const u = rows[0];
    if (u?.username?.trim()) label = u.username.trim().slice(0, 200);
    else if (u?.email?.trim()) label = u.email.trim().slice(0, 200);
  } catch {
    /* keep fallback label */
  }

  const ownerN = parseOwnerNumericId(args.campaignOwnerUserId);
  let role: RevenueOsApprovalActorRole = "operator";
  if (adminSession) {
    role = "admin";
  } else if (ownerN != null && ownerN === uid) {
    role = "owner";
  } else if (args.campaignReviewerRole != null) {
    role = governanceActorRoleFromCampaignReviewer(args.campaignReviewerRole);
  }

  return {
    userId: uid,
    label: label.slice(0, 200),
    role,
    identityBacked: true,
  };
}
