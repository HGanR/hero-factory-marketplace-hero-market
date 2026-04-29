import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { appendCrossModuleAudit } from "@/lib/revenue-os/cross-module-audit";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import {
  experimentVariants,
  offerPackages,
  offerVersions,
  revenueOsExperiments,
} from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  confirm: z.literal(true),
  note: z.string().max(2000).optional(),
});

/**
 * Explicit opt-in: create a new offer_versions row from the latest ladder,
 * annotated with the winning experiment variant (audited; no silent overwrite).
 * POST /api/revenue-os/experiments/:id/apply-winner-to-offer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const { id: experimentId } = await params;
    if (!experimentId) {
      return NextResponse.json({ message: "Missing experiment id" }, { status: 400 });
    }

    logBentleyCorrelationEvent("revenue-os/experiments/apply-winner-to-offer", req, {
      experimentId,
    });

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.parse(body);
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();

    const expRows = await db
      .select()
      .from(revenueOsExperiments)
      .where(
        and(
          eq(revenueOsExperiments.id, experimentId),
          eq(revenueOsExperiments.userId, parsed.userId),
          eq(revenueOsExperiments.clientId, clientId),
          eq(revenueOsExperiments.trustId, trustId)
        )
      )
      .limit(1);

    if (expRows.length === 0) {
      return NextResponse.json({ message: "Experiment not found" }, { status: 404 });
    }

    const exp = expRows[0]!;
    if (exp.status !== "WON") {
      return NextResponse.json(
        {
          message: "Experiment must be WON before applying winner to an offer version",
          status: exp.status,
        },
        { status: 409 }
      );
    }

    const winnerVariantId = exp.winnerVariantId?.trim();
    if (!winnerVariantId) {
      return NextResponse.json(
        {
          message:
            "No winner variant recorded. POST variant metrics to /experiments/:id/result first.",
        },
        { status: 409 }
      );
    }

    const variantRows = await db
      .select()
      .from(experimentVariants)
      .where(eq(experimentVariants.id, winnerVariantId))
      .limit(1);
    const winnerLabel =
      variantRows[0]?.label ?? winnerVariantId.slice(0, 8);

    const pkgRows = await db
      .select()
      .from(offerPackages)
      .where(
        and(
          eq(offerPackages.userId, parsed.userId),
          eq(offerPackages.clientId, clientId),
          eq(offerPackages.trustId, trustId)
        )
      )
      .orderBy(desc(offerPackages.updatedAt))
      .limit(1);

    if (pkgRows.length === 0) {
      return NextResponse.json(
        {
          message:
            "No offer package for this workspace. Run POST /api/revenue-os/offers/generate first.",
        },
        { status: 400 }
      );
    }

    const packageId = pkgRows[0]!.id;

    const verRows = await db
      .select()
      .from(offerVersions)
      .where(eq(offerVersions.packageId, packageId))
      .orderBy(desc(offerVersions.version))
      .limit(1);

    if (verRows.length === 0) {
      return NextResponse.json(
        { message: "No offer versions found for package" },
        { status: 400 }
      );
    }

    const prev = verRows[0]!;
    const offerLadder = JSON.parse(JSON.stringify(prev.offerLadder)) as Record<
      string,
      { description?: string; name?: string }
    >;
    const annotation = `\n\n[Validated by experiment "${exp.name}"] Winner: ${winnerLabel}.`;
    for (const key of ["core", "premium", "ascension"] as const) {
      const step = offerLadder[key];
      if (step && typeof step.description === "string") {
        step.description = step.description + annotation;
      }
    }

    const nextVersion = prev.version + 1;
    const versionId = crypto.randomUUID();
    const prevRaw =
      prev.rawPayload && typeof prev.rawPayload === "object"
        ? (prev.rawPayload as Record<string, unknown>)
        : {};

    const mergedRaw = appendCrossModuleAudit(prevRaw, {
      sourceModule: "continuous_optimization",
      action: "experiment_winner_to_offer_version",
      actorUserId: parsed.userId,
      ids: {
        experimentId,
        winnerVariantId,
        priorOfferVersionId: prev.id,
        packageId,
        experimentName: exp.name,
        lever: exp.lever,
      },
      note: parsed.note?.trim() || undefined,
    });

    await db.insert(offerVersions).values({
      id: versionId,
      packageId,
      version: nextVersion,
      offerLadder,
      pricingBands: prev.pricingBands as Record<string, unknown>,
      upsells: prev.upsells as Record<string, unknown>,
      targetMonthlyRevenue: prev.targetMonthlyRevenue,
      marginPct: prev.marginPct,
      rawPayload: mergedRaw,
    });

    return NextResponse.json({
      ok: true,
      packageId,
      versionId,
      version: nextVersion,
      experimentId,
      winnerVariantId,
      message: "New offer version created from latest ladder with winner annotation",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/experiments/apply-winner-to-offer]", e);
    return NextResponse.json(
      { message: "Failed to apply winner to offer" },
      { status: 500 }
    );
  }
}
