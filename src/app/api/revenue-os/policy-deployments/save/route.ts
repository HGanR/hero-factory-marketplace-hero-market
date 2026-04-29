import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyPolicyChangeSet, buildBentleyRollbackChangeSet } from "@/lib/revenue-os/policy-change-sets";
import {
  getPolicyChangeSetByIdForUser,
  insertPolicyChangeSet,
  replaceChangeSetItems,
  updatePolicyChangeSet,
} from "@/lib/revenue-os/policy-change-sets-db";
import { emitPolicyDeploymentNotification } from "@/lib/revenue-os/policy-deployment-notifications";
import { writePolicyChangeSetAudit } from "@/lib/revenue-os/policy-deployment-audit";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  changeSetId: z.string().max(36).optional().nullable(),
  name: z.string().max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  scenarioId: z.string().max(36).optional().nullable(),
  rolloutPlanId: z.string().max(36).optional().nullable(),
  rollbackPackageId: z.string().max(36).optional().nullable(),
  proposedTargetSnapshotJson: z.record(z.string(), z.unknown()).optional().nullable(),
  scopeJson: z.record(z.string(), z.unknown()).optional().nullable(),
  clientId: z.string().max(64).optional().nullable(),
  trustId: z.string().max(64).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-deployments/save", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    let built: Awaited<ReturnType<typeof buildBentleyPolicyChangeSet>>;
    if (body.rollbackPackageId?.trim()) {
      built = await buildBentleyRollbackChangeSet({
        userId: uid,
        rollbackPackageId: body.rollbackPackageId.trim(),
        name: body.name ?? undefined,
        description: body.description ?? undefined,
      });
    } else {
      built = await buildBentleyPolicyChangeSet({
        userId: uid,
        name: body.name?.trim() || "Policy change set",
        description: body.description ?? null,
        proposedTargetSnapshotJson: body.proposedTargetSnapshotJson as Record<string, unknown> | null,
        sourceScenarioId: body.scenarioId ?? null,
        sourceRolloutPlanId: body.rolloutPlanId ?? null,
        scopeJson: body.scopeJson as Record<string, unknown> | null,
        changeSetType: body.rolloutPlanId ? "staged_deploy" : "forward_deploy",
      });
    }

    const existingId = body.changeSetId?.trim();
    let row = existingId ? await getPolicyChangeSetByIdForUser({ userId: uid, changeSetId: existingId }) : null;

    if (existingId && !row) {
      return NextResponse.json({ error: "Change set not found" }, { status: 404 });
    }

    if (row) {
      await updatePolicyChangeSet({
        changeSetId: row.id,
        name: built.changeSet.name,
        description: built.changeSet.description,
        changeSetType: built.changeSet.changeSetType,
        scopeJson: built.changeSet.scopeJson,
        status: "ready",
        sourceScenarioId: built.changeSet.sourceScenarioId,
        sourceRolloutPlanId: built.changeSet.sourceRolloutPlanId,
        sourceRollbackPackageId: built.changeSet.sourceRollbackPackageId,
      });
    } else {
      const inserted = await insertPolicyChangeSet({
        userId: uid,
        name: built.changeSet.name,
        description: built.changeSet.description,
        changeSetType: built.changeSet.changeSetType,
        scopeJson: built.changeSet.scopeJson,
        status: "ready",
        sourceScenarioId: built.changeSet.sourceScenarioId,
        sourceRolloutPlanId: built.changeSet.sourceRolloutPlanId,
        sourceRollbackPackageId: built.changeSet.sourceRollbackPackageId,
      });
      if (!inserted) {
        return NextResponse.json({ error: "Could not save change set" }, { status: 400 });
      }
      row = inserted;
    }

    const ok = await replaceChangeSetItems({
      changeSetId: row.id,
      items: built.items.map((it) => ({
        policyFamily: it.policyFamily,
        itemOrder: it.itemOrder,
        itemStatus: it.itemStatus,
        targetScopeJson: it.targetScopeJson,
        payloadJson: it.payloadJson,
      })),
    });
    if (!ok) {
      return NextResponse.json({ error: "Could not save items" }, { status: 400 });
    }

    await writePolicyChangeSetAudit({
      userId: uid,
      clientId: body.clientId?.trim() || "default",
      trustId: body.trustId?.trim() || "default",
      actionType: "policy_change_set_saved",
      changeSetId: row.id,
      payload: { itemCount: built.items.length },
    });

    await emitPolicyDeploymentNotification({
      userId: uid,
      clientId: body.clientId?.trim() || "default",
      trustId: body.trustId?.trim() || "default",
      kind: "policy_change_set_saved",
      changeSetId: row.id,
      title: "Policy change set saved",
      body: `"${row.name}" is ready for governed apply.`,
    });

    return NextResponse.json({ ok: true, changeSetId: row.id, built });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
