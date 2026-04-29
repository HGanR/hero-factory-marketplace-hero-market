import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revenueOsScenarios } from "@/lib/db/schema";
import { getFocusLever } from "@/lib/revenue-os/focus-lever";
import crypto from "crypto";
import { z } from "zod";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const ScenarioPayloadSchema = z.object({
  industry: z.string(),
  traffic: z.number(),
  conversion: z.number(),
  aov: z.number(),
  cac: z.number().optional(),
  revenue: z.number(),
  delta: z.number(),
  annualImpact: z.number(),
  title: z.string().optional(),
});

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const body = await req.json();
    const parsed = ScenarioPayloadSchema.parse(body);

    const focusLever = getFocusLever(
      parsed.traffic,
      parsed.conversion,
      parsed.aov
    );

    const payload = {
      industry: parsed.industry,
      traffic: parsed.traffic,
      conversion: parsed.conversion,
      aov: parsed.aov,
      cac: parsed.cac ?? 0,
      revenue: parsed.revenue,
      delta: parsed.delta,
      annualImpact: parsed.annualImpact,
      focusLever,
      title: parsed.title?.trim() || undefined,
    };

    const id = crypto.randomUUID();
    const createdBy =
      (body.createdBy as string)?.trim() || undefined;

    try {
      const db = await getDb();
      await db.insert(revenueOsScenarios).values({
        id,
        payload,
        createdBy: createdBy || null,
      });

      return NextResponse.json({
        id,
        permalink: `/ai-revenue-os/scenario/${id}`,
      });
    } catch (dbErr) {
      console.error("[revenue-os/scenarios] insert failed", dbErr);
      return NextResponse.json(
        { message: "Failed to save scenario" },
        { status: 500 }
      );
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid scenario payload", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/scenarios]", e);
    return NextResponse.json(
      { message: "Failed to create scenario" },
      { status: 500 }
    );
  }
}
