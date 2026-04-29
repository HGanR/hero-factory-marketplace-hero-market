import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { runBentleyOptimizationAction } from "@/lib/revenue-os/bentley-optimization-runner";

const BodySchema = z.object({
  campaignId: z.string().uuid(),
  mode: z.enum(["recommend_only", "assisted", "autonomous"]),
  forceVariant: z.boolean().optional(),
  bentleyRunId: z.string().max(128).optional().nullable(),
});

/**
 * POST /api/revenue-os/bentley/optimization/run
 * Diagnose from real governed analytics + post/approval signals; persist run; optionally create child campaign.
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = BodySchema.parse(await req.json());
    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, body.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (access.reviewerRole !== "owner") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Only the campaign owner can run Bentley optimization." },
        { status: 403 }
      );
    }

    const out = await runBentleyOptimizationAction(
      db,
      {
        userId: String(userId),
        clientId: access.campaign.clientId ?? "",
        campaignId: body.campaignId,
      },
      {
        mode: body.mode,
        forceVariant: body.forceVariant,
        bentleyRunId: body.bentleyRunId ?? null,
      }
    );

    return NextResponse.json({
      ok: true,
      result: out.result,
      runId: out.runId,
      childCampaignId: out.childCampaignId,
      duplicate: out.duplicate,
      optimizationKey: out.optimizationKey,
      execution: out.execution,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[revenue-os/bentley/optimization/run]", msg);
    return NextResponse.json({ error: "OPTIMIZATION_FAILED", message: msg }, { status: 500 });
  }
}
