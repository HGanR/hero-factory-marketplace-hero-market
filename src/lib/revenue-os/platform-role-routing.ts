/**
 * Route platforms by business role (attention, engagement, authority, etc.)
 * — additive to cross-platform normalization; does not replace rollup fields.
 */

import type { DeploymentFeedbackRollup } from "@/lib/revenue-os/deployment-feedback-summary";
import type { DeploymentFeedbackSignalsInput } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import type { RevenueOsOptimizationMemorySummary } from "@/lib/revenue-os/post-optimization-memory-types";
import type { MetricSyncContextLike } from "@/lib/revenue-os/platform-evidence-weighting";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import type { ComparableConfidence } from "@/lib/revenue-os/cross-platform-performance-normalization";

export type RevenueOsPlatformRole =
  | "attention"
  | "engagement"
  | "authority"
  | "lead_capture"
  | "distribution_support";

export type RevenueOsPlatformRoleEvidenceBasis =
  | "measured_attention"
  | "measured_engagement"
  | "publish_only"
  | "insufficient_data";

export type RevenueOsPlatformRoleRecommendation = {
  role: RevenueOsPlatformRole;
  preferredPlatform: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  evidenceBasis: RevenueOsPlatformRoleEvidenceBasis;
};

export type RevenueOsPlatformRoleRoutingSummary = {
  recommendations: RevenueOsPlatformRoleRecommendation[];
  /** One short operational line for UI / Bentley. */
  operationalRecommendation: string;
  confidenceNotes: string[];
};

export type DerivePlatformRoleRoutingArgs = {
  deploymentRollup: DeploymentFeedbackRollup | null | undefined;
  memorySummary: RevenueOsOptimizationMemorySummary | null | undefined;
  metricSyncContext?: MetricSyncContextLike | null;
  signalsInput?: DeploymentFeedbackSignalsInput | null;
  /** Optional; not used to change scores — may inform copy/debug later. */
  systemSignals?: RevenueOsSystemSignals | null;
};

function capPlat(p: unknown): string {
  const t = coerceTrimmedString(p);
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function platKey(p: unknown): string | null {
  const t = coerceTrimmedString(p).toLowerCase();
  return t || null;
}

function mapComparableToRoleConfidence(c: ComparableConfidence | undefined): "high" | "medium" | "low" {
  if (c === "high") return "high";
  if (c === "medium") return "medium";
  return "low";
}

function publishStabilityOk(rollup: DeploymentFeedbackRollup): boolean {
  const total = rollup.publishedCount + rollup.failedCount;
  if (rollup.publishedCount < 2) return false;
  if (total < 2) return true;
  return rollup.failedCount / total < 0.45;
}

/**
 * Pure routing from deployment rollup, optimization memory, and optional signals input.
 * Never promotes publish-only tiers to measured_attention / measured_engagement.
 */
export function derivePlatformRoleRouting(args: DerivePlatformRoleRoutingArgs): RevenueOsPlatformRoleRoutingSummary {
  const rollup = args.deploymentRollup;
  const mem = args.memorySummary;
  const sig = args.signalsInput;
  const confidenceNotes: string[] = [];

  const attPlat = platKey(rollup?.bestAttentionPlatform) || platKey(mem?.measuredStrongestAttentionPlatform);
  const engPlat = platKey(rollup?.bestEngagementPlatform) || platKey(mem?.measuredStrongestEngagementPlatform);

  const cmpConf = rollup?.comparisonConfidence ?? mem?.crossPlatformComparisonConfidence;
  const roleConfFromCmp = mapComparableToRoleConfidence(cmpConf);

  const attention: RevenueOsPlatformRoleRecommendation = attPlat
    ? {
        role: "attention",
        preferredPlatform: attPlat,
        confidence: roleConfFromCmp,
        reason: `**${capPlat(attPlat)}** currently looks strongest for **measured attention** (reach/impressions-style data) in scope.`,
        evidenceBasis: "measured_attention",
      }
    : {
        role: "attention",
        preferredPlatform: null,
        confidence: "low",
        reason:
          "We do **not** yet have enough **measured attention** signal (no reliable impressions/reach leader) — run metric sync or wait for data before picking an awareness channel on metrics alone.",
        evidenceBasis: "insufficient_data",
      };

  const engagement: RevenueOsPlatformRoleRecommendation = engPlat
    ? {
        role: "engagement",
        preferredPlatform: engPlat,
        confidence: roleConfFromCmp,
        reason: `**${capPlat(engPlat)}** is showing the **strongest measured engagement-style** signal from the fields available (not reach parity).`,
        evidenceBasis: "measured_engagement",
      }
    : {
        role: "engagement",
        preferredPlatform: null,
        confidence: "low",
        reason:
          "No clear **measured engagement** leader yet — comments/likes-style signals are thin or only on non–live-metric tiers.",
        evidenceBasis: "insufficient_data",
      };

  if (attPlat && engPlat && attPlat !== engPlat) {
    confidenceNotes.push("split_attention_engagement:different_roles_ok");
  }

  /** Authority: measured engagement first; else stable publish volume (operational). */
  let authority: RevenueOsPlatformRoleRecommendation;
  if (engPlat) {
    authority = {
      role: "authority",
      preferredPlatform: engPlat,
      confidence:
        rollup?.hasPerformanceMetrics && roleConfFromCmp === "high" ? "medium" : rollup?.hasPerformanceMetrics ? "low" : "low",
      reason: rollup?.hasPerformanceMetrics
        ? `**${capPlat(engPlat)}** has the strongest **conversation-style** measured activity — use for authority/thought-leadership **framing** (directional, not proof of brand lift).`
        : `**${capPlat(engPlat)}** leads on **engagement-style** signals in optimization memory — authority framing is a **weak prior** until deployment metrics align.`,
      evidenceBasis: "measured_engagement",
    };
  } else if (rollup && rollup.bestPublishedPlatform && publishStabilityOk(rollup)) {
    authority = {
      role: "authority",
      preferredPlatform: platKey(rollup.bestPublishedPlatform),
      confidence: "low",
      reason: `**${capPlat(rollup.bestPublishedPlatform)}** has **stable publish success** — operational fit for authority plays while measured conversation signals catch up.`,
      evidenceBasis: "publish_only",
    };
  } else {
    authority = {
      role: "authority",
      preferredPlatform: null,
      confidence: "low",
      reason:
        "Insufficient evidence to call an **authority** channel — need either measured engagement-style activity or a clear, stable publish track record.",
      evidenceBasis: "insufficient_data",
    };
  }

  /** Lead capture: never from likes/comments alone. */
  const leadCount = sig?.leadCount ?? 0;
  const anyClicks = sig?.anyReportedClicks === true;
  let lead_capture: RevenueOsPlatformRoleRecommendation;
  if (leadCount >= 1) {
    const plat =
      platKey(sig?.bestMeasuredPlatform) ||
      platKey(rollup?.bestMeasuredPlatform) ||
      platKey(rollup?.bestEngagementPlatform) ||
      null;
    lead_capture = {
      role: "lead_capture",
      preferredPlatform: plat,
      confidence: plat ? "medium" : "low",
      reason: plat
        ? `**${capPlat(plat)}** is the best **weak default** for lead-oriented CTAs because **lead counts** appear in synced data — still not a full attribution story.`
        : "Lead counts exist in data but **no platform attribution** is safe — keep CTAs consistent across channels until reporting clarifies.",
      evidenceBasis: "measured_engagement",
    };
  } else if (anyClicks) {
    lead_capture = {
      role: "lead_capture",
      preferredPlatform: null,
      confidence: "low",
      reason:
        "**Clicks** show some funnel interest, but there are **no lead counts** in scope — we **do not** call a lead-capture winner from likes/comments or clicks alone.",
      evidenceBasis: "insufficient_data",
    };
    confidenceNotes.push("lead_capture:clicks_without_leads");
  } else {
    lead_capture = {
      role: "lead_capture",
      preferredPlatform: null,
      confidence: "low",
      reason:
        "We **do not** yet have enough evidence to call a **lead-capture** winner — need **lead** (or robust conversion) signals, not engagement counts alone.",
      evidenceBasis: "insufficient_data",
    };
  }

  /** Distribution: operational throughput. */
  const distPlat = platKey(rollup?.bestPublishedPlatform);
  const distribution_support: RevenueOsPlatformRoleRecommendation =
    distPlat && rollup && rollup.publishedCount >= 1
      ? {
          role: "distribution_support",
          preferredPlatform: distPlat,
          confidence: rollup.publishedCount >= 3 ? "medium" : "low",
          reason: `**${capPlat(distPlat)}** has the **highest publish throughput** in this scope — use for **volume / distribution**, not as proof of creative superiority.`,
          evidenceBasis: "publish_only",
        }
      : {
          role: "distribution_support",
          preferredPlatform: null,
          confidence: "low",
          reason: "No clear **distribution** anchor yet — publish a few more posts or widen scope before batching volume to one channel.",
          evidenceBasis: "insufficient_data",
        };

  const recommendations: RevenueOsPlatformRoleRecommendation[] = [
    attention,
    engagement,
    authority,
    lead_capture,
    distribution_support,
  ];

  let operationalRecommendation =
    "**Next:** keep posting on your chosen platforms; let metric sync populate attention vs engagement leaders before over-rotating spend.";
  if (attPlat && engPlat && attPlat !== engPlat) {
    operationalRecommendation = `**Next:** run **awareness** experiments on **${capPlat(attPlat)}** and **conversation** angles on **${capPlat(engPlat)}** — different jobs; track separately.`;
  } else if (distPlat && !rollup?.hasPerformanceMetrics) {
    operationalRecommendation = `**Next:** enable **metric sync** for live channels, then re-check role routing; meanwhile **${capPlat(distPlat)}** is your operational volume leader only.`;
  } else if (rollup?.hasPerformanceMetrics && engPlat) {
    operationalRecommendation = `**Next:** ship one **hook test** on the attention-led channel and one **comment/CTA test** on **${capPlat(engPlat)}** if it differs from your awareness play.`;
  }

  return {
    recommendations,
    operationalRecommendation,
    confidenceNotes,
  };
}

/**
 * Compact single line for LLM prompts — only when two distinct measured leaders justify it.
 */
export function buildPlatformRoleRoutingGenerationHint(
  routing: RevenueOsPlatformRoleRoutingSummary
): string | null {
  const att = routing.recommendations.find((r) => r.role === "attention");
  const eng = routing.recommendations.find((r) => r.role === "engagement");
  if (
    att?.preferredPlatform &&
    eng?.preferredPlatform &&
    att.preferredPlatform !== eng.preferredPlatform &&
    att.evidenceBasis === "measured_attention" &&
    eng.evidenceBasis === "measured_engagement"
  ) {
    return (
      `Platform-role hint: favor ${capPlat(att.preferredPlatform)}-compatible hooks for attention-building; ` +
      `favor ${capPlat(eng.preferredPlatform)}-compatible framing for engagement/authority content — subordinate to user goals and chosen platforms.`
    );
  }
  if (att?.preferredPlatform && att.evidenceBasis === "measured_attention" && att.confidence !== "low") {
    return `Platform-role hint: measured attention favors ${capPlat(att.preferredPlatform)}-style reach hooks; keep engagement claims separate where APIs differ.`;
  }
  if (eng?.preferredPlatform && eng.evidenceBasis === "measured_engagement" && eng.confidence !== "low") {
    return `Platform-role hint: measured engagement favors ${capPlat(eng.preferredPlatform)}-style conversation angles; do not treat as reach leadership.`;
  }
  return null;
}

export type PlatformRoleRoutingFocus =
  | "all"
  | "attention"
  | "engagement"
  | "authority"
  | "lead_capture"
  | "distribution_support";

export function inferPlatformRoleFocusFromMessage(message: string): PlatformRoleRoutingFocus {
  const t = message.trim().toLowerCase();
  if (/\b(awareness|reach|impressions?|attention|top.of.funnel|TOF)\b/.test(t)) return "attention";
  if (/\bengagement\b/.test(t) && !/\bauthority\b/.test(t)) return "engagement";
  if (/\bauthority\b|thought.?lead|credibility|professional.reputation\b/.test(t)) return "authority";
  if (/\blead|conversion|capture|sign.?up|demo\b/.test(t)) return "lead_capture";
  if (/\bnext batch|distribution|volume|throughput|post more\b/.test(t)) return "distribution_support";
  if (
    /\bwhat platform|which platform|where should i post|which channel|focus on\b/.test(t) ||
    /\bbest for\b/.test(t)
  ) {
    return "all";
  }
  return "all";
}
