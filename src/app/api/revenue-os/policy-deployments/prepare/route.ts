import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyPolicyChangeSet, buildBentleyRollbackChangeSet } from "@/lib/revenue-os/policy-change-sets";
import { buildBentleyStagedDeploymentPlan, type ScopeStagingMode } from "@/lib/revenue-os/staged-deployment";
import { buildChangeSetSummaryCard, buildStagedDeploymentTimeline } from "@/lib/revenue-os/policy-deployment-ui";
import { writePolicyChangeSetAudit } from "@/lib/revenue-os/policy-deployment-audit";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  scenarioId: z.string().max(36).optional().nullable(),
  rolloutPlanId: z.string().max(36).optional().nullable(),
  rollbackPackageId: z.string().max(36).optional().nullable(),
  proposedTargetSnapshotJson: z.record(z.string(), z.unknown()).optional().nullable(),
  scopeJson: z.record(z.string(), z.unknown()).optional().nullable(),
  scopeMode: z.enum(["single_workspace", "pilot_set", "broader_rollout"]).optional(),
  clientId: z.string().max(64).optional().nullable(),
  trustId: z.string().max(64).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-deployments/prepare", req);
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

    const scopeMode = (body.scopeMode ?? "single_workspace") as ScopeStagingMode;
    const staged = buildBentleyStagedDeploymentPlan({
      families: built.deploymentSummary.families,
      scopeMode,
      singleWorkspace:
        body.clientId?.trim() && body.trustId?.trim()
          ? { clientId: body.clientId.trim(), trustId: body.trustId.trim() }
          : undefined,
    });

    await writePolicyChangeSetAudit({
      userId: uid,
      clientId: body.clientId?.trim() || "default",
      trustId: body.trustId?.trim() || "default",
      actionType: "policy_change_set_prepared",
      payload: {
        name: built.changeSet.name,
        families: built.deploymentSummary.families,
      },
    });

    return NextResponse.json({
      ...built,
      stagedDeploymentPlan: staged,
      stagedTimeline: buildStagedDeploymentTimeline(staged),
      summaryCard: buildChangeSetSummaryCard(built),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
