/**
 * Shared parsing + response mapping for campaign reviewer assignment HTTP API.
 * Routes stay thin; audit hooks can wrap these later without rewriting handlers.
 */

import type { campaignReviewerAssignments } from "@/lib/db/schema";
import type { AssignableCampaignReviewerRole, CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import {
  normalizeReviewerRole,
  parseAssignableCampaignReviewerRoleFromRequest,
} from "@/lib/revenue-os/campaign-reviewer-role";

export type ReviewerAssignmentApiItem = {
  id: string;
  campaignId: string;
  userId: number;
  role: CampaignReviewerRole;
  createdAt: string;
  updatedAt: string;
};

export function timestampFieldToIso(v: Date | string | null | undefined): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t).toISOString();
    return v;
  }
  return "";
}

export function mapAssignmentRowToApiItem(
  row: typeof campaignReviewerAssignments.$inferSelect,
  campaignId: string
): ReviewerAssignmentApiItem {
  const uid = Number(String(row.userId).trim());
  const userIdOut = Number.isFinite(uid) ? uid : 0;
  return {
    id: row.id,
    campaignId,
    userId: userIdOut,
    role: normalizeReviewerRole(row.role),
    createdAt: timestampFieldToIso(row.createdAt),
    updatedAt: timestampFieldToIso(row.updatedAt),
  };
}

export type ParsedAssignmentBody =
  | { ok: true; userId: number; role: AssignableCampaignReviewerRole }
  | { ok: false; message: string };

/**
 * POST body: userId required (positive int); role required non-empty, assignable after normalization pipeline.
 * Inbound roles are validated strictly, then stored as `normalizeReviewerRole(assignable)` for canonical DB values.
 */
export function parseReviewerAssignmentPostBody(body: unknown): ParsedAssignmentBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const o = body as Record<string, unknown>;

  if (o.userId === undefined || o.userId === null) {
    return { ok: false, message: "userId is required." };
  }

  let uid: number;
  if (typeof o.userId === "number" && Number.isFinite(o.userId)) {
    uid = Math.trunc(o.userId);
  } else if (typeof o.userId === "string") {
    const t = o.userId.trim();
    if (!t) return { ok: false, message: "userId cannot be empty." };
    if (!/^\d+$/.test(t)) return { ok: false, message: "userId must be a positive marketplace user id." };
    uid = parseInt(t, 10);
  } else {
    return { ok: false, message: "userId must be a positive marketplace user id." };
  }
  if (uid <= 0) return { ok: false, message: "userId must be a positive marketplace user id." };

  const roleRaw = typeof o.role === "string" ? o.role : "";
  if (!roleRaw.trim()) {
    return { ok: false, message: "role is required." };
  }

  const assignable = parseAssignableCampaignReviewerRoleFromRequest(roleRaw);
  if (!assignable) {
    return {
      ok: false,
      message: "role must be editor, reviewer, or approver (owner is implicit on the campaign).",
    };
  }

  const canonical = normalizeReviewerRole(assignable) as AssignableCampaignReviewerRole;
  return { ok: true, userId: uid, role: canonical };
}

export type ParsedPatchRoleBody = { ok: true; role: AssignableCampaignReviewerRole } | { ok: false; message: string };

export function parseReviewerAssignmentPatchBody(body: unknown): ParsedPatchRoleBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const roleRaw = (body as { role?: unknown }).role;
  const s = typeof roleRaw === "string" ? roleRaw : "";
  if (!s.trim()) {
    return { ok: false, message: "role is required." };
  }
  const assignable = parseAssignableCampaignReviewerRoleFromRequest(s);
  if (!assignable) {
    return {
      ok: false,
      message: "role must be editor, reviewer, or approver (owner is implicit on the campaign).",
    };
  }
  const canonical = normalizeReviewerRole(assignable) as AssignableCampaignReviewerRole;
  return { ok: true, role: canonical };
}

export function invalidReviewerAssignmentResponse(message: string) {
  return {
    error: "INVALID_REVIEWER_ASSIGNMENT" as const,
    message,
  };
}

export function duplicateReviewerAssignmentResponse() {
  return {
    error: "DUPLICATE_REVIEWER_ASSIGNMENT" as const,
    message: "This user is already assigned to the campaign.",
  };
}
