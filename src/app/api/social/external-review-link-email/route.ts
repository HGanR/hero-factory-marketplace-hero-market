import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  buildClientReviewShareEmailHtml,
  buildClientReviewShareEmailSubject,
  buildClientReviewShareMessage,
  prependRecipientGreeting,
} from "@/lib/social/client-review-share-message";
import {
  buildExternalReviewLinkEmailSentDetails,
  EXTERNAL_REVIEW_LINK_EMAIL_SENT_ACTION,
  insertExternalReviewLinkAuditEvent,
  resolveExternalReviewAuditPostId,
} from "@/lib/social/external-social-review-audit";
import {
  computeSocialReviewTokenOrigin,
  performOperatorExternalReviewTokenMint,
} from "@/lib/social/perform-operator-external-review-token-mint";
import { EmailNotificationService } from "@/services/email-notification-service";

const BodySchema = z.object({
  campaignId: z.string().uuid(),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(120).optional(),
  subject: z.string().max(200).optional(),
  bodyText: z.string().max(8000).optional(),
  label: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  allowedRoles: z.array(z.enum(["editor", "approver", "owner"])).max(3).optional(),
  contextPostId: z.string().uuid().optional(),
});

/**
 * POST /api/social/external-review-link-email
 * Mints a **new** client review token, builds body from `buildClientReviewShareMessage` (unless `bodyText` override),
 * sends via EmailNotificationService (same infrastructure as automations / marketplace emails).
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BodySchema.parse(body);

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const origin = computeSocialReviewTokenOrigin(req);
    const minted = await performOperatorExternalReviewTokenMint({
      db,
      userId,
      campaignId: parsed.campaignId,
      origin,
      label: parsed.label?.trim() || null,
      expiresInDays: parsed.expiresInDays,
      allowedRoles: parsed.allowedRoles,
      contextPostId: parsed.contextPostId,
    });

    const labelForCopy = minted.label ?? parsed.label?.trim() ?? null;
    const defaultPlain = prependRecipientGreeting(
      buildClientReviewShareMessage({
        reviewUrl: minted.reviewUrl,
        expiresAt: minted.expiresAt?.toISOString() ?? null,
        label: labelForCopy,
      }),
      parsed.recipientName
    );
    const plain = parsed.bodyText?.trim() ? parsed.bodyText.trim() : defaultPlain;
    const subject =
      parsed.subject?.trim() ||
      buildClientReviewShareEmailSubject({
        label: labelForCopy,
        campaignName: access.campaign.name ?? null,
      });

    const html = buildClientReviewShareEmailHtml({
      plainBody: plain,
      reviewUrl: minted.reviewUrl,
      expiresAt: minted.expiresAt?.toISOString() ?? null,
      label: labelForCopy,
      campaignName: access.campaign.name ?? null,
    });
    const provider = (process.env.EMAIL_PROVIDER as "sendgrid" | "nodemailer" | "aws-ses") ?? "aws-ses";
    const emailSvc = new EmailNotificationService(provider);
    const sendResult = await emailSvc.send({
      to: parsed.recipientEmail,
      subject: subject.slice(0, 200),
      body: html,
      userId: String(userId),
      metadata: {
        source: "external_review_link_email",
        tokenId: minted.id,
        campaignId: parsed.campaignId,
      },
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          error: "EMAIL_SEND_FAILED",
          message: sendResult.error || "Email could not be sent. A new review link was still created.",
          tokenId: minted.id,
        },
        { status: 502 }
      );
    }

    const auditPostId = await resolveExternalReviewAuditPostId(db, parsed.campaignId, parsed.contextPostId);
    await insertExternalReviewLinkAuditEvent({
      db,
      userId,
      postId: auditPostId,
      action: EXTERNAL_REVIEW_LINK_EMAIL_SENT_ACTION,
      details: buildExternalReviewLinkEmailSentDetails({
        tokenId: minted.id,
        label: labelForCopy,
        recipientEmail: parsed.recipientEmail,
        subject: subject.slice(0, 200),
      }),
    });

    return NextResponse.json({
      ok: true,
      tokenId: minted.id,
      emailSent: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/external-review-link-email POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
