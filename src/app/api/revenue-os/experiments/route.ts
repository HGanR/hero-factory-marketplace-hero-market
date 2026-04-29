import { NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { experimentVariants, revenueOsExperiments } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const CreateSchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  name: z.string().min(1).max(200),
  lever: z.enum(["conversion", "aov", "traffic", "cac"]),
  hypothesis: z.string().optional(),
  inputSnapshot: z
    .object({
      traffic: z.number(),
      conversionRatePct: z.number(),
      avgOrderValue: z.number(),
      cac: z.number(),
      revenue: z.number(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/experiments", req, { method: "POST" });
    const body = await req.json();
    const parsed = CreateSchema.parse(body);

    const id = crypto.randomUUID();
    const clientId = parsed.clientId?.trim() || "";
    const trustId = parsed.trustId?.trim() || "";

    const db = await getDb();
    await db.insert(revenueOsExperiments).values({
      id,
      userId: parsed.userId,
      clientId,
      trustId,
      name: parsed.name,
      lever: parsed.lever,
      hypothesis: parsed.hypothesis?.trim() || null,
      inputSnapshot: parsed.inputSnapshot ?? null,
      status: "ACTIVE",
    });

    let variantControlId: string | null = null;
    let variantTreatmentId: string | null = null;
    try {
      await ensureRevenueOsLiveModuleTables();
      variantControlId = crypto.randomUUID();
      variantTreatmentId = crypto.randomUUID();
      await db.insert(experimentVariants).values([
        {
          id: variantControlId,
          experimentId: id,
          label: "Control",
          isControl: true,
          sortOrder: 0,
        },
        {
          id: variantTreatmentId,
          experimentId: id,
          label: "Variant B",
          isControl: false,
          sortOrder: 1,
        },
      ]);
    } catch (e) {
      console.warn("[revenue-os/experiments] variants skipped", e);
    }

    return NextResponse.json({
      id,
      status: "ACTIVE",
      ...(variantControlId && variantTreatmentId
        ? { variants: { control: variantControlId, treatment: variantTreatmentId } }
        : {}),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid experiment data", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/experiments]", e);
    return NextResponse.json(
      { message: "Failed to create experiment" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/experiments", req, { method: "GET" });
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "userId is required" },
        { status: 400 }
      );
    }

    const clientId = searchParams.get("clientId")?.trim() || "";
    const trustId = searchParams.get("trustId")?.trim() || "";
    const status = searchParams.get("status")?.trim(); // ACTIVE | WON | LOST | all

    const db = await getDb();
    const conditions = [
      eq(revenueOsExperiments.userId, userId),
      eq(revenueOsExperiments.clientId, clientId),
      eq(revenueOsExperiments.trustId, trustId),
    ];
    if (status && status !== "all") {
      conditions.push(eq(revenueOsExperiments.status, status));
    }

    const rows = await db
      .select()
      .from(revenueOsExperiments)
      .where(and(...conditions))
      .orderBy(desc(revenueOsExperiments.startedAt))
      .limit(20);

    const experiments = rows.map((r) => ({
      id: r.id,
      name: r.name,
      lever: r.lever,
      hypothesis: r.hypothesis,
      status: r.status,
      winnerVariantId: r.winnerVariantId,
      inputSnapshot: r.inputSnapshot,
      resultSnapshot: r.resultSnapshot,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
    }));

    return NextResponse.json({ experiments });
  } catch (e) {
    console.error("[revenue-os/experiments]", e);
    return NextResponse.json(
      { message: "Failed to fetch experiments" },
      { status: 500 }
    );
  }
}
