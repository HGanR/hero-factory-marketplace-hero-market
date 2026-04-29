/**
 * Pain / urgency / commercial-stage taxonomies for the Lead Intelligence Engine.
 */

export const LEAD_PAIN_TYPES = [
  "lead_generation",
  "low_sales",
  "bad_marketing",
  "no_time",
  "no_systems",
  "poor_followup",
  "weak_branding",
  "no_automation",
  "hiring_problem",
  "scaling_problem",
  "content_problem",
  "unclear_offer",
  "local_visibility_problem",
  "appointment_problem",
  "trust_credibility_problem",
  "other",
] as const;

export type LeadPainType = (typeof LEAD_PAIN_TYPES)[number];

export const LEAD_URGENCY_LEVELS = ["low", "medium", "high", "urgent"] as const;
export type LeadUrgency = (typeof LEAD_URGENCY_LEVELS)[number];

export const COMMERCIAL_READINESS_STAGES = [
  "unaware",
  "problem_aware",
  "solution_aware",
  "shopping",
  "ready_now",
] as const;

export type LeadCommercialReadinessStage = (typeof COMMERCIAL_READINESS_STAGES)[number];
