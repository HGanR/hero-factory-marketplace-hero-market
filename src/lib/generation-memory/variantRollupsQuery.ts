/**
 * Shared DB aggregation for experiment group → variant rollups (Phase 4H/4I).
 */

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  bentleyContentDeployments,
  bentleyGenerationVariants,
  bentleyTrackedLeads,
} from "@/lib/db/schema.bentley-social-leads";
import { aggregateVariantOutcomes, type VariantOutcomeRollup } from "@/lib/generation-memory/aggregateVariantOutcomes";

export async function getVariantRollupsForExperimentGroup(
  userId: number,
  experimentGroupId: string
): Promise<VariantOutcomeRollup[]> {
  const db = await getDb();
  const variants = await db
    .select({ id: bentleyGenerationVariants.id, variantTag: bentleyGenerationVariants.variantTag })
    .from(bentleyGenerationVariants)
    .where(
      and(
        eq(bentleyGenerationVariants.userId, userId),
        eq(bentleyGenerationVariants.experimentGroupId, experimentGroupId)
      )
    );

  if (variants.length === 0) return [];

  const vids = variants.map((v) => v.id);
  const deployments = await db
    .select({
      id: bentleyContentDeployments.id,
      generationVariantId: bentleyContentDeployments.generationVariantId,
    })
    .from(bentleyContentDeployments)
    .where(
      and(eq(bentleyContentDeployments.userId, userId), inArray(bentleyContentDeployments.generationVariantId, vids))
    );

  const leads = await db
    .select({
      contentDeploymentId: bentleyTrackedLeads.contentDeploymentId,
      status: bentleyTrackedLeads.status,
      estimatedValue: bentleyTrackedLeads.estimatedValue,
      closedValue: bentleyTrackedLeads.closedValue,
    })
    .from(bentleyTrackedLeads)
    .where(eq(bentleyTrackedLeads.userId, userId))
    .limit(5000);

  return aggregateVariantOutcomes({
    variants,
    deployments: deployments.map((d) => ({
      id: d.id,
      generationVariantId: d.generationVariantId ?? null,
    })),
    leads: leads.map((l) => ({
      contentDeploymentId: l.contentDeploymentId ?? null,
      status: l.status,
      estimatedValue: l.estimatedValue != null ? String(l.estimatedValue) : null,
      closedValue: l.closedValue != null ? String(l.closedValue) : null,
    })),
  });
}
