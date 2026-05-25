/**
 * Typed handoff payload from guided intake (/ai-revenue-os) → Revenue OS Dashboard.
 */

import type { SocialPlatform } from "@/lib/social/config";

/** v2 adds canonical `postingPlatforms`; v1 derives from `platforms` labels on read. */
export const BENTLEY_DASHBOARD_HANDOFF_VERSION = 2 as const;
export const BENTLEY_DASHBOARD_HANDOFF_VERSION_LEGACY = 1 as const;

export type BentleyDashboardAutoRunMode = "off" | "analysis_only" | "full_pipeline";

export type BentleyDashboardHandoffPayload = {
  v: typeof BENTLEY_DASHBOARD_HANDOFF_VERSION | typeof BENTLEY_DASHBOARD_HANDOFF_VERSION_LEGACY;
  /** ISO timestamp when the handoff was built */
  createdAt: string;
  businessName: string;
  industryKey: string | null;
  contentIndustry: string;
  /** Dashboard “Business Type / Industry” — mirrors guided intake industry */
  businessType: string;
  targetAudience: string;
  market: string;
  currentMonthlyRevenue: number;
  targetMonthlyRevenue: number;
  grossMarginPct: number;
  monthlyTraffic: number;
  conversionRatePct: number;
  avgOrderValue: number;
  cac: number;
  ltv: number;
  coreOffer: string;
  transformation: string;
  platforms: string[];
  /** OAuth posting intent (v2). Omitted in v1 — derive via `mapLabelsToPostingPlatforms(platforms)`. */
  postingPlatforms?: SocialPlatform[];
  tone: string;
  contentTypeFocus: string;
  imageStyle: string;
  notes: string;
  /** When true, dashboard may run analysis once after hydration */
  autoRunFullAnalysis: boolean;
  /**
   * What to autorun after handoff hydration. Prefer this over inferring from `autoRunFullAnalysis` alone.
   * Legacy payloads omit this — consumers should use `resolveBentleyDashboardAutoRunMode`.
   */
  autoRunMode?: BentleyDashboardAutoRunMode;
};

export type BentleyDashboardHandoffEnvelope = {
  payload: BentleyDashboardHandoffPayload;
};
