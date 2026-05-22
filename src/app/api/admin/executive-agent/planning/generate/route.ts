import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { PLANNING_PLANS } from "@/lib/executive-agent/executive-planning-engine";
import { generateExecutivePlanningForAdmin } from "@/lib/executive-agent/executive-planning-service";
import type { PlanningPlanId } from "@/lib/executive-agent/executive-planning-types";

export const dynamic = "force-dynamic";

const PlanIds = PLANNING_PLANS.map((p) => p.id) as [PlanningPlanId, ...PlanningPlanId[]];

const BodySchema = z.object({
  planId: z.enum(PlanIds).optional().default("multi_department_ops"),
  horizonDays: z.number().int().min(7).max(90).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * POST /api/admin/executive-agent/planning/generate
 * Generates advisory operational plans in memory — no production mutation.
 */
export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const db = await getDb();
  const result = await generateExecutivePlanningForAdmin(db, {
    adminUserId,
    planId: parsed.data.planId,
    horizonDays: parsed.data.horizonDays,
    limit: parsed.data.limit,
  });

  return NextResponse.json(result);
}
