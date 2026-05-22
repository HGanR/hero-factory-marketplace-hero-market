import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { SIMULATION_SCENARIOS } from "@/lib/executive-agent/executive-simulation-engine";
import { runExecutiveSimulationForAdmin } from "@/lib/executive-agent/executive-simulation-service";
import type { SimulationScenarioId } from "@/lib/executive-agent/executive-simulation-types";

export const dynamic = "force-dynamic";

const ScenarioIds = SIMULATION_SCENARIOS.map((s) => s.id) as [SimulationScenarioId, ...SimulationScenarioId[]];

const BodySchema = z.object({
  scenarioId: z.enum(ScenarioIds).optional().default("baseline"),
  compareToBaseline: z.boolean().optional().default(true),
  assumptions: z
    .object({
      horizonDays: z.number().int().min(1).max(90).optional(),
      additionalApprovalDelayHours: z.number().min(0).max(500).optional(),
      simulateOperatorRedistribution: z.boolean().optional(),
      escalationLevelDelta: z.number().int().min(0).max(3).optional(),
      departmentLoadShiftPercent: z
        .object({
          WEBSITE: z.number().optional(),
          TRUST: z.number().optional(),
          REVENUE_OS: z.number().optional(),
          SMART_TRUST: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * POST /api/admin/executive-agent/simulation/run
 * Runs advisory simulation in memory — no production mutation.
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
  const result = await runExecutiveSimulationForAdmin(db, {
    adminUserId,
    scenarioId: parsed.data.scenarioId,
    assumptions: parsed.data.assumptions,
    limit: parsed.data.limit,
    compareToBaseline: parsed.data.compareToBaseline,
  });

  return NextResponse.json(result);
}
