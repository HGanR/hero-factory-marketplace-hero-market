/**
 * Bentley: explain generated content by business-role batches.
 */

import type { RevenueOsContentBatchRoutingSummary } from "@/lib/revenue-os/content-batch-routing-types";
import { routeGeneratedContentIntoBatches } from "@/lib/revenue-os/route-generated-content-into-batches";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";

export function isContentBatchRoutingIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\b(platform role|which platform for)\b/.test(t) && !/\bcontent\b/.test(t)) return false;
  if (
    /\bwhat kind of content (did we|have we) generate\b/.test(t) ||
    /\bwhich posts? (are )?for awareness\b/.test(t) ||
    /\bwhich (posts?|content) (are )?for engagement\b/.test(t) ||
    /\bwhich batch should go to\b/.test(t) ||
    /\bwhich content should i post first\b/.test(t) ||
    /\bcontent batch(es)?\b/.test(t) ||
    /\bhow is my content (routed|batched|grouped)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

export function formatBentleyContentBatchRoutingReply(args: {
  batchSummary: RevenueOsContentBatchRoutingSummary;
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null;
  debug?: boolean;
}): string {
  const { batchSummary, platformRoleRouting, debug } = args;
  const lines: string[] = [];
  lines.push(
    "**Content batches** — your generated copy grouped by **job-to-be-done** (attention, engagement, authority, lead capture, distribution). This is deterministic routing from hook/CTA language, not a creative judgment."
  );

  if (!batchSummary.items.length) {
    lines.push(
      "No routable generated pieces in the current workflow snapshot (need a campaign, content bundle, launch plan, or media brief in Step 4 artifacts)."
    );
    lines.push("**Next:** run **Generate Campaign** or **Content Engine**, then ask again.");
    return lines.join("\n\n");
  }

  lines.push("**Counts by role:**");
  for (const [role, n] of Object.entries(batchSummary.countsByRole)) {
    if (n > 0) lines.push(`• **${role.replace(/_/g, " ")}:** ${n}`);
  }

  lines.push("**Preferred platforms (from measured role routing, hints only):**");
  const rec = batchSummary.recommendedPlatformsByRole;
  const roles = Object.keys(rec) as (keyof typeof rec)[];
  if (!roles.length) {
    lines.push("• No measured platform leaders yet — sync metrics or widen scope before trusting channel hints.");
  } else {
    for (const r of roles) {
      const plats = rec[r]?.join(", ") ?? "";
      lines.push(`• **${String(r).replace(/_/g, " ")}:** ${plats || "—"}`);
    }
  }

  lines.push(`**Tactical recommendation:** ${batchSummary.nextAction}`);

  if (batchSummary.countsByRole.lead_capture > 0 && platformRoleRouting) {
    const lc = platformRoleRouting.recommendations.find((x) => x.role === "lead_capture");
    if (lc?.evidenceBasis === "insufficient_data") {
      lines.push(
        "**Lead batch caution:** deployment data does **not** support a strong lead-capture winner — run CTAs as tests, not as a forced funnel batch."
      );
    }
  }

  const lowConf = batchSummary.items.filter((i) => i.confidence === "low");
  if (lowConf.length && lowConf.length <= batchSummary.items.length) {
    lines.push(
      `**Note:** ${lowConf.length} piece(s) are **low-confidence** role tags — refine hooks/CTAs if a bucket feels wrong.`
    );
  }

  if (debug) {
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          itemCount: batchSummary.items.length,
          countsByRole: batchSummary.countsByRole,
          roleHintsFromPlatformRouting: batchSummary.roleHintsFromPlatformRouting,
          items: batchSummary.items.map((i) => ({
            role: i.role,
            confidence: i.confidence,
            source: i.source,
            title: i.title?.slice(0, 80),
          })),
        },
        null,
        2
      )
    );
    lines.push("```");
  }

  lines.push("Open **Step 4 → Content batch routing** for the panel.");

  return lines.join("\n\n");
}

export function buildContentBatchRoutingForWorkflow(args: {
  contentEngineResult?: import("@/lib/revenue-os/content-engine-types").ContentEngineOutput | null;
  campaignResult?: import("@/lib/revenue-os/campaign-schema").CampaignResponse | null;
  launchPlan?: import("@/lib/revenue-os/launch-mode-types").RevenueOsLaunchModePlan | null;
  mediaBrief?: string | null;
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null;
  optimizationMemoryGeneration?: import("@/lib/revenue-os/post-optimization-memory-types").OptimizationMemoryGenerationSlice | null;
}): RevenueOsContentBatchRoutingSummary {
  return routeGeneratedContentIntoBatches({
    contentEngineResult: args.contentEngineResult,
    campaignResult: args.campaignResult,
    launchPlan: args.launchPlan,
    mediaBrief: args.mediaBrief,
    platformRoleRouting: args.platformRoleRouting,
    optimizationMemoryGeneration: args.optimizationMemoryGeneration ?? null,
  });
}
