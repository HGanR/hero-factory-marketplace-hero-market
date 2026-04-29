/**
 * Audit + lightweight in-app notifications for campaign reviewer assignment changes.
 * Publish-approval audit (`campaign_audit_events`) is untouched.
 */

import crypto from "crypto";
import { bentleyNotificationEvents, campaignReviewerAssignmentAuditEvents } from "@/lib/db/schema";
import { normalizeReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ReviewerAssignmentAuditAction =
  | "reviewer_added"
  | "reviewer_role_changed"
  | "reviewer_removed";

export const CAMPAIGN_REVIEWER_NOTIFICATION_EVENT_TYPES = {
  added: "campaign_reviewer_added",
  roleChanged: "campaign_reviewer_role_changed",
  removed: "campaign_reviewer_removed",
} as const;

/** `sourceType` on `bentley_notification_events` — assignment notifications (not publish approval). */
export const CAMPAIGN_REVIEWER_NOTIFICATION_SOURCE_TYPE = "campaign_reviewer_assignment" as const;

/** Default and bounds for GET /api/campaigns/[id]/reviewer-audit */
export const REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT = 10;
export const REVIEWER_ASSIGNMENT_AUDIT_LIMIT_MIN = 1;
export const REVIEWER_ASSIGNMENT_AUDIT_LIMIT_MAX = 25;

export function parseReviewerAssignmentAuditLimit(raw: string | null): number {
  if (raw == null || raw === "") return REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT;
  return Math.min(
    REVIEWER_ASSIGNMENT_AUDIT_LIMIT_MAX,
    Math.max(REVIEWER_ASSIGNMENT_AUDIT_LIMIT_MIN, n)
  );
}

export function buildReviewerAddedBody(campaignName: string, role: string): string {
  const r = normalizeReviewerRole(role);
  const name = campaignName.slice(0, 200);
  const article = /^[aeiou]/i.test(r) ? "an" : "a";
  return `You were added as ${article} ${r} to campaign "${name}".`;
}

export function buildReviewerRoleChangedBody(campaignName: string, nextRole: string): string {
  const n = normalizeReviewerRole(nextRole);
  const name = campaignName.slice(0, 200);
  return `Your reviewer role for campaign "${name}" was changed to ${n}.`;
}

export function buildReviewerRemovedBody(campaignName: string, previousRole: string): string {
  const p = normalizeReviewerRole(previousRole);
  const name = campaignName.slice(0, 200);
  return `You were removed as a ${p} from campaign "${name}".`;
}

export async function createReviewerAssignmentAuditEvent(
  db: Db,
  args: {
    campaignId: string;
    action: ReviewerAssignmentAuditAction;
    targetUserId: number;
    actorUserId: number;
    previousRole: string | null;
    nextRole: string | null;
  }
): Promise<void> {
  const previousRole =
    args.previousRole == null || args.previousRole === ""
      ? null
      : normalizeReviewerRole(args.previousRole);
  const nextRole =
    args.nextRole == null || args.nextRole === "" ? null : normalizeReviewerRole(args.nextRole);

  await db.insert(campaignReviewerAssignmentAuditEvents).values({
    id: crypto.randomUUID(),
    campaignId: args.campaignId,
    action: args.action,
    targetUserId: String(args.targetUserId),
    actorUserId: String(args.actorUserId),
    previousRole,
    nextRole,
  });
}

export async function createCampaignReviewerNotificationEvent(
  db: Db,
  args: {
    targetUserId: number;
    clientId: string;
    eventType: string;
    title: string;
    body: string;
    campaignId: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(bentleyNotificationEvents).values({
    id: crypto.randomUUID(),
    userId: String(args.targetUserId),
    clientId: args.clientId,
    trustId: "",
    sourceType: CAMPAIGN_REVIEWER_NOTIFICATION_SOURCE_TYPE,
    eventType: args.eventType,
    severity: "info",
    title: args.title.slice(0, 512),
    body: args.body,
    eventPayloadJson: { campaignId: args.campaignId, ...(args.payload ?? {}) },
  });
}

export async function recordReviewerAddedAuditAndNotify(
  db: Db,
  args: {
    campaignId: string;
    campaignName: string;
    clientId: string;
    targetUserId: number;
    actorUserId: number;
    role: string;
  }
): Promise<void> {
  const nextRole = normalizeReviewerRole(args.role);
  await createReviewerAssignmentAuditEvent(db, {
    campaignId: args.campaignId,
    action: "reviewer_added",
    targetUserId: args.targetUserId,
    actorUserId: args.actorUserId,
    previousRole: null,
    nextRole: args.role,
  });
  await createCampaignReviewerNotificationEvent(db, {
    targetUserId: args.targetUserId,
    clientId: args.clientId,
    eventType: CAMPAIGN_REVIEWER_NOTIFICATION_EVENT_TYPES.added,
    title: "Campaign reviewer access",
    body: buildReviewerAddedBody(args.campaignName, args.role),
    campaignId: args.campaignId,
    payload: { role: nextRole },
  });
}

export async function recordReviewerRoleChangedAuditAndNotify(
  db: Db,
  args: {
    campaignId: string;
    campaignName: string;
    clientId: string;
    targetUserId: number;
    actorUserId: number;
    previousRole: string;
    nextRole: string;
  }
): Promise<void> {
  const prevN = normalizeReviewerRole(args.previousRole);
  const nextN = normalizeReviewerRole(args.nextRole);
  await createReviewerAssignmentAuditEvent(db, {
    campaignId: args.campaignId,
    action: "reviewer_role_changed",
    targetUserId: args.targetUserId,
    actorUserId: args.actorUserId,
    previousRole: args.previousRole,
    nextRole: args.nextRole,
  });
  await createCampaignReviewerNotificationEvent(db, {
    targetUserId: args.targetUserId,
    clientId: args.clientId,
    eventType: CAMPAIGN_REVIEWER_NOTIFICATION_EVENT_TYPES.roleChanged,
    title: "Campaign reviewer role updated",
    body: buildReviewerRoleChangedBody(args.campaignName, args.nextRole),
    campaignId: args.campaignId,
    payload: { previousRole: prevN, nextRole: nextN },
  });
}

export async function recordReviewerRemovedAuditAndNotify(
  db: Db,
  args: {
    campaignId: string;
    campaignName: string;
    clientId: string;
    targetUserId: number;
    actorUserId: number;
    previousRole: string;
  }
): Promise<void> {
  const prevN = normalizeReviewerRole(args.previousRole);
  await createReviewerAssignmentAuditEvent(db, {
    campaignId: args.campaignId,
    action: "reviewer_removed",
    targetUserId: args.targetUserId,
    actorUserId: args.actorUserId,
    previousRole: args.previousRole,
    nextRole: null,
  });
  await createCampaignReviewerNotificationEvent(db, {
    targetUserId: args.targetUserId,
    clientId: args.clientId,
    eventType: CAMPAIGN_REVIEWER_NOTIFICATION_EVENT_TYPES.removed,
    title: "Campaign reviewer access removed",
    body: buildReviewerRemovedBody(args.campaignName, args.previousRole),
    campaignId: args.campaignId,
    payload: { previousRole: prevN },
  });
}

/** Non-fatal: assignment CRUD already succeeded. */
export async function safeReviewerAssignmentFollowUp(
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[campaign-reviewer-assignment-follow-up ${label}]`, e);
  }
}

export function mapReviewerAssignmentAuditRowToApiItem(
  row: typeof campaignReviewerAssignmentAuditEvents.$inferSelect
) {
  const tid = Number(String(row.targetUserId).trim());
  const aid = Number(String(row.actorUserId).trim());
  return {
    id: row.id,
    campaignId: row.campaignId,
    action: row.action,
    targetUserId: Number.isFinite(tid) ? tid : 0,
    actorUserId: Number.isFinite(aid) ? aid : 0,
    previousRole: row.previousRole,
    nextRole: row.nextRole,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
  };
}

/** @deprecated Use mapReviewerAssignmentAuditRowToApiItem */
export const serializeReviewerAssignmentAuditRow = mapReviewerAssignmentAuditRowToApiItem;
