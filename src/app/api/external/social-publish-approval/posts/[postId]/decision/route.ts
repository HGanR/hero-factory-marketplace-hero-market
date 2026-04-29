import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { campaignAuditEvents, campaignPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { applyCampaignPostPublishApprovalWrite } from "@/lib/revenue-os/apply-campaign-post-publish-approval-write";
import type { CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import {
  createCampaignPublishApprovalChainAdvancedNotificationEvent,
  createCampaignPublishApprovalNotificationEvent,
  safePublishApprovalNotificationFollowUp,
} from "@/lib/revenue-os/publish-approval-notification";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import {
  campaignPostVisibleOnExternalSocialReviewQueue,
  externalAllowedRolesCoverAwaitingRole,
  getAwaitingRoleForExternalSocialReview,
  resolveExternalSocialReviewTokenContext,
} from "@/lib/social/external-social-publish-approval";

const BodySchema = z
  .object({
    token: z.string().min(16),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().max(500).optional(),
    approvalReviewSnapshot: z.object({
      expectedApprovalStatus: z.enum(["not_required", "pending_approval", "approved", "rejected"]),
      postUpdatedAt: z.string().datetime(),
      expectedApprovalStepIndex: z.number().int().min(0).optional(),
    }),
  })
  .refine((o) => o.decision !== "reject" || String(o.reason ?? "").trim().length > 0, {
    message: "reason is required when rejecting",
    path: ["reason"],
  });

function utmRecord(utmParams: unknown): Record<string, string> | null {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmParams as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

/**
 * POST /api/external/social-publish-approval/posts/:postId/decision
 * Body: { token, decision, reason?, approvalReviewSnapshot } — same UTM approval model as internal PATCH.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    if (!postId) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = BodySchema.parse(body);

    const db = await getDb();
    const ctx = await resolveExternalSocialReviewTokenContext(db, parsed.token);
    if (!ctx) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Link is invalid, revoked, or expired." },
        { status: 401 }
      );
    }

    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1);
    const post = postRows[0];
    if (!post || post.campaignId !== ctx.campaign.id) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const st = String(post.status || "").toUpperCase();
    if (st === "POSTED" || st === "PUBLISHING") {
      return NextResponse.json(
        { error: "IMMUTABLE", message: "This post is already publishing or published." },
        { status: 400 }
      );
    }

    if (
      !campaignPostVisibleOnExternalSocialReviewQueue({
        post,
        campaign: ctx.campaign,
        allowedRoles: ctx.allowedRoles,
      })
    ) {
      return NextResponse.json(
        {
          error: "NOT_ACTIONABLE",
          message:
            "This post is not awaiting your review (already decided, different approval step, or not in pending approval). Refresh the page.",
        },
        { status: 403 }
      );
    }

    const prevUtm = utmRecord(post.utmParams);
    const prevParsed = parsePublishApprovalFromUtm(prevUtm);
    const chain = parseCampaignPublishApprovalChainJson(ctx.campaign.publishApprovalChainJson);
    const awaiting = getAwaitingRoleForExternalSocialReview(chain, prevParsed);
    if (!awaiting || !externalAllowedRolesCoverAwaitingRole(ctx.allowedRoles, awaiting)) {
      return NextResponse.json(
        { error: "STEP_MISMATCH", message: "Your review link is not allowed to act on this approval step." },
        { status: 403 }
      );
    }

    const actor = {
      userId: null as number | null,
      label: (ctx.tokenRow.label?.trim() || "External reviewer").slice(0, 200),
      role: "reviewer" as const,
      identityBacked: false,
      useLabelOnlyGovernance: true as const,
    };

    const nextStatus = parsed.decision === "approve" ? ("approved" as const) : ("rejected" as const);
    const clientReason = parsed.decision === "reject" ? String(parsed.reason).trim() : null;

    const applyResult = applyCampaignPostPublishApprovalWrite({
      post,
      campaign: ctx.campaign,
      prevUtm,
      bentleyApprovalStatus: nextStatus,
      bentleyApprovalReason: clientReason,
      approvalReviewSnapshot: parsed.approvalReviewSnapshot,
      actor,
      reviewerRoleForChainGate: awaiting as CampaignReviewerRole,
      auditDetailsExtra: {
        reviewSurface: "external_social_review",
        externalReviewTokenId: ctx.tokenRow.id,
      },
    });

    if (applyResult.outcome === "step_blocked") {
      return NextResponse.json({ error: "APPROVAL_STEP_BLOCKED", message: applyResult.message }, { status: 403 });
    }
    if (applyResult.outcome === "rejected_stale") {
      return NextResponse.json(
        {
          error: "STALE_REVIEW",
          message:
            applyResult.staleCause === "approval_state_mismatch"
              ? "Approval state changed since this page was loaded. Refresh and try again."
              : "This post was updated since this page was loaded. Refresh and try again.",
          staleCause: applyResult.staleCause,
        },
        { status: 409 }
      );
    }
    if (applyResult.outcome === "accepted_idempotent") {
      return NextResponse.json({ ok: true, outcome: "accepted_idempotent" as const });
    }

    await db.insert(campaignAuditEvents).values({
      id: crypto.randomUUID(),
      userId: ctx.tokenRow.createdByUserId,
      postId,
      action: applyResult.auditAction,
      platform: post.platform,
      details: applyResult.auditDetails,
    });

    await db
      .update(campaignPosts)
      .set({
        utmParams: applyResult.mergedUtm,
        updatedAt: new Date(),
      })
      .where(eq(campaignPosts.id, postId));

    const campRow = ctx.campaign;
    const notifyCtx = applyResult.publishApprovalNotify;
    const mergedUtm = applyResult.mergedUtm;
    if (notifyCtx && mergedUtm && typeof mergedUtm === "object") {
      const ownerNum = Number(String(campRow.userId).trim());
      if (Number.isFinite(ownerNum) && ownerNum > 0) {
        if (notifyCtx.kind === "chain_advanced") {
          void safePublishApprovalNotificationFollowUp("external-review-chain-advanced", async () => {
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
              ? mergedUtm["bentley_approval_reason"] ?? clientReason
              : null;
          void safePublishApprovalNotificationFollowUp("external-review-approval", async () => {
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

    return NextResponse.json({ ok: true, outcome: "accepted_fresh" as const });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[external/social-publish-approval/posts/[postId]/decision POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
