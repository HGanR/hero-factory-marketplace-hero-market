import type { BentleySimulationComparison } from "@/lib/revenue-os/simulation-comparator";
import type {
  AutonomousPolicySimulationResult,
  CadencePolicySimulationResult,
  NotificationPolicySimulationResult,
} from "@/lib/revenue-os/policy-simulation";
import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";

export type BentleyPolicyRecommendation = {
  title: string;
  expectedBenefit: string;
  expectedRisk: string;
  humanReviewStronglyAdvised: boolean;
};

export function generateBentleyPolicyRecommendations(input: {
  comparison: BentleySimulationComparison;
  autonomous?: AutonomousPolicySimulationResult | null;
  cadence?: CadencePolicySimulationResult | null;
  notifications?: NotificationPolicySimulationResult | null;
  overview?: BentleyOperatorOverview | null;
}): BentleyPolicyRecommendation[] {
  const lines = input.comparison.summaryDelta?.trim();
  return [
    {
      title: "Review simulation delta",
      expectedBenefit: lines ? `Summary: ${lines}` : "No material deltas detected in this dry-run.",
      expectedRisk: "Policies were not applied — validate in staging before enabling automation.",
      humanReviewStronglyAdvised: false,
    },
  ];
}
