import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildExternalReviewOperatorApiSummary } from "@/lib/social/external-social-review-operator-db";
import {
  computeSocialReviewTokenOrigin,
  performOperatorExternalReviewTokenMint,
} from "@/lib/social/perform-operator-external-review-token-mint";

const GetQuerySchema = z.object({
  campaignId: z.string().uuid(),
  postId: z.string().uuid().optional(),
});

/**
 * GET /api/social/external-review-tokens?campaignId=&postId=
 * Operator-safe summary: token metadata (no raw secrets), last external client decision, optional post-level link eligibility.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = GetQuerySchema.parse({
      campaignId: searchParams.get("campaignId")?.trim(),
      postId: searchParams.get("postId")?.trim() || undefined,
    });

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const summary = await buildExternalReviewOperatorApiSummary({
      db,
      campaignId: parsed.campaignId,
      postId: parsed.postId ?? null,
      campaign: access.campaign,
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/external-review-tokens GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const PostBodySchema = z.object({
  campaignId: z.string().uuid(),
  label: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  allowedRoles: z.array(z.enum(["editor", "approver", "owner"])).max(3).optional(),
  /** When set, mint/revoke audit rows attach to this post’s activity timeline (must belong to campaign). */
  contextPostId: z.string().uuid().optional(),
});

/**
 * POST /api/social/external-review-tokens
 * Mint a client review link for governed social posts (Revenue OS + campaign access).
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
    const parsed = PostBodySchema.parse(body);

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

    return NextResponse.json({
      ok: true,
      id: minted.id,
      token: minted.rawToken,
      label: minted.label,
      expiresAt: minted.expiresAt?.toISOString() ?? null,
      allowedRoles: minted.roles,
      reviewUrl: minted.reviewUrl,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/external-review-tokens POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
