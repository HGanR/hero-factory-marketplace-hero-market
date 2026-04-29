/**
 * Deterministic role classification for generated content (no LLM / no I/O).
 */

import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import {
  ALL_CONTENT_BATCH_ROLES,
  emptyCountsByRole,
  type RevenueOsContentBatchRole,
  type RevenueOsContentBatchRoutingSummary,
  type RevenueOsRoutedContentItem,
} from "@/lib/revenue-os/content-batch-routing-types";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type { OptimizationMemoryGenerationSlice } from "@/lib/revenue-os/post-optimization-memory-types";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim();
}

function substantialCampaign(c?: CampaignResponse | null): boolean {
  if (!c) return false;
  if (norm(c.offerStatement).length >= 28) return true;
  const pillars = (c.messagePillars ?? []).map(norm).join(" ");
  return pillars.length >= 40;
}

const MIN_CE_CAPTION = 36;
const MIN_MEDIA_BRIEF = 80;

export type ClassifyContentBatchArgs = {
  title?: string;
  body: string;
  hook?: string | null;
  cta?: string | null;
  source: RevenueOsRoutedContentItem["source"];
};

/** Exported for deployment draft enrichment and tests. */
export function classifyContentForBatchRole(args: ClassifyContentBatchArgs): {
  role: RevenueOsContentBatchRole;
  confidence: "high" | "medium" | "low";
  reason: string;
} {
  const text = [norm(args.title), norm(args.hook), norm(args.cta), norm(args.body)].filter(Boolean).join("\n").toLowerCase();
  if (text.length < 12) {
    return {
      role: "distribution_support",
      confidence: "low",
      reason: "Very little copy to classify — treated as operational / distribution_support.",
    };
  }

  const scores: Record<RevenueOsContentBatchRole, number> = {
    attention: 0,
    engagement: 0,
    authority: 0,
    lead_capture: 0,
    distribution_support: 0,
  };

  if (
    /\b(stop scrolling|you need to see|wait for it|pov\b|plot twist|nobody talks about|secret|don't skip|hook:|viral|fyp|watch until)\b/.test(
      text
    ) ||
    /\?{2,}/.test(text) ||
    /\b(can't believe|insane|wild that)\b/.test(text)
  ) {
    scores.attention += 4;
  }
  if (/\b(curiosity|why most|the real reason|what if)\b/.test(text)) scores.attention += 2;
  if (text.includes("?") && scores.attention < 2) scores.engagement += 1;

  if (
    /\b(what do you think|agree\?|comment below|your take|hot take|unpopular opinion|wrong or right|tag someone|debate|let me know)\b/.test(
      text
    )
  ) {
    scores.engagement += 5;
  }
  if (/\b(reply with|drop a|sound off)\b/.test(text)) scores.engagement += 3;

  if (
    /\b(framework|playbook|step \d|lesson learned|research shows|study|data shows|here's why|explainer|proof|according to|tips?:|how .{0,24} works|breakdown)\b/.test(
      text
    )
  ) {
    scores.authority += 5;
  }
  if (/\b(educational|learn how|guide to|ultimate guide)\b/.test(text)) scores.authority += 2;

  if (
    /\b(book a call|schedule|register|sign up|signup|apply now|buy now|order now|limited spots|free trial|dm me|link in bio|get your|claim your|waitlist|newsletter)\b/.test(
      text
    )
  ) {
    scores.lead_capture += 6;
  }
  if (/\b(\$\d|% off|discount|coupon|offer ends)\b/.test(text)) scores.lead_capture += 2;

  if (
    /\b(recap|round-up|roundup|save this|share this|follow for|part \d|thread|carousel|repurpose|follow-up|follow up|reminder)\b/.test(
      text
    )
  ) {
    scores.distribution_support += 4;
  }

  let best: RevenueOsContentBatchRole = "distribution_support";
  let bestScore = scores.distribution_support;
  for (const r of ALL_CONTENT_BATCH_ROLES) {
    if (scores[r] > bestScore) {
      bestScore = scores[r];
      best = r;
    }
  }

  if (best === "lead_capture" && bestScore < 6) {
    if (scores.authority >= 2) {
      return {
        role: "authority",
        confidence: "low",
        reason:
          "Conversion cues were too weak for lead_capture — bucketed as authority/education-style instead.",
      };
    }
    return {
      role: "distribution_support",
      confidence: "low",
      reason:
        "Conversion cues were too weak for lead_capture — defaulting to distribution_support (do not force a funnel batch).",
    };
  }

  if (bestScore <= 1) {
    return {
      role: "distribution_support",
      confidence: "low",
      reason: "No strong role signals — defaulting to distribution_support (safe operational bucket).",
    };
  }

  const confidence: "high" | "medium" | "low" =
    bestScore >= 6 ? "high" : bestScore >= 3 ? "medium" : "low";

  const reason = `Heuristic match: ${best.replace(/_/g, " ")} (score ${bestScore}).`;
  return { role: best, confidence, reason };
}

/** Map platform-role routing recommendations to platform hint lists per content batch role. */
export function buildPlatformHintsForContentRole(
  role: RevenueOsContentBatchRole,
  routing: RevenueOsPlatformRoleRoutingSummary | null | undefined
): string[] {
  if (!routing?.recommendations?.length) return [];
  const rec = routing.recommendations.find((x) => x.role === role);
  if (rec?.preferredPlatform) return [rec.preferredPlatform];
  return [];
}

function stableItemId(source: string, index: number, snippet: string): string {
  let h = 0;
  const key = `${source}:${index}:${snippet.slice(0, 80)}`;
  for (let i = 0; i < key.length; i++) h = Math.imul(h, 31) + key.charCodeAt(i);
  return `cb-${(h >>> 0).toString(16)}`;
}

function extractPieces(args: {
  contentEngineResult?: ContentEngineOutput | null;
  campaignResult?: CampaignResponse | null;
  launchPlan?: RevenueOsLaunchModePlan | null;
  mediaBrief?: string | null;
}): Omit<RevenueOsRoutedContentItem, "role" | "platformHints" | "confidence" | "reason">[] {
  const out: Omit<RevenueOsRoutedContentItem, "role" | "platformHints" | "confidence" | "reason">[] = [];

  if (substantialCampaign(args.campaignResult)) {
    const c = args.campaignResult!;
    const hooks = c.shortFormHooks ?? [];
    const offer = norm(c.offerStatement);
    hooks.forEach((h, i) => {
      const hook = norm(h);
      if (!hook && !offer) return;
      const body = [hook, offer].filter(Boolean).join("\n\n");
      out.push({
        id: stableItemId("campaign", i, body),
        source: "campaign_from_notes",
        title: hook.slice(0, 120) || "Campaign piece",
        body,
        hook: hook || null,
        cta: offer || null,
      });
    });
    return out;
  }

  if (args.contentEngineResult && norm(args.contentEngineResult.fullPost?.caption).length >= MIN_CE_CAPTION) {
    const ce = args.contentEngineResult;
    const cap = norm(ce.fullPost?.caption);
    const hook = norm(ce.captions?.hook);
    const tags = (ce.fullPost?.hashtags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
    const body = tags ? `${cap}\n\n${tags}` : cap;
    out.push({
      id: stableItemId("ce", 0, body),
      source: "content_engine",
      title: hook.slice(0, 120) || "Content bundle",
      body,
      hook: hook || null,
      cta: null,
    });
    return out;
  }

  if (args.launchPlan && norm(args.launchPlan.days?.[0]?.objective ?? "").length >= 20) {
    const d1 = args.launchPlan.days.find((d) => d.day === 1) ?? args.launchPlan.days[0];
    const objective = norm(d1?.objective);
    const tasks = (d1?.tasks ?? []).map(norm).filter(Boolean);
    const body = [objective, tasks.length ? `Tasks:\n${tasks.map((t) => `• ${t}`).join("\n")}` : ""]
      .filter(Boolean)
      .join("\n\n");
    out.push({
      id: stableItemId("launch", 0, body),
      source: "launch_mode",
      title: norm(d1?.title).slice(0, 120) || "Launch day",
      body,
      hook: null,
      cta: null,
    });
    return out;
  }

  const brief = norm(args.mediaBrief);
  if (brief.length >= MIN_MEDIA_BRIEF) {
    const lines = brief.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    out.push({
      id: stableItemId("brief", 0, brief),
      source: "manual",
      title: lines[0]?.slice(0, 120) || "Media brief",
      body: lines.join("\n\n"),
      hook: null,
      cta: null,
    });
  }

  return out;
}

function buildNextActionLine(
  counts: Record<RevenueOsContentBatchRole, number>,
  recPlat: Partial<Record<RevenueOsContentBatchRole, string[]>>,
  routing: RevenueOsPlatformRoleRoutingSummary | null | undefined
): string {
  const attPlat = recPlat.attention?.[0];
  const engPlat = recPlat.engagement?.[0];
  const authPlat = recPlat.authority?.[0];
  if (counts.attention > 0 && attPlat) {
    return `**Posting sequence:** ship **attention**-class copy first on **${attPlat}** when it fits your plan, then layer **engagement**${engPlat ? ` on **${engPlat}**` : ""}. ${routing?.operationalRecommendation ?? ""}`.trim();
  }
  if (counts.authority > 0 && authPlat) {
    return `**Posting sequence:** use **authority**-leaning pieces on **${authPlat}** for credibility-heavy angles; keep lead CTAs sparse without conversion evidence.`;
  }
  if (counts.lead_capture > 0) {
    return "**Lead-capture batch:** only prioritize if you have click/lead signals in deployment data — otherwise treat as soft CTA tests.";
  }
  return (
    routing?.operationalRecommendation ??
    "**Next:** tag each post with a role mentally (awareness vs conversation vs offer) before scheduling."
  );
}

export type RouteGeneratedContentIntoBatchesArgs = {
  contentEngineResult?: ContentEngineOutput | null;
  campaignResult?: CampaignResponse | null;
  launchPlan?: RevenueOsLaunchModePlan | null;
  mediaBrief?: string | null;
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null | undefined;
  optimizationMemoryGeneration?: OptimizationMemoryGenerationSlice | null;
};

/**
 * Classify generated artifacts into role buckets and attach platform hints from platform-role routing.
 */
export function routeGeneratedContentIntoBatches(
  args: RouteGeneratedContentIntoBatchesArgs
): RevenueOsContentBatchRoutingSummary {
  const raw = extractPieces({
    contentEngineResult: args.contentEngineResult,
    campaignResult: args.campaignResult,
    launchPlan: args.launchPlan,
    mediaBrief: args.mediaBrief,
  });

  const roleHintsFromPlatformRouting = Boolean(args.platformRoleRouting?.recommendations?.length);
  const recommendedPlatformsByRole: Partial<Record<RevenueOsContentBatchRole, string[]>> = {};
  for (const r of ALL_CONTENT_BATCH_ROLES) {
    const hints = buildPlatformHintsForContentRole(r, args.platformRoleRouting);
    if (hints.length) recommendedPlatformsByRole[r] = hints;
  }

  const counts = emptyCountsByRole();
  const items: RevenueOsRoutedContentItem[] = raw.map((piece) => {
    const { role, confidence, reason } = classifyContentForBatchRole({
      title: piece.title,
      body: piece.body,
      hook: piece.hook,
      cta: piece.cta,
      source: piece.source,
    });
    counts[role] += 1;
    const platformHints = buildPlatformHintsForContentRole(role, args.platformRoleRouting);
    return {
      ...piece,
      role,
      confidence,
      reason,
      platformHints: platformHints.length ? platformHints : undefined,
    };
  });

  let nextAction = buildNextActionLine(counts, recommendedPlatformsByRole, args.platformRoleRouting ?? null);
  if (args.optimizationMemoryGeneration?.platformRoleRoutingHint) {
    nextAction = `${nextAction} Memory hint: ${args.optimizationMemoryGeneration.platformRoleRoutingHint}`;
  }

  return {
    items,
    countsByRole: counts,
    recommendedPlatformsByRole,
    nextAction,
    roleHintsFromPlatformRouting,
  };
}

/** Persistable trace slice for unified generation snapshots (optional). */
export function toContentBatchRoutingTrace(
  summary: RevenueOsContentBatchRoutingSummary | null | undefined
): import("@/lib/revenue-os/unified-generation-types").ContentBatchRoutingTraceV1 | null {
  if (!summary?.items.length) return null;
  const rolesWithPlatformHints = ALL_CONTENT_BATCH_ROLES.filter(
    (r) => (summary.recommendedPlatformsByRole[r]?.length ?? 0) > 0
  );
  return {
    schemaVersion: 1,
    countsByRole: { ...summary.countsByRole },
    routingApplied: true,
    roleHintsFromPlatformRouting: summary.roleHintsFromPlatformRouting,
    rolesWithPlatformHints: rolesWithPlatformHints.length ? rolesWithPlatformHints : undefined,
  };
}
