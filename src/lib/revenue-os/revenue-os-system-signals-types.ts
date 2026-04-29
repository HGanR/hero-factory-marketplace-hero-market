/** 5-system model scores (0–100). Undefined = not enough signal to score yet. */

export type RevenueOsSystemSignals = {
  opportunityScore?: number;
  offerStrengthScore?: number;
  trafficReadinessScore?: number;
  executionGapScore?: number;
  capitalReadinessScore?: number;
  /** True when scores were nudged using deployment feedback (publish outcomes / sparse metrics). */
  deploymentFeedbackEnriched?: boolean;
};
