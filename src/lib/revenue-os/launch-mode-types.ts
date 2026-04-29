/** 7-Day Launch Mode — data model (no I/O). */

export type RevenueOsLaunchDayPlan = {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  objective: string;
  tasks: string[];
  deliverables: string[];
  recommendedStep?: 1 | 2 | 3 | 4 | 5 | null;
};

export type RevenueOsLaunchModeReadiness = {
  isReady: boolean;
  blockers: string[];
  strengths: string[];
};

export type RevenueOsLaunchModePlan = {
  summary: string;
  primaryOffer?: string;
  targetAudience?: string;
  launchAngle?: string;
  days: RevenueOsLaunchDayPlan[];
  readiness: RevenueOsLaunchModeReadiness;
};

/** Narrow intake slice used by the pure plan builder (avoid coupling to full UI state). */
export type RevenueOsLaunchSharedProfile = {
  businessName: string;
  coreOffer: string;
  transformation: string;
  targetAudience: string;
  industry: string;
  /** Human-readable platform labels for messaging. */
  postingPlatforms: string[];
};
