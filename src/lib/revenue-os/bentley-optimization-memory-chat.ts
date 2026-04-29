/**
 * Bentley intents over stored optimization memory (weak priors from publish + metrics).
 */

import type { RevenueOsOptimizationMemorySummary } from "@/lib/revenue-os/post-optimization-memory-types";

export function isOptimizationMemoryIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\boptimization memory\b/.test(t)) return true;
  if (/\bwhat is bentley learning\b/.test(t)) return true;
  if (/\bwhat patterns? (are )?working\b/.test(t)) return true;
  if (/\bwhat should we do more of\b/.test(t)) return true;
  if (/\bwhat should we stop( doing)?\b/.test(t)) return true;
  if (/\bwhat hooks? (are )?performing\b/.test(t)) return true;
  if (/\bwhich hooks? (are )?performing\b/.test(t)) return true;
  if (/\bwhich platforms? (seem )?(strongest|best)\b/.test(t)) return true;
  if (/\bwhat platform is best\b/.test(t)) return true;
  if (/\bwhat should we focus on\b/.test(t)) return true;
  if (/\bstrongest repeat patterns?\b/.test(t)) return true;
  if (/\bweakest repeat patterns?\b/.test(t)) return true;
  if (/\blearned (from )?(publish|deployment|feedback)\b/.test(t)) return true;
  return false;
}

export function formatBentleyOptimizationMemoryReply(args: {
  summary: RevenueOsOptimizationMemorySummary;
  entryCount: number;
  debug?: boolean;
}): string {
  const { summary, entryCount, debug } = args;
  const lines: string[] = [];

  lines.push(
    "**Optimization memory** — weak priors from your publish rows and any synced metrics. This is **not** causal attribution; use it to bias drafts, not as proof."
  );

  if (entryCount === 0) {
    lines.push("No memory rows yet. After a few publishes (and optional metric sync), run **Refresh** on Step 4 → Optimization memory, or wait for the internal rebuild job.");
    lines.push("**Next:** publish from Launch, then refresh memory.");
    return lines.join("\n\n");
  }

  if (!summary.hasEnoughData) {
    lines.push(
      "**Data:** Still thin — I’m not treating patterns as reliable. Keep logging outcomes; memory will firm up after more publishes and metrics."
    );
  }

  const conf = summary.summaryConfidence ?? "low";
  const basis = summary.recommendationEvidenceBasis ?? "insufficient";
  lines.push(
    `**Evidence mix:** recommendation basis **${basis.replace(/_/g, " ")}** · summary confidence **${conf}** (not statistical certainty).`
  );
  if (summary.measuredStrongestAttentionPlatform || summary.measuredStrongestEngagementPlatform) {
    if (summary.measuredStrongestAttentionPlatform) {
      lines.push(
        `**Attention-led (impressions-style in-memory):** **${summary.measuredStrongestAttentionPlatform}** — not the same as engagement-only leaders on channels without reach fields.`
      );
    }
    if (summary.measuredStrongestEngagementPlatform) {
      lines.push(
        `**Engagement-led (action-style metrics in-memory):** **${summary.measuredStrongestEngagementPlatform}** — likes/comments/saves/clicks; do not read this as beating another channel’s impressions.`
      );
    }
    if (
      summary.measuredStrongestAttentionPlatform &&
      summary.measuredStrongestEngagementPlatform &&
      summary.measuredStrongestAttentionPlatform !== summary.measuredStrongestEngagementPlatform
    ) {
      lines.push(
        "**Both can be “winning” in different ways** — keep language directional; avoid “X beat Y” unless the metric basis matches."
      );
    }
    if (summary.crossPlatformComparisonConfidence) {
      lines.push(
        `**Cross-platform comparison confidence (memory):** **${summary.crossPlatformComparisonConfidence}** — conservative when unlike metrics are involved.`
      );
    }
  } else if (summary.measuredStrongestPlatform) {
    lines.push(
      `**Measured lean (live metrics in-memory, composite):** **${summary.measuredStrongestPlatform}** — use attention/engagement split above when present; composite can mix unlike fields.`
    );
  }
  if (summary.operationalStrongestPlatform && summary.operationalStrongestPlatform !== summary.measuredStrongestPlatform) {
    lines.push(
      `**Operational lean (publish-only / no measured proof in-memory):** **${summary.operationalStrongestPlatform}** — reliable delivery signal, not proof of creative dominance.`
    );
  }

  const igPref = summary.instagramMeasuredPreference;
  if (igPref?.active) {
    lines.push(
      `**${igPref.userHeadline}** — ${igPref.userWhy} **Confidence:** ${igPref.confidenceLabel} (still include other platforms; this is a mild default from synced metrics, not certainty).`
    );
    lines.push(
      "**Generation bias:** Lean slightly toward Instagram-style hooks/angles in the next batch when it fits the brief — do not drop LinkedIn or other channels."
    );
  }

  if (summary.strongestPatterns.length) {
    lines.push("**Stronger repeat signals (weighted toward measured channels when present):**");
    for (const e of summary.strongestPatterns.slice(0, 4)) {
      const plat = e.platform ?? "—";
      const q = e.evidenceQuality ? ` · ${e.evidenceQuality.replace(/_/g, " ")}` : "";
      const cf = e.confidence ? ` · ${e.confidence} confidence` : "";
      lines.push(
        `• **${plat}** (${e.outcomeKind})${q}${cf}: ${e.summary.slice(0, 200)}${e.summary.length > 200 ? "…" : ""}`
      );
    }
  } else {
    lines.push("**Stronger patterns:** none classified yet (need more informative outcomes).");
  }

  if (summary.weakestPatterns.length) {
    lines.push("**Weaker / riskier repeat signals:**");
    for (const e of summary.weakestPatterns.slice(0, 4)) {
      const plat = e.platform ?? "—";
      const q = e.evidenceQuality ? ` · ${e.evidenceQuality.replace(/_/g, " ")}` : "";
      lines.push(`• **${plat}** (${e.outcomeKind})${q}: ${e.summary.slice(0, 200)}${e.summary.length > 200 ? "…" : ""}`);
    }
  }

  const prefKeys = Object.keys(summary.platformPreferences);
  if (prefKeys.length) {
    lines.push("**Platform hints (from stronger buckets):**");
    for (const p of prefKeys.slice(0, 5)) {
      const hints = summary.platformPreferences[p]?.slice(0, 2) ?? [];
      lines.push(`• **${p}:** ${hints.join(" · ") || "aggregate"}`);
    }
  }

  lines.push(`**Next generation (one line):** ${summary.nextGenerationRecommendation}`);

  if (debug) {
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          entryCount,
          hasEnoughData: summary.hasEnoughData,
          strongestN: summary.strongestPatterns.length,
          weakestN: summary.weakestPatterns.length,
          summaryConfidence: summary.summaryConfidence,
          recommendationEvidenceBasis: summary.recommendationEvidenceBasis,
          measuredStrongestPlatform: summary.measuredStrongestPlatform ?? null,
          measuredStrongestAttentionPlatform: summary.measuredStrongestAttentionPlatform ?? null,
          measuredStrongestEngagementPlatform: summary.measuredStrongestEngagementPlatform ?? null,
          crossPlatformComparisonConfidence: summary.crossPlatformComparisonConfidence ?? null,
          measuredPlatformRoleHint: summary.measuredPlatformRoleHint ?? null,
          operationalStrongestPlatform: summary.operationalStrongestPlatform ?? null,
        },
        null,
        2
      )
    );
    lines.push("```");
  }

  lines.push("Open **Step 4 → Optimization memory** for the compact panel.");

  return lines.join("\n\n");
}
