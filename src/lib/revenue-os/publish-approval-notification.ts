/**
 * In-app notification rows for campaign publish-approval events (owner visibility).
 */

import { randomUUID } from "node:crypto";
import { bentleyNotificationEvents } from "@/lib/db/schema";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";

export const CAMPAIGN_PUBLISH_APPROVAL_SOURCE_TYPE = "campaign_publish_approval" as const;

export const PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES = {
  approved: "campaign_post_publish_approved",
  rejected: "campaign_post_publish_rejected",
  chainAdvanced: "campaign_post_publish_chain_advanced",
  slaOverdue: "campaign_post_publish_approval_sla_overdue",
} as const;

export function shouldNotifyCampaignOwnerForPublishApproval(args: {
  ownerUserId: number;
  actorUserId: number | null;
  externalClientReview?: boolean;
}): boolean {
  if (args.externalClientReview) return true;
  if (args.actorUserId == null) return false;
  return args.actorUserId !== args.ownerUserId;
}

export function buildPublishApprovalNotificationBody(args: {
  actorLabel: string;
  postId: string;
  campaignName: string;
  decision: "approved" | "rejected";
  reason?: string | null;
}): string {
  const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  if (args.decision === "approved") {
    return `${args.actorLabel} approved post ${args.postId} in campaign ${q(args.campaignName)}.`;
  }
  const base = `${args.actorLabel} rejected post ${args.postId} in campaign ${q(args.campaignName)}.`;
  const r = args.reason?.trim();
  return r ? `${base} Reason: ${r}` : base;
}

type DbLike = {
  insert: (table: unknown) => { values: (v: Record<string, unknown>) => Promise<unknown> };
};

export async function createCampaignPublishApprovalNotificationEvent(
  db: DbLike,
  args: {
    ownerUserId: number;
    clientId: string;
    campaignId: string;
    campaignName: string;
    postId: string;
    decision: "approved" | "rejected";
    actor: ResolvedPublishApprovalActor;
    reason?: string | null;
  }
): Promise<void> {
  if (!shouldNotifyCampaignOwnerForPublishApproval({ ownerUserId: args.ownerUserId, actorUserId: args.actor.userId })) {
    return;
  }
  const eventType =
    args.decision === "approved"
      ? PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES.approved
      : PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES.rejected;
  const body = buildPublishApprovalNotificationBody({
    actorLabel: args.actor.label,
    postId: args.postId,
    campaignName: args.campaignName,
    decision: args.decision,
    reason: args.reason,
  });
  await db.insert(bentleyNotificationEvents).values({
    id: randomUUID(),
    userId: String(args.ownerUserId),
    clientId: args.clientId,
    trustId: "",
    sourceType: CAMPAIGN_PUBLISH_APPROVAL_SOURCE_TYPE,
    eventType,
    severity: args.decision === "rejected" ? "warning" : "info",
    title: "Publish approval",
    body,
    eventPayloadJson: {
      campaignId: args.campaignId,
      postId: args.postId,
      decision: args.decision,
      actorUserId: args.actor.userId,
      actorLabel: args.actor.label,
    },
    dedupeKey: null,
  });
}

export async function createCampaignPublishApprovalChainAdvancedNotificationEvent(
  db: DbLike,
  args: {
    ownerUserId: number;
    clientId: string;
    campaignId: string;
    campaignName: string;
    postId: string;
    actor: ResolvedPublishApprovalActor;
    completedStepIndex: number;
    totalSteps: number;
    nextAwaitingStepIndex: number;
    nextRequiredRole: string;
  }
): Promise<void> {
  if (!shouldNotifyCampaignOwnerForPublishApproval({ ownerUserId: args.ownerUserId, actorUserId: args.actor.userId })) {
    return;
  }
  const body = `${args.actor.label} advanced publish approval for post ${args.postId} in "${args.campaignName}" (step ${args.completedStepIndex + 1} of ${args.totalSteps}). Next: ${args.nextRequiredRole} (step ${args.nextAwaitingStepIndex + 1}).`;
  await db.insert(bentleyNotificationEvents).values({
    id: randomUUID(),
    userId: String(args.ownerUserId),
    clientId: args.clientId,
    trustId: "",
    sourceType: CAMPAIGN_PUBLISH_APPROVAL_SOURCE_TYPE,
    eventType: PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES.chainAdvanced,
    severity: "info",
    title: "Publish approval — multi-step",
    body,
    eventPayloadJson: {
      campaignId: args.campaignId,
      postId: args.postId,
      completedStepIndex: args.completedStepIndex,
      totalSteps: args.totalSteps,
      nextAwaitingStepIndex: args.nextAwaitingStepIndex,
      nextRequiredRole: args.nextRequiredRole,
    },
    dedupeKey: null,
  });
}

export function safePublishApprovalNotificationFollowUp(
  _label: string,
  fn: () => Promise<void>
): void {
  void (async () => {
    try {
      await fn();
    } catch {
      /* fire-and-forget; route already persisted approval */
    }
  })();
}

export async function createPublishApprovalStepSlaOverdueNotifications(
  db: DbLike,
  args: {
    recipientUserIds: number[];
    clientId: string;
    campaignId: string;
    campaignName: string;
    postId: string;
    logicalStepIndex: number;
    requiredRole: string | null;
    ageHoursApprox: number;
  }
): Promise<void> {
  const role = args.requiredRole?.trim() || "reviewer";
  for (const uid of args.recipientUserIds) {
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const body = `Publish approval step ${args.logicalStepIndex + 1} for post ${args.postId} in "${args.campaignName}" is overdue (~${args.ageHoursApprox}h). Awaiting: ${role}.`;
    await db.insert(bentleyNotificationEvents).values({
      id: randomUUID(),
      userId: String(uid),
      clientId: args.clientId,
      trustId: "",
      sourceType: CAMPAIGN_PUBLISH_APPROVAL_SOURCE_TYPE,
      eventType: PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES.slaOverdue,
      severity: "warning",
      title: "Publish approval reminder",
      body,
      eventPayloadJson: {
        campaignId: args.campaignId,
        postId: args.postId,
        logicalStepIndex: args.logicalStepIndex,
        requiredRole: args.requiredRole,
      },
      dedupeKey: `sla:${args.campaignId}:${args.postId}:${args.logicalStepIndex}:${uid}`,
    });
  }
}
