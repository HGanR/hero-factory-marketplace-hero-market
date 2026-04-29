/**
 * Normalized campaign reviewer roles for publish approval (assignment + enforcement).
 */

import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";

export type CampaignReviewerRole = "owner" | "editor" | "reviewer" | "approver";

/** Roles that may be stored in `campaign_reviewer_assignments` (never `owner` — owner is implicit on the campaign). */
export type AssignableCampaignReviewerRole = Exclude<CampaignReviewerRole, "owner">;

/**
 * Strict parse for assignment API: only editor / reviewer / approver (plus common aliases).
 * Unknown input → null (caller returns 400).
 */
export function parseAssignableCampaignReviewerRoleFromRequest(
  input: string | null | undefined
): AssignableCampaignReviewerRole | null {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "editor" || s === "reviewer" || s === "approver") return s;
  if (s === "publisher" || s === "admin" || s === "delegate") return "approver";
  if (s === "operator") return "editor";
  return null;
}

/** Maps stored / legacy strings to the canonical enum; unknown → reviewer (restrictive). */
export function normalizeReviewerRole(input: string | null | undefined): CampaignReviewerRole {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!s) return "reviewer";
  const aliases: Record<string, CampaignReviewerRole> = {
    owner: "owner",
    editor: "editor",
    reviewer: "reviewer",
    approver: "approver",
    admin: "approver",
    publisher: "approver",
    operator: "editor",
    delegate: "approver",
    read_only: "reviewer",
    readonly: "reviewer",
    viewer: "reviewer",
  };
  return aliases[s] ?? "reviewer";
}

export type FinalizeApprovalOpts = { adminSession?: boolean };

/** Whether the user may PATCH publish approval fields (approve / reject / clear / metadata). */
export function userCanFinalizePublishApproval(
  role: CampaignReviewerRole,
  opts?: FinalizeApprovalOpts
): boolean {
  if (opts?.adminSession) return true;
  if (role === "reviewer") return false;
  return true;
}

/**
 * Strict match for the active chain step (admin bypass). Reviewers never finalize.
 */
export function userCanActOnApprovalChainStep(
  viewerRole: CampaignReviewerRole,
  requiredRole: PublishApprovalChainRequiredRole,
  opts?: FinalizeApprovalOpts
): boolean {
  if (!userCanFinalizePublishApproval(viewerRole, opts)) return false;
  if (opts?.adminSession) return true;
  return viewerRole === requiredRole;
}

/** Map legacy audit / UTM actor roles to normalized reviewer role for display. */
export function mapLegacyActorRoleToReviewerRole(actorRole: string | null | undefined): CampaignReviewerRole {
  const s = String(actorRole ?? "")
    .trim()
    .toLowerCase();
  if (s === "owner") return "owner";
  if (s === "admin") return "approver";
  if (s === "publisher") return "approver";
  if (s === "operator") return "editor";
  if (s === "reviewer") return "reviewer";
  return "reviewer";
}
