import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import {
  getPolicyRollbackPackageByIdForUser,
  insertPolicyRollbackRun,
  updatePolicyRollbackRun,
} from "@/lib/revenue-os/policy-rollback-db";
import { buildBlendedRollbackBundle } from "@/lib/revenue-os/reversible-policy-bundles";
import { applyBentleyPolicyUpsertItem } from "@/lib/revenue-os/policy-upsert-apply";
import { emitRollbackPackageNotification } from "@/lib/revenue-os/rollback-notifications";
import { buildApplyResultSummary } from "@/lib/revenue-os/rollback-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  rollbackPackageId: z.string().min(1),
  confirm: z.literal(true),
  families: z.array(z.enum(["autonomous", "automation", "notifications"])).optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollback/apply", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));

    const pkg = await getPolicyRollbackPackageByIdForUser({ userId: uid, packageId: parsed.rollbackPackageId });
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    const tgt = pkg.rollbackTargetSnapshotJson;
    if (!tgt || typeof tgt !== "object") {
      return NextResponse.json({ error: "Package has no rollback target snapshot" }, { status: 400 });
    }

    const bundle = await buildBlendedRollbackBundle({
      userId: uid,
      rollbackTargetSnapshotJson: tgt as Record<string, unknown>,
      families: parsed.families,
    });

    const runRow = await insertPolicyRollbackRun({
      rollbackPackageId: pkg.id,
      runStatus: "reviewed",
      reviewedByUserId: uid,
      runSummaryJson: { phase: "apply_started", partialFailures: bundle.partialFailures },
    });
    if (!runRow) {
      return NextResponse.json({ error: "Could not create rollback run" }, { status: 400 });
    }

    let applied = 0;
    let failed = 0;
    let skipped = bundle.items.filter((i) => !i.payload).length;
    const errors: string[] = [];

    for (const item of bundle.items) {
      if (!item.payload) continue;
      const auditFamily =
        item.family === "notifications"
          ? "notification_rollback_apply"
          : item.family === "automation"
            ? "automation_rollback_apply"
            : "autonomous_rollback_apply";
      const r = await applyBentleyPolicyUpsertItem({
        userId: uid,
        item,
        audit: {
          sourceType: "bentley_policy_rollback",
          relatedRunId: runRow.id,
          bundleId: pkg.id,
          actionType: auditFamily,
        },
      });
      if (r.ok) {
        applied += 1;
      } else {
        failed += 1;
        errors.push(`${item.family} ${item.policyId}: ${r.error ?? "upsert failed"}`);
      }
    }

    const finalStatus = applied > 0 ? "applied" : "failed";
    await updatePolicyRollbackRun({
      runId: runRow.id,
      runStatus: finalStatus,
      appliedAt: applied > 0 ? new Date() : null,
      runSummaryJson: {
        applied,
        failed,
        skipped,
        errors,
        partialFailures: bundle.partialFailures,
      },
    });

    if (applied > 0) {
      await emitRollbackPackageNotification({
        userId: uid,
        clientId: "default",
        trustId: "default",
        kind: "rollback_package_applied",
        packageId: pkg.id,
        title: "Rollback applied",
        body: `Applied ${applied} policy upsert(s)${failed ? `; ${failed} failed` : ""}.`,
        payload: { applied, failed, runId: runRow.id },
      });
    }
    if (failed > 0 && applied === 0) {
      await emitRollbackPackageNotification({
        userId: uid,
        clientId: "default",
        trustId: "default",
        kind: "rollback_package_failed",
        packageId: pkg.id,
        title: "Rollback apply failed",
        body: errors.slice(0, 3).join(" · ") || "All upserts failed.",
        payload: { errors, runId: runRow.id },
      });
    }

    return NextResponse.json({
      ok: applied > 0,
      runId: runRow.id,
      applied,
      failed,
      skipped,
      errors,
      partialFailures: bundle.partialFailures,
      summary: buildApplyResultSummary({ applied, failed, skipped, errors }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
