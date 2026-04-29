/**
 * Deterministic batch → calendar sequencing (no LLM / no API).
 */

import type { RevenueOsContentBatchRoutingSummary } from "@/lib/revenue-os/content-batch-routing-types";
import {
  ALL_CONTENT_BATCH_ROLES,
  type RevenueOsContentBatchRole,
} from "@/lib/revenue-os/content-batch-routing-types";
import type {
  RevenueOsBatchCalendarSequence,
  RevenueOsBatchCalendarSequenceDiagnostics,
  RevenueOsBatchSequenceSlot,
} from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import { buildPlatformHintsForContentRole } from "@/lib/revenue-os/route-generated-content-into-batches";

export type BuildContentBatchCalendarSequenceArgs = {
  batchRouting: RevenueOsContentBatchRoutingSummary;
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null | undefined;
  launchPlan?: RevenueOsLaunchModePlan | null;
  systemSignals?: RevenueOsSystemSignals | null;
};

function capPlat(p: string): string {
  const t = p.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Lead-capture slot only when platform routing shows measured lead path (not clicks-only / insufficient). */
export function allowLeadCaptureInSequence(routing: RevenueOsPlatformRoleRoutingSummary | null | undefined): boolean {
  const lc = routing?.recommendations?.find((r) => r.role === "lead_capture");
  return lc?.evidenceBasis === "measured_engagement";
}

function shouldAuthorityFirst(
  routing: RevenueOsPlatformRoleRoutingSummary | null | undefined,
  systemSignals: RevenueOsSystemSignals | null | undefined
): boolean {
  if (!routing?.recommendations?.length) return false;
  const att = routing.recommendations.find((r) => r.role === "attention");
  const auth = routing.recommendations.find((r) => r.role === "authority");
  if (!att || !auth) return false;
  const attWeak =
    att.confidence === "low" || att.evidenceBasis === "insufficient_data" || !att.preferredPlatform;
  const authStrong =
    auth.preferredPlatform &&
    auth.evidenceBasis !== "insufficient_data" &&
    (auth.confidence === "high" ||
      auth.confidence === "medium" ||
      (auth.confidence === "low" && auth.evidenceBasis === "measured_engagement"));
  const traffic = systemSignals?.trafficReadinessScore;
  const trafficOk = traffic == null || traffic >= 55;
  return Boolean(attWeak && authStrong && trafficOk);
}

function preferredPlatformsForRole(
  role: RevenueOsContentBatchRole,
  batchRouting: RevenueOsContentBatchRoutingSummary,
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null | undefined
): string[] {
  const fromBatch = batchRouting.recommendedPlatformsByRole[role]?.filter(Boolean) ?? [];
  const fromRouting = buildPlatformHintsForContentRole(role, platformRoleRouting ?? null);
  const merged = [...fromRouting, ...fromBatch];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of merged) {
    const k = p.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(capPlat(p));
  }
  return out;
}

function slotConfidenceForRole(
  role: RevenueOsContentBatchRole,
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null | undefined
): "high" | "medium" | "low" {
  const rec = platformRoleRouting?.recommendations?.find((r) => r.role === role);
  if (rec?.confidence) return rec.confidence;
  if (role === "lead_capture") return "low";
  return "medium";
}

function buildRoleReason(
  role: RevenueOsContentBatchRole,
  authFirst: boolean,
  slotConfidence: "high" | "medium" | "low",
  isFollowUp: boolean
): string {
  const dir =
    slotConfidence === "low"
      ? "Directional order only — measured channel evidence is thin; adjust to your calendar."
      : "Suggested pass based on role routing + batch makeup.";
  if (isFollowUp && role === "engagement") {
    return `Second **engagement** beat for conversation depth. ${dir}`;
  }
  if (isFollowUp && role === "authority") {
    return `Second **authority** beat to reinforce proof/framework. ${dir}`;
  }
  if (role === "lead_capture") {
    return `**Lead capture** after attention/authority/engagement rhythm — only included because conversion-style evidence exists. ${dir}`;
  }
  if (role === "distribution_support") {
    return `**Distribution / recap** — volume, repurposing, or operational follow-through. ${dir}`;
  }
  if (authFirst && role === "authority" && !isFollowUp) {
    return `**Authority-first** start — measured signals favor credibility before broad reach. ${dir}`;
  }
  if (role === "attention") {
    return `**Attention** — hook-first placement to earn reach before deeper frames. ${dir}`;
  }
  if (role === "authority") {
    return `**Authority** — proof, framework, or explainer after initial visibility. ${dir}`;
  }
  return `**Engagement** — conversation, opinion, or comment-led content. ${dir}`;
}

/**
 * Map 0-based slot order into launch day numbers (1–7) without overfitting.
 */
export function alignSequenceSlotsToLaunchDays(
  slotCount: number,
  launchPlan: RevenueOsLaunchModePlan | null | undefined
): number[] {
  const nDays = launchPlan?.days?.length ? Math.min(7, launchPlan.days.length) : 0;
  if (!nDays || slotCount === 0) {
    return Array.from({ length: slotCount }, (_, i) => i + 1);
  }
  const out: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    if (i === 0) out.push(1);
    else if (i === 1) out.push(Math.min(2, nDays));
    else if (i === 2) out.push(Math.min(3, nDays));
    else if (i === 3) out.push(Math.min(4, nDays));
    else {
      const span = Math.max(0, nDays - 4);
      const step = span > 0 ? Math.floor(((i - 3) * span) / Math.max(1, slotCount - 3)) : 0;
      out.push(Math.min(nDays, 5 + step));
    }
  }
  return out;
}

type PlannedRole = { role: RevenueOsContentBatchRole; followUp?: boolean };

function planRoles(args: {
  counts: Record<RevenueOsContentBatchRole, number>;
  authorityFirst: boolean;
  allowLead: boolean;
}): PlannedRole[] {
  const { counts, authorityFirst, allowLead } = args;
  const coreOrder: RevenueOsContentBatchRole[] = authorityFirst
    ? ["authority", "attention", "engagement"]
    : ["attention", "authority", "engagement"];

  const planned: PlannedRole[] = [];
  for (const r of coreOrder) {
    if (counts[r] > 0) planned.push({ role: r });
  }

  let followEng = counts.engagement > 1;
  let followAuth = counts.authority > 1;
  if (!followEng && !followAuth && counts.engagement > 0 && counts.authority > 0) {
    followEng = true;
  }
  if (followEng && counts.engagement > 0) {
    planned.push({ role: "engagement", followUp: true });
  } else if (followAuth && counts.authority > 0) {
    planned.push({ role: "authority", followUp: true });
  }

  if (allowLead && counts.lead_capture > 0) {
    planned.push({ role: "lead_capture" });
  }

  if (counts.distribution_support > 0) {
    planned.push({ role: "distribution_support" });
  }

  return planned;
}

/**
 * Build ordered calendar slots from routed batches + platform-role routing.
 */
export function buildContentBatchCalendarSequence(
  args: BuildContentBatchCalendarSequenceArgs
): RevenueOsBatchCalendarSequence {
  const { batchRouting, platformRoleRouting, launchPlan, systemSignals } = args;
  const counts = { ...batchRouting.countsByRole };
  const allowLead = allowLeadCaptureInSequence(platformRoleRouting ?? null);
  const authorityFirst = shouldAuthorityFirst(platformRoleRouting ?? null, systemSignals ?? null);
  const leadSuppressed = counts.lead_capture > 0 && !allowLead;

  const planned = planRoles({ counts, authorityFirst, allowLead });

  const idQueues: Record<RevenueOsContentBatchRole, string[]> = {} as Record<
    RevenueOsContentBatchRole,
    string[]
  >;
  for (const r of ALL_CONTENT_BATCH_ROLES) {
    idQueues[r] = batchRouting.items.filter((i) => i.role === r).map((i) => i.id).filter(Boolean) as string[];
  }

  const slots: RevenueOsBatchSequenceSlot[] = [];
  for (const p of planned) {
    const role = p.role;
    const take = Math.min(1, idQueues[role].length);
    const ids = take > 0 ? [idQueues[role].shift()!] : [];
    const preferredPlatforms = preferredPlatformsForRole(role, batchRouting, platformRoleRouting);
    const conf = slotConfidenceForRole(role, platformRoleRouting);
    slots.push({
      dayIndex: 0,
      role,
      preferredPlatforms,
      confidence: preferredPlatforms.length ? conf : "low",
      reason: buildRoleReason(role, authorityFirst, preferredPlatforms.length ? conf : "low", Boolean(p.followUp)),
      itemIds: ids.length ? ids : undefined,
    });
  }

  const launchAlignmentApplied = Boolean(launchPlan?.days?.length && launchPlan.days.length >= 3);
  const dayIndices = alignSequenceSlotsToLaunchDays(slots.length, launchPlan ?? null);
  for (let i = 0; i < slots.length; i++) {
    slots[i] = { ...slots[i]!, dayIndex: dayIndices[i] ?? i + 1 };
  }

  const withContent = ALL_CONTENT_BATCH_ROLES.filter((r) => counts[r] > 0);
  const slotted = new Set(planned.map((x) => x.role));
  const omitted = withContent.filter((r) => !slotted.has(r));

  const strategy = [
    authorityFirst ? "authority_first" : "attention_first",
    launchAlignmentApplied ? "launch_days_aligned" : "linear_days",
    allowLead ? "lead_when_justified" : "lead_suppressed",
  ].join("; ");

  const summary =
    slots.length === 0
      ? "No routed batch items yet — generate campaign, content, or launch copy before sequencing."
      : `**${slots.length}-step** calendar rhythm: ${slots.map((s) => s.role.replace(/_/g, " ")).join(" → ")}. ${
          authorityFirst
            ? "Starting with **authority** because measured signals favor credibility over raw reach."
            : "Starting with **attention**, then **authority**, then **engagement**."
        } ${leadSuppressed ? "Lead-capture beats are **deferred** until conversion evidence exists." : ""} ${
          launchAlignmentApplied
            ? "Days are **loosely mapped** to your 7-day launch plan (directional, not rigid)."
            : "Day numbers advance in order — connect to launch mode when available."
        }`.trim();

  const diagnostics: RevenueOsBatchCalendarSequenceDiagnostics = {
    slotCount: slots.length,
    rolesOmittedLowSignal: omitted,
    leadCaptureSuppressed: leadSuppressed,
    launchAlignmentApplied,
    authorityFirstApplied: authorityFirst,
  };

  return {
    slots,
    sequencingStrategy: strategy,
    summary,
    diagnostics,
  };
}
