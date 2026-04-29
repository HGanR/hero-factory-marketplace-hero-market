/**
 * Staged ordering and scope planning for cross-family Bentley policy deployments.
 */

export type PolicyFamily = "notifications" | "automation" | "autonomous";

export type ScopeStagingMode = "single_workspace" | "pilot_set" | "broader_rollout";

const DEFAULT_FAMILY_ORDER: PolicyFamily[] = ["notifications", "automation", "autonomous"];

export type BentleyStagedDeploymentPlan = {
  stages: Array<{
    stageIndex: number;
    label: string;
    scopeMode: ScopeStagingMode;
    /** Human-readable scope description. */
    scopeDescription: string;
    familiesInStage: PolicyFamily[];
  }>;
  orderingRationale: string[];
  deploymentWarnings: string[];
  operatorChecklist: string[];
};

export type RecommendOrderingResult = {
  order: PolicyFamily[];
  orderingRationale: string[];
};

/**
 * Default: route notifications first (signal visibility), automation second, autonomous last (highest blast radius).
 */
export function recommendBentleyDeploymentOrdering(input: {
  familiesPresent: PolicyFamily[];
  /** Subset or reorder of DEFAULT_FAMILY_ORDER. */
  overrideOrder?: PolicyFamily[];
}): RecommendOrderingResult {
  const want = new Set(input.familiesPresent);
  const base = input.overrideOrder?.length
    ? input.overrideOrder.filter((f): f is PolicyFamily => DEFAULT_FAMILY_ORDER.includes(f))
    : DEFAULT_FAMILY_ORDER;
  const order = base.filter((f) => want.has(f));
  const rationale: string[] = [];
  if (order.includes("notifications")) {
    rationale.push("Notifications first — stabilizes alerting before execution changes.");
  }
  if (order.includes("automation")) {
    rationale.push("Automation second — schedules and cadence align after routing is known.");
  }
  if (order.includes("autonomous")) {
    rationale.push("Autonomous last — action policies carry the highest operational risk.");
  }

  return {
    order,
    orderingRationale: rationale.length ? rationale : ["Families ordered by operational risk (low → high)."],
  };
}

/**
 * Map scope staging to a simple multi-stage rollout narrative (coaching / UI).
 */
export function buildBentleyStagedDeploymentPlan(input: {
  /** Which families appear in this deployment. */
  families: PolicyFamily[];
  /** How scopes are rolled out over time. */
  scopeMode: ScopeStagingMode;
  /** For pilot / broader — optional workspace labels. */
  pilotWorkspaces?: Array<{ clientId: string; trustId: string; label?: string }>;
  singleWorkspace?: { clientId: string; trustId: string; label?: string };
}): BentleyStagedDeploymentPlan {
  const ordering = recommendBentleyDeploymentOrdering({ familiesPresent: input.families });
  const fams = ordering.order;

  const deploymentWarnings: string[] = [];
  if (input.scopeMode === "broader_rollout") {
    deploymentWarnings.push("Broader rollout — validate pilot metrics before expanding scopes.");
  }
  if (input.scopeMode === "pilot_set" && (!input.pilotWorkspaces || input.pilotWorkspaces.length === 0)) {
    deploymentWarnings.push("Pilot mode selected but no pilot workspaces listed — confirm scope JSON.");
  }

  const operatorChecklist: string[] = [
    "Confirm scenario or rollback source matches intended live tenants.",
    "Review skipped items (missing live policy rows) before apply.",
    "Ensure governed approval path is clear for autonomous changes.",
    "After apply, verify notifications and automation schedules in monitoring.",
  ];

  if (input.scopeMode === "single_workspace" && input.singleWorkspace) {
    const label =
      input.singleWorkspace.label ??
      `${input.singleWorkspace.clientId}/${input.singleWorkspace.trustId}`;
    return {
      stages: [
        {
          stageIndex: 0,
          label: "Single workspace",
          scopeMode: "single_workspace",
          scopeDescription: label,
          familiesInStage: fams,
        },
      ],
      orderingRationale: ordering.orderingRationale,
      deploymentWarnings,
      operatorChecklist,
    };
  }

  if (input.scopeMode === "pilot_set") {
    const pilotLabels =
      input.pilotWorkspaces?.map((w) => w.label ?? `${w.clientId}/${w.trustId}`).join(", ") || "pilot workspaces";
    return {
      stages: [
        {
          stageIndex: 0,
          label: "Pilot",
          scopeMode: "pilot_set",
          scopeDescription: pilotLabels,
          familiesInStage: fams,
        },
        {
          stageIndex: 1,
          label: "Expand",
          scopeMode: "broader_rollout",
          scopeDescription: "Promote the same change set to additional workspaces after pilot health checks.",
          familiesInStage: fams,
        },
      ],
      orderingRationale: ordering.orderingRationale,
      deploymentWarnings,
      operatorChecklist: operatorChecklist.concat(["Gate stage 2 on pilot error budgets and notification noise."]),
    };
  }

  return {
    stages: [
      {
        stageIndex: 0,
        label: "Foundation",
        scopeMode: "broader_rollout",
        scopeDescription: "Org-wide or multi-workspace — use staged monitoring between waves.",
        familiesInStage: fams,
      },
    ],
    orderingRationale: ordering.orderingRationale,
    deploymentWarnings,
    operatorChecklist,
  };
}
