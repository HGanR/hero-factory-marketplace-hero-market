/**
 * Deterministic mapping: launch day → guided UI actions (no API / LLM).
 */

import type {
  RevenueOsLaunchDayPlan,
  RevenueOsLaunchModePlan,
  RevenueOsLaunchSharedProfile,
} from "@/lib/revenue-os/launch-mode-types";

/** Stable scroll targets for Step 4 / pipeline (hash + element id). */
export const LAUNCH_SCROLL_IDS = {
  contentPipeline: "content-pipeline",
  workflowHandoff: "workflow-handoff",
  industryIntelligence: "industry-intelligence",
  researchAssistant: "research-assistant",
  trendsLibrary: "trends-library",
  consultantPlan: "consultant-plan",
  contentEngine: "content-engine",
  campaignFromNotes: "campaign-from-notes",
  campaignMediaBrief: "campaign-media-brief",
  variantOptimization: "launch-variant-optimization",
  distributionVolume: "launch-distribution-volume",
  pastGenerations: "launch-past-generations",
  sevenDayLaunch: "seven-day-launch-mode",
  aboutPage: "about-this-page",
} as const;

export type RevenueOsLaunchAction =
  | { kind: "scroll_to"; targetId: string; label: string }
  | { kind: "prefill_campaign_notes"; value: string; label: string }
  | { kind: "prefill_content_context"; payload: Record<string, unknown>; label: string }
  | { kind: "suggest_generate_content"; label: string }
  | { kind: "suggest_generate_campaign"; label: string }
  | { kind: "suggest_compile_media_brief"; label: string }
  | { kind: "suggest_batch_variations"; label: string }
  | { kind: "suggest_queue_review"; label: string };

function campaignNotesDraftForDay2(plan: RevenueOsLaunchModePlan): string {
  const lines: string[] = ["— Launch Mode · Day 2 positioning draft —"];
  if (plan.launchAngle) lines.push(`Lead angle: ${plan.launchAngle}`);
  if (plan.primaryOffer) lines.push(`Offer thread: ${plan.primaryOffer}`);
  lines.push("", "Hooks to test (15 words max each):", "1.", "2.", "3.", "", "Primary CTA (one destination):");
  return lines.join("\n");
}

function campaignNotesDraftForDay4(plan: RevenueOsLaunchModePlan): string {
  const lines: string[] = ["— Launch Mode · Day 4 CTA / deployment prep —"];
  if (plan.launchAngle) lines.push(`Angle in market: ${plan.launchAngle}`);
  lines.push(
    "",
    "Single CTA destination (URL, DM script, or calendar link):",
    "",
    "Lead capture: what happens after click?",
    "",
    "Deployment: note any sequence / funnel name you will use in the dashboard."
  );
  return lines.join("\n");
}

function audienceOfferDraft(shared: RevenueOsLaunchSharedProfile): Record<string, unknown> {
  return {
    targetAudience: shared.targetAudience.trim() || undefined,
    coreOffer: shared.coreOffer.trim() || undefined,
    transformation: shared.transformation.trim() || undefined,
  };
}

export function mapLaunchDayToActions(args: {
  dayPlan: RevenueOsLaunchDayPlan;
  launchPlan: RevenueOsLaunchModePlan;
  sharedProfile: RevenueOsLaunchSharedProfile;
}): RevenueOsLaunchAction[] {
  const { dayPlan, launchPlan, sharedProfile } = args;
  const day = dayPlan.day;
  const hasBlockers = launchPlan.readiness.blockers.length > 0 && !launchPlan.readiness.isReady;

  const openStep4: RevenueOsLaunchAction = {
    kind: "scroll_to",
    targetId: LAUNCH_SCROLL_IDS.contentPipeline,
    label: "Open Step 4 (pipeline)",
  };

  switch (day) {
    case 1:
      return [
        ...(hasBlockers
          ? [
              {
                kind: "scroll_to" as const,
                targetId: LAUNCH_SCROLL_IDS.sevenDayLaunch,
                label: "Review blockers in Launch Mode",
              },
            ]
          : []),
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.workflowHandoff,
          label: "Step 1 · Workflow & handoff",
        },
        openStep4,
        {
          kind: "prefill_content_context",
          payload: audienceOfferDraft(sharedProfile),
          label: "Prefill audience & offer from intake (safe)",
        },
      ];
    case 2:
      return [
        openStep4,
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.researchAssistant,
          label: "Research Assistant",
        },
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.trendsLibrary,
          label: "Trends Library",
        },
        {
          kind: "prefill_campaign_notes",
          value: campaignNotesDraftForDay2(launchPlan),
          label: "Prefill campaign notes (hooks & CTA outline)",
        },
        {
          kind: "suggest_generate_campaign",
          label: "When notes feel solid, run Generate Campaign in Campaign section",
        },
      ];
    case 3:
      return [
        openStep4,
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.contentEngine,
          label: "Content Engine",
        },
        {
          kind: "suggest_generate_content",
          label: "Generate posts/assets for your chosen hooks — batch formats per platform",
        },
      ];
    case 4:
      return [
        openStep4,
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.campaignFromNotes,
          label: "Campaign from notes",
        },
        {
          kind: "prefill_campaign_notes",
          value: campaignNotesDraftForDay4(launchPlan),
          label: "Prefill CTA / deployment prep notes",
        },
        {
          kind: "suggest_generate_campaign",
          label: "Generate campaign output from assembled intelligence",
        },
        {
          kind: "suggest_compile_media_brief",
          label: "Compile Media Brief when campaign output exists",
        },
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.campaignMediaBrief,
          label: "Jump to Media Brief block",
        },
      ];
    case 5:
      return [
        openStep4,
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.distributionVolume,
          label: "Distribution & volume (queue / cadence)",
        },
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.contentEngine,
          label: "Review assets before publish",
        },
        {
          kind: "suggest_queue_review",
          label: "Confirm posting queue and platform alignment, then publish first wave",
        },
      ];
    case 6:
      return [
        openStep4,
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.variantOptimization,
          label: "Variant optimization",
        },
        {
          kind: "suggest_batch_variations",
          label: "Create variations on the winning hook; trim underperformers",
        },
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.pastGenerations,
          label: "Past generations (reuse winners)",
        },
        {
          kind: "suggest_queue_review",
          label: "Re-check distribution queue after edits",
        },
      ];
    case 7:
      return [
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.sevenDayLaunch,
          label: "Launch Mode (refresh plan)",
        },
        {
          kind: "scroll_to",
          targetId: LAUNCH_SCROLL_IDS.aboutPage,
          label: "Step 5 · Reference & next-cycle planning",
        },
        {
          kind: "suggest_queue_review",
          label: "Update traffic / conversion / AOV in intake, then dashboard review",
        },
      ];
    default:
      return [openStep4];
  }
}

/**
 * Prefer a specific section over the generic Step 4 accordion opener when handing off from Bentley.
 */
export function getLaunchDayScrollTargetForBentley(args: {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  dayPlan: RevenueOsLaunchDayPlan;
  launchPlan: RevenueOsLaunchModePlan;
  sharedProfile: RevenueOsLaunchSharedProfile;
}): string {
  const actions = mapLaunchDayToActions(args);
  const secondary = actions.find(
    (a): a is Extract<RevenueOsLaunchAction, { kind: "scroll_to" }> =>
      a.kind === "scroll_to" && a.targetId !== LAUNCH_SCROLL_IDS.contentPipeline
  );
  if (secondary) return secondary.targetId;
  const first = actions.find((a): a is Extract<RevenueOsLaunchAction, { kind: "scroll_to" }> => a.kind === "scroll_to");
  return first?.targetId ?? LAUNCH_SCROLL_IDS.contentPipeline;
}

/** Debug: summarize actions for observability. */
export function summarizeLaunchDayActionsForDebug(actions: RevenueOsLaunchAction[]): {
  kinds: string[];
  scrollTargets: string[];
  prefillAvailable: { campaignNotes: boolean; contentKeys: string[] };
} {
  const kinds = actions.map((a) => a.kind);
  const scrollTargets = actions.filter((a): a is Extract<RevenueOsLaunchAction, { kind: "scroll_to" }> => a.kind === "scroll_to").map((a) => a.targetId);
  let campaignNotes = false;
  const contentKeys: string[] = [];
  for (const a of actions) {
    if (a.kind === "prefill_campaign_notes") campaignNotes = true;
    if (a.kind === "prefill_content_context") {
      contentKeys.push(...Object.keys(a.payload).filter((k) => a.payload[k] != null && a.payload[k] !== ""));
    }
  }
  return { kinds, scrollTargets, prefillAvailable: { campaignNotes, contentKeys } };
}
