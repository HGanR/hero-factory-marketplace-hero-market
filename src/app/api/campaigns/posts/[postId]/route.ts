import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignAuditEvents, campaignPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { userCanFinalizePublishApproval } from "@/lib/revenue-os/campaign-reviewer-role";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { applyCampaignPostPublishApprovalWrite } from "@/lib/revenue-os/apply-campaign-post-publish-approval-write";
import type { PublishApprovalNotifyCtx } from "@/lib/revenue-os/apply-campaign-post-publish-approval-write";
import { resolvePublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import { mergeScheduledPublishMeta, parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import { type PublishApprovalWriteOutcome } from "@/lib/revenue-os/publish-approval-patch-guard";
import {
  createCampaignPublishApprovalChainAdvancedNotificationEvent,
  createCampaignPublishApprovalNotificationEvent,
  safePublishApprovalNotificationFollowUp,
} from "@/lib/revenue-os/publish-approval-notification";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const PatchPostSchema = z.object({
  caption: z.string().optional(),
  hashtags: z.string().optional().nullable(),
  linkUrl: z.string().url().optional().or(z.literal("")).nullable(),
  utmParams: z.record(z.string(), z.string()).optional().nullable(),
  assetId: z.string().min(1).max(36).optional().nullable(),
  /** When set, updates publish scheduling (DRAFT/SCHEDULED). Omit to leave unchanged. */
  scheduledAt: z.string().datetime().optional().nullable(),
  /** Audit only — defaults to manual_schedule for backwards compatibility. */
  scheduledPublishSourceHint: z.enum(["manual_schedule", "bentley_sequence_apply"]).optional(),
  /** Merged into utmParams — publish approval gate (additive). */
  bentleyApprovalStatus: z
    .enum(["not_required", "pending_approval", "approved", "rejected"])
    .optional(),
  bentleyApprovedAt: z.string().datetime().optional().nullable(),
  bentleyApprovedBy: z.string().max(200).optional().nullable(),
  bentleyApprovalReason: z.string().max(500).optional().nullable(),
  /**
   * When approving/rejecting/clearing, client sends the approval row snapshot from last GET
   * so the server can reject stale concurrent edits (`409 STALE_REVIEW`).
   */
  approvalReviewSnapshot: z
    .object({
      expectedApprovalStatus: z.enum([
        "not_required",
        "pending_approval",
        "approved",
        "rejected",
      ]),
      postUpdatedAt: z.string().datetime(),
      expectedApprovalStepIndex: z.number().int().min(0).optional(),
    })
    .optional(),
});

/**
 * PATCH /api/campaigns/posts/:postId
 * Update draft / scheduled post copy (not after publish has started).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchPostSchema.parse(body);

    const db = await getDb();
    const postRows = await db
      .select()
      .from(campaignPosts)
      .where(eq(campaignPosts.id, postId))
      .limit(1);

    if (postRows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = postRows[0];
    if (post.status === "POSTED" || post.status === "POSTING") {
      return NextResponse.json(
        {
          error: "IMMUTABLE",
          message: "This post can no longer be edited (already published or publishing).",
        },
        { status: 400 }
      );
    }

    const access = await getCampaignReviewerAccess(db, userId, post.campaignId);
    if (!access) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const campRow = access.campaign;
    const reviewerRole = access.reviewerRole;

    const schedulePatch =
      parsed.scheduledAt !== undefined
        ? parsed.scheduledAt === null
          ? {
              scheduledAt: null as null,
              status: "DRAFT" as const,
              scheduledPublishMeta: null as null,
            }
          : {
              scheduledAt: new Date(parsed.scheduledAt),
              status: "SCHEDULED" as const,
              scheduledPublishMeta: mergeScheduledPublishMeta(parseScheduledPublishMeta(post.scheduledPublishMeta), {
                scheduledPublishSource:
                  parsed.scheduledPublishSourceHint === "bentley_sequence_apply"
                    ? "bentley_sequence_apply"
                    : "manual_schedule",
              }),
            }
        : {};

    const prevUtm =
      post.utmParams && typeof post.utmParams === "object" && !Array.isArray(post.utmParams)
        ? (Object.fromEntries(
            Object.entries(post.utmParams as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          ) as Record<string, string>)
        : null;

    const hasApprovalPatch =
      parsed.bentleyApprovalStatus != null ||
      parsed.bentleyApprovedAt !== undefined ||
      parsed.bentleyApprovedBy !== undefined ||
      parsed.bentleyApprovalReason !== undefined;

    const touchesApproval =
      parsed.bentleyApprovalStatus != null ||
      parsed.bentleyApprovedAt !== undefined ||
      parsed.bentleyApprovedBy !== undefined ||
      parsed.bentleyApprovalReason !== undefined;

    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());

    if (touchesApproval) {
      if (!userCanFinalizePublishApproval(reviewerRole, { adminSession })) {
        return NextResponse.json(
          {
            error: "FORBIDDEN_APPROVAL",
            message: "You don't have permission to change publish approval for this campaign.",
            approvalDecision: { outcome: "rejected_forbidden" as const },
          },
          { status: 403 }
        );
      }
    }

    let mergedUtm: Record<string, string> | null | undefined = undefined;

    let approvalDecisionOutcome: PublishApprovalWriteOutcome | undefined;
    let publishApprovalNotify: PublishApprovalNotifyCtx | undefined;

    if (parsed.bentleyApprovalStatus != null) {
      const actor = await resolvePublishApprovalActor({
        campaignOwnerUserId: campRow.userId,
        campaignReviewerRole: reviewerRole,
      });
      const applyResult = applyCampaignPostPublishApprovalWrite({
        post,
        campaign: campRow,
        prevUtm,
        bentleyApprovalStatus: parsed.bentleyApprovalStatus,
        bentleyApprovalReason: parsed.bentleyApprovalReason ?? null,
        approvalReviewSnapshot: parsed.approvalReviewSnapshot ?? null,
        actor,
        reviewerRoleForChainGate: reviewerRole,
        adminSession,
        utmParamsPatch: parsed.utmParams ?? null,
      });

      if (applyResult.outcome === "step_blocked") {
        return NextResponse.json(
          {
            error: "APPROVAL_STEP_BLOCKED",
            message: applyResult.message,
            approvalDecision: { outcome: "rejected_step_blocked" as const },
          },
          { status: 403 }
        );
      }

      if (applyResult.outcome === "accepted_idempotent") {
        approvalDecisionOutcome = "accepted_idempotent";
        mergedUtm = undefined;
      } else if (applyResult.outcome === "rejected_stale") {
        return NextResponse.json(
          {
            error: "STALE_REVIEW",
            message:
              applyResult.staleCause === "approval_state_mismatch"
                ? "Approval state changed since this row was loaded. Refresh and try again."
                : "This post was updated since this row was loaded. Refresh and try again.",
            staleCause: applyResult.staleCause,
            approvalDecision: {
              outcome: "rejected_stale" as const,
              staleCause: applyResult.staleCause,
            },
          },
          { status: 409 }
        );
      } else {
        mergedUtm = applyResult.mergedUtm;
        publishApprovalNotify = applyResult.publishApprovalNotify;
        await db.insert(campaignAuditEvents).values({
          id: crypto.randomUUID(),
          userId: String(userId),
          postId,
          action: applyResult.auditAction,
          platform: post.platform,
          details: applyResult.auditDetails,
        });
        approvalDecisionOutcome = "accepted_fresh";
      }
    } else if (hasApprovalPatch) {
      const base = { ...(prevUtm ?? {}), ...(parsed.utmParams ?? {}) };
      if (parsed.bentleyApprovedAt === null) {
        delete base.bentley_approved_at;
      } else if (parsed.bentleyApprovedAt?.trim()) {
        base.bentley_approved_at = parsed.bentleyApprovedAt.trim();
      }
      if (parsed.bentleyApprovedBy === null) {
        delete base.bentley_approved_by;
      } else if (parsed.bentleyApprovedBy?.trim()) {
        base.bentley_approved_by = parsed.bentleyApprovedBy.trim().slice(0, 200);
      }
      if (parsed.bentleyApprovalReason === null) {
        delete base.bentley_approval_reason;
      } else if (parsed.bentleyApprovalReason?.trim()) {
        base.bentley_approval_reason = parsed.bentleyApprovalReason.trim().slice(0, 500);
      }
      mergedUtm = base;
    } else if (parsed.utmParams !== undefined) {
      mergedUtm = parsed.utmParams ?? null;
    }

    if (approvalDecisionOutcome === "accepted_idempotent") {
      return NextResponse.json({
        ok: true,
        id: postId,
        approvalDecision: { outcome: "accepted_idempotent" as const },
      });
    }

    await db
      .update(campaignPosts)
      .set({
        ...(parsed.caption !== undefined ? { caption: parsed.caption } : {}),
        ...(parsed.hashtags !== undefined
          ? { hashtags: parsed.hashtags?.trim() || null }
          : {}),
        ...(parsed.linkUrl !== undefined ? { linkUrl: parsed.linkUrl?.trim() || null } : {}),
        ...(mergedUtm !== undefined ? { utmParams: mergedUtm } : {}),
        ...(parsed.assetId !== undefined ? { assetId: parsed.assetId } : {}),
        ...schedulePatch,
        updatedAt: new Date(),
      })
      .where(eq(campaignPosts.id, postId));

    const notifyCtx = publishApprovalNotify;
    if (
      approvalDecisionOutcome === "accepted_fresh" &&
      notifyCtx &&
      mergedUtm &&
      typeof mergedUtm === "object"
    ) {
      const ownerNum = Number(String(campRow.userId).trim());
      if (Number.isFinite(ownerNum) && ownerNum > 0) {
        if (notifyCtx.kind === "chain_advanced") {
          void safePublishApprovalNotificationFollowUp("post-patch-chain-advanced", async () => {
            await createCampaignPublishApprovalChainAdvancedNotificationEvent(db, {
              ownerUserId: ownerNum,
              clientId: campRow.clientId ?? "",
              campaignId: post.campaignId,
              campaignName: campRow.name ?? "",
              postId,
              actor: notifyCtx.actor,
              completedStepIndex: notifyCtx.completedStepIndex,
              totalSteps: notifyCtx.totalSteps,
              nextAwaitingStepIndex: notifyCtx.nextAwaitingStepIndex,
              nextRequiredRole: notifyCtx.nextRequiredRole,
            });
          });
        } else {
          const reason =
            notifyCtx.decision === "rejected"
              ? mergedUtm["bentley_approval_reason"] ?? parsed.bentleyApprovalReason ?? null
              : null;
          void safePublishApprovalNotificationFollowUp("post-patch-approval", async () => {
            await createCampaignPublishApprovalNotificationEvent(db, {
              ownerUserId: ownerNum,
              clientId: campRow.clientId ?? "",
              campaignId: post.campaignId,
              campaignName: campRow.name ?? "",
              postId,
              decision: notifyCtx.decision,
              actor: notifyCtx.actor,
              reason,
            });
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      id: postId,
      ...(approvalDecisionOutcome
        ? { approvalDecision: { outcome: approvalDecisionOutcome } }
        : {}),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[campaigns/posts PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
