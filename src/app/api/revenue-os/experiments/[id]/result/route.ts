import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import {
  experimentResults,
  experimentVariants,
  revenueOsExperiments,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { pickWinnerVariantId, type VariantMetricSnapshot } from "@/lib/revenue-os/experiment-winner";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Module 5: record experiment outcome + variant-level metrics (optional).
 * POST /api/revenue-os/experiments/:id/result
 */

const SnapshotSchema = z.object({
  traffic: z.number(),
  conversionRatePct: z.number(),
  avgOrderValue: z.number(),
  cac: z.number(),
  revenue: z.number(),
});

const VariantMetricsSchema = z.object({
  variantId: z.string().min(1),
  snapshot: SnapshotSchema,
});

const ResultSchema = z.object({
  status: z.enum(["WON", "LOST"]),
  resultSnapshot: SnapshotSchema.optional(),
  variantMetrics: z.array(VariantMetricsSchema).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: "Missing experiment id" }, { status: 400 });
    }

    logBentleyCorrelationEvent("revenue-os/experiments/result", req, { experimentId: id });

    const body = await req.json().catch(() => ({}));
    const parsed = ResultSchema.parse(body);

    const db = await getDb();
    const rows = await db
      .select()
      .from(revenueOsExperiments)
      .where(eq(revenueOsExperiments.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ message: "Experiment not found" }, { status: 404 });
    }

    await ensureRevenueOsLiveModuleTables();

    const variants = await db
      .select()
      .from(experimentVariants)
      .where(eq(experimentVariants.experimentId, id));

    let winnerVariantId: string | null = null;
    let resultSnapshotOut: Record<string, unknown> | undefined =
      parsed.resultSnapshot != null ? { ...parsed.resultSnapshot } : undefined;

    if (parsed.variantMetrics && parsed.variantMetrics.length > 0 && variants.length > 0) {
      await db.delete(experimentResults).where(eq(experimentResults.experimentId, id));

      const metricsMap = new Map<string, VariantMetricSnapshot>();
      for (const vm of parsed.variantMetrics) {
        metricsMap.set(vm.variantId, vm.snapshot);
      }

      const variantRows = variants.map((v) => ({
        id: v.id,
        isControl: Boolean(v.isControl),
      }));
      const { winnerVariantId: w, lifts } = pickWinnerVariantId(variantRows, metricsMap);
      winnerVariantId = w || null;

      for (const v of variants) {
        const snap = metricsMap.get(v.id);
        if (!snap) continue;
        const lift = lifts[v.id] ?? null;
        await db.insert(experimentResults).values({
          id: crypto.randomUUID(),
          experimentId: id,
          variantId: v.id,
          metrics: snap as Record<string, unknown>,
          revenueLiftPct: lift != null ? String(lift) : null,
          isWinner: v.id === winnerVariantId,
        });
      }

      resultSnapshotOut = {
        ...(resultSnapshotOut ?? {}),
        winnerVariantId,
        liftVsControlPct: lifts,
        ...(parsed.resultSnapshot ? { aggregate: parsed.resultSnapshot } : {}),
      };
    } else if (parsed.resultSnapshot && variants.length > 0) {
      await db.delete(experimentResults).where(eq(experimentResults.experimentId, id));
      const control = variants.find((v) => v.isControl) ?? variants[0];
      if (control) {
        await db.insert(experimentResults).values({
          id: crypto.randomUUID(),
          experimentId: id,
          variantId: control.id,
          metrics: parsed.resultSnapshot as Record<string, unknown>,
          revenueLiftPct: null,
          isWinner: true,
        });
        winnerVariantId = control.id;
      }
    }

    await db
      .update(revenueOsExperiments)
      .set({
        status: parsed.status,
        endedAt: new Date(),
        ...(resultSnapshotOut != null ? { resultSnapshot: resultSnapshotOut } : {}),
        ...(winnerVariantId != null && winnerVariantId !== ""
          ? { winnerVariantId }
          : {}),
      })
      .where(eq(revenueOsExperiments.id, id));

    return NextResponse.json({
      ok: true,
      id,
      status: parsed.status,
      message: "Result recorded",
      winnerVariantId,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid result data", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/experiments/result]", e);
    return NextResponse.json(
      { message: "Failed to record result" },
      { status: 500 }
    );
  }
}
