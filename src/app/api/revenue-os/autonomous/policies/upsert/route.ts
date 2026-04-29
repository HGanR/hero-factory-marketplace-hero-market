import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { upsertAutonomousPolicy } from "@/lib/revenue-os/autonomous-policies-db";
import { BENTLEY_AUTONOMOUS_ACTION_TYPES, isBentleyAutonomousActionType } from "@/lib/revenue-os/autonomous-types";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  id: z.string().max(36).optional(),
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  actionType: z.string().min(1).max(64),
  isEnabled: z.boolean().optional().default(true),
  requiresApprovalAboveSeverity: z.enum(["none", "info", "warning", "critical"]).optional().default("none"),
  maxDailyExecutions: z.number().int().min(0).max(10_000).optional().nullable(),
  cooldownMinutes: z.number().int().min(0).max(10_000).optional().nullable(),
  policyConfigJson: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/policies/upsert", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    if (!isBentleyAutonomousActionType(parsed.actionType)) {
      return NextResponse.json(
        { ok: false, error: "invalid_action_type", allowed: BENTLEY_AUTONOMOUS_ACTION_TYPES },
        { status: 400 }
      );
    }
    const r = await upsertAutonomousPolicy({
      userId: String(userId),
      id: parsed.id,
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      actionType: parsed.actionType,
      isEnabled: parsed.isEnabled,
      requiresApprovalAboveSeverity: parsed.requiresApprovalAboveSeverity,
      maxDailyExecutions: parsed.maxDailyExecutions ?? null,
      cooldownMinutes: parsed.cooldownMinutes ?? null,
      policyConfigJson: parsed.policyConfigJson ?? null,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    return NextResponse.json({ ok: true, policy: r.row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
