/**
 * Scan campaign posts for overdue pending approval steps and emit in-app reminders (Part 19).
 */

import { eq } from "drizzle-orm";
import { campaignPosts } from "@/lib/db/schema";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { normalizeReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import {
  isMultiStepPublishApprovalChain,
  parseCampaignPublishApprovalChainJson,
  requiredReviewerRoleForChainStep,
  type PublishApprovalChainRequiredRole,
} from "@/lib/revenue-os/publish-approval-chain";
import { createPublishApprovalStepSlaOverdueNotifications } from "@/lib/revenue-os/publish-approval-notification";
import {
  computePendingStepAgeMs,
  getPublishApprovalStepSlaPolicy,
  resolveLogicalAwaitingStepIndex,
  shouldEmitSlaReminderForPendingStep,
} from "@/lib/revenue-os/publish-approval-step-sla";
import {
  BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP,
  parsePublishApprovalFromUtm,
} from "@/lib/revenue-os/publish-approval-utm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Shared by per-campaign SLA scan and batch campaign selection (same string coercion as workflow). */
export function utmParamsToStringRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  return Object.fromEntries(
    Object.entries(utmParams as Record<string, unknown>).map(([k, v]) => [k, String(v)])
  );
}

function collectSlaReminderRecipients(args: {
  ownerUserIdNum: number;
  requiredRole: PublishApprovalChainRequiredRole | null;
  assignmentRows: { userId: string; role: string }[];
}): number[] {
  const out = new Set<number>();
  if (Number.isFinite(args.ownerUserIdNum) && args.ownerUserIdNum > 0) {
    out.add(args.ownerUserIdNum);
  }
  if (args.requiredRole && args.requiredRole !== "owner") {
    for (const a of args.assignmentRows) {
      if (normalizeReviewerRole(a.role) === args.requiredRole) {
        const n = Number(String(a.userId).trim());
        if (Number.isFinite(n) && n > 0) out.add(n);
      }
    }
  }
  return [...out];
}

export async function runCampaignPublishApprovalSlaScan(
  db: Db,
  args: {
    campaignId: string;
    campaignName: string;
    clientId: string;
    ownerUserId: string;
    publishApprovalChainJson: unknown;
    posts: { id: string; utmParams: unknown }[];
    workerRequiresApproval: boolean;
    assignmentRows: { userId: string; role: string }[];
    now?: Date;
  }
): Promise<{ checked: number; remindersSent: number }> {
  const nowMs = (args.now ?? new Date()).getTime();
  const chain = parseCampaignPublishApprovalChainJson(args.publishApprovalChainJson);
  const policy = getPublishApprovalStepSlaPolicy();
  const ownerNum = Number(String(args.ownerUserId).trim());
  let remindersSent = 0;

  for (const post of args.posts) {
    const utmRec = utmParamsToStringRecord(post.utmParams);
    const parsed = parsePublishApprovalFromUtm(utmRec);
    const effective = resolveEffectiveApprovalStatus(args.workerRequiresApproval, utmRec);
    const logicalStep = resolveLogicalAwaitingStepIndex({ publishApprovalChain: chain, parsed });

    const requiredRole: PublishApprovalChainRequiredRole | null =
      chain && isMultiStepPublishApprovalChain(chain)
        ? requiredReviewerRoleForChainStep(chain, logicalStep)
        : null;

    if (
      !shouldEmitSlaReminderForPendingStep({
        effectiveApprovalStatus: effective,
        nowMs,
        stepStartedAtIso: parsed.approvalStepStartedAt,
        slaReminderSentForLogicalStep: parsed.slaReminderSentForLogicalStep,
        logicalAwaitingStepIndex: logicalStep,
        policy,
      })
    ) {
      continue;
    }

    const ageMs = computePendingStepAgeMs({ nowMs, stepStartedAtIso: parsed.approvalStepStartedAt });
    const ageHoursApprox = ageMs != null ? Math.max(1, Math.round(ageMs / 3600000)) : policy.overdueAfterMs / 3600000;

    const recipients = collectSlaReminderRecipients({
      ownerUserIdNum: ownerNum,
      requiredRole,
      assignmentRows: args.assignmentRows,
    });
    if (recipients.length === 0) {
      continue;
    }

    await createPublishApprovalStepSlaOverdueNotifications(db, {
      recipientUserIds: recipients,
      clientId: args.clientId,
      campaignId: args.campaignId,
      campaignName: args.campaignName,
      postId: post.id,
      logicalStepIndex: logicalStep,
      requiredRole,
      ageHoursApprox,
    });

    const nextUtm = {
      ...utmRec,
      [BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP]: String(logicalStep),
    };

    await db
      .update(campaignPosts)
      .set({ utmParams: nextUtm, updatedAt: new Date() })
      .where(eq(campaignPosts.id, post.id));

    remindersSent += 1;
  }

  return { checked: args.posts.length, remindersSent };
}
