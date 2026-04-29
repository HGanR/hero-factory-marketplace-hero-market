/**
 * Optional GrowthGuidance one-liners for saved rollback packages.
 */

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import type { PolicyRollbackPackageRow } from "@/lib/revenue-os/policy-rollback-db";

export function buildRollbackPackageGuidanceLines(pkg: PolicyRollbackPackageRow | null): {
  bentleyRollbackPackageSummaryLine?: string;
  bentleyRollbackBundleReadyLine?: string;
  bentleyRollbackApplyAdvisoryLine?: string;
} {
  if (!pkg) return {};
  const fam = String(pkg.rollbackType ?? "blended");
  const bentleyRollbackPackageSummaryLine =
    `Rollback package "${pkg.name.slice(0, 80)}" (${fam}) — prepared for reviewed apply.`.slice(0, 420);
  const bentleyRollbackBundleReadyLine = pkg.isSaved
    ? "Rollback bundle is ready for governed review and apply from the Policy Rollback workbench."
    : undefined;
  const bentleyRollbackApplyAdvisoryLine =
    "Rollback apply requires explicit confirmation in Policy Rollback — live policies are not reverted automatically.";
  return { bentleyRollbackPackageSummaryLine, bentleyRollbackBundleReadyLine, bentleyRollbackApplyAdvisoryLine };
}

export function mergeRollbackPackageGuidanceIntoGrowthGuidance(
  base: GrowthGuidance | null,
  pkg: PolicyRollbackPackageRow | null
): GrowthGuidance | null {
  const lines = buildRollbackPackageGuidanceLines(pkg);
  const has =
    lines.bentleyRollbackPackageSummaryLine ||
    lines.bentleyRollbackBundleReadyLine ||
    lines.bentleyRollbackApplyAdvisoryLine;
  if (!base && !has) return null;

  const next: GrowthGuidance = base
    ? { ...base }
    : {
        recommendedNextMove: "Review prepared rollback packages before changing live policies.",
        why: "",
        risingTopics: [],
        weakAngles: [],
        bestHookDirection: "",
      };

  next.bentleyRollbackPackageSummaryLine =
    lines.bentleyRollbackPackageSummaryLine ?? next.bentleyRollbackPackageSummaryLine;
  next.bentleyRollbackBundleReadyLine = lines.bentleyRollbackBundleReadyLine ?? next.bentleyRollbackBundleReadyLine;
  next.bentleyRollbackApplyAdvisoryLine = lines.bentleyRollbackApplyAdvisoryLine ?? next.bentleyRollbackApplyAdvisoryLine;

  return next;
}
