import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { upsertAutomationPolicy } from "@/lib/revenue-os/automation-policies-db";
import { computeNextAutomationRunAt } from "@/lib/revenue-os/automation-policy-helpers";
import type { AutomationPolicyType } from "@/lib/revenue-os/automation-policy-helpers";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const PolicyTypeSchema = z.enum([
  "daily_operator_summary",
  "daily_cadence_run",
  "retry_failed_publish",
  "stale_backlog_cleanup",
  "lead_handoff_watch",
  "unsynced_post_watch",
  "connector_gap_watch",
  "weekly_executive_report",
]);

const BodySchema = z.object({
  id: z.string().max(36).optional(),
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  policyType: PolicyTypeSchema,
  isEnabled: z.boolean().optional().default(true),
  scheduleJson: z.record(z.string(), z.unknown()).optional().nullable(),
  policyConfigJson: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/automations/policies/upsert", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const uid = String(userId);
    const nextRunAt = computeNextAutomationRunAt({
      policyType: parsed.policyType as AutomationPolicyType,
      lastRunAt: null,
      scheduleJson: parsed.scheduleJson ?? undefined,
      nowMs: Date.now(),
    });
    const r = await upsertAutomationPolicy({
      userId: uid,
      id: parsed.id,
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      policyType: parsed.policyType as AutomationPolicyType,
      isEnabled: parsed.isEnabled,
      scheduleJson: parsed.scheduleJson ?? null,
      policyConfigJson: parsed.policyConfigJson ?? null,
      nextRunAt,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, reason: r.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, policy: r.row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
