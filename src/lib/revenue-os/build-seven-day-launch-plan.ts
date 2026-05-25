/**
 * Deterministic 7-day launch plan from Revenue OS context (no API / LLM).
 */

import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import type { BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import {
  buildSystemSignalDiagnosticSummary,
  shouldSuggestSevenDayLaunch,
  type BentleySystemId,
} from "@/lib/revenue-os/bentley-system-signal-diagnostics";
import type {
  RevenueOsLaunchDayPlan,
  RevenueOsLaunchModePlan,
  RevenueOsLaunchModeReadiness,
  RevenueOsLaunchSharedProfile,
} from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

function clamp(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function trendAngle(trends: TrendsResponse | null | undefined): string | undefined {
  if (!trends?.campaignAngles?.length) return undefined;
  const a = trends.campaignAngles.find((x) => String(x).trim().length > 0);
  return a ? clamp(String(a), 120) : undefined;
}

function researchHook(research: ResearchResult | null | undefined): string | undefined {
  if (!research) return undefined;
  if (research.whatPeopleWant?.length) {
    const w = research.whatPeopleWant.find((x) => String(x).trim().length > 3);
    if (w) return clamp(String(w), 140);
  }
  if (research.marketOrService?.trim()) return clamp(research.marketOrService, 120);
  return undefined;
}

function workflowContentReady(wf: BentleyWorkflowState | null | undefined): boolean {
  if (!wf) return false;
  return Boolean(wf.completed?.content || wf.artifacts?.contentEngine);
}

function workflowCampaignReady(wf: BentleyWorkflowState | null | undefined): boolean {
  if (!wf) return false;
  return Boolean(wf.completed?.campaign_generation || wf.artifacts?.campaign);
}

function profileStr(profile: RevenueOsLaunchSharedProfile, key: keyof RevenueOsLaunchSharedProfile): string {
  if (key === "postingPlatforms") return "";
  return coerceTrimmedString(profile[key]);
}

export function computeLaunchModeReadiness(
  systemSignals: RevenueOsSystemSignals,
  profile: RevenueOsLaunchSharedProfile
): RevenueOsLaunchModeReadiness {
  const blockers: string[] = [];
  const strengths: string[] = [];
  const diag = buildSystemSignalDiagnosticSummary(systemSignals);
  strengths.push(...diag.opportunities.slice(0, 4));

  const businessName = profileStr(profile, "businessName");
  const coreOffer = profileStr(profile, "coreOffer");
  const targetAudience = profileStr(profile, "targetAudience");

  const { opportunityScore, offerStrengthScore, trafficReadinessScore, executionGapScore, capitalReadinessScore } =
    systemSignals;

  if (opportunityScore === undefined) blockers.push("Opportunity score not available — run Research / Trends (Step 3).");
  if (offerStrengthScore === undefined) blockers.push("Offer score not available — complete guided offer fields (Step 4).");
  if (trafficReadinessScore === undefined)
    blockers.push("Traffic readiness not scored — pick platforms and generate content (Step 4).");
  if (executionGapScore === undefined)
    blockers.push("Execution gap not scored — finish pipeline steps or run the automated pipeline.");

  if (opportunityScore !== undefined && opportunityScore < 65) {
    blockers.push("Opportunity signal is below the launch-ready band (target ≥ 65) — deepen industry validation.");
  }
  if (offerStrengthScore !== undefined && offerStrengthScore < 60) {
    blockers.push("Offer clarity is below launch-ready (target ≥ 60) — tighten core offer and transformation.");
  }
  if (trafficReadinessScore !== undefined && trafficReadinessScore < 60) {
    blockers.push("Traffic readiness is below launch-ready (target ≥ 60) — add channels and content assets.");
  }
  if (executionGapScore !== undefined && executionGapScore > 55) {
    blockers.push("Execution gap is still wide (target ≤ 55) — complete content → campaign → deployment sequence.");
  }

  if (!businessName) blockers.push("Add a business name in guided intake.");
  if (coreOffer.length < 12) blockers.push("Strengthen core offer text (needs a clearer promise).");
  if (targetAudience.length < 10) blockers.push("Define target audience so messaging and channels match.");

  if (capitalReadinessScore !== undefined && capitalReadinessScore < 30) {
    blockers.push("Capital layer is very light — keep paid scale conservative until unit economics are documented.");
  }

  const isReady =
    shouldSuggestSevenDayLaunch(systemSignals) &&
    businessName.length >= 2 &&
    coreOffer.length >= 12 &&
    targetAudience.length >= 10;

  if (isReady && strengths.length === 0) {
    strengths.push("Five-system scores are in the launch-ready band.");
  }

  return { isReady, blockers: blockers.slice(0, 12), strengths: strengths.slice(0, 8) };
}

/** Debug: dominant strength when ready, otherwise weakest signal to tighten first. */
export function getLaunchReadinessContributorForDebug(
  systemSignals: RevenueOsSystemSignals,
  readiness: RevenueOsLaunchModeReadiness
): { role: "strength" | "limiter"; system: BentleySystemId | null } {
  const d = buildSystemSignalDiagnosticSummary(systemSignals);
  if (readiness.isReady) return { role: "strength", system: d.strongestSystem };
  return { role: "limiter", system: d.weakestSystem };
}

function buildDays(params: {
  profile: RevenueOsLaunchSharedProfile;
  readiness: RevenueOsLaunchModeReadiness;
  signals: RevenueOsSystemSignals;
  launchAngle?: string;
  wf: BentleyWorkflowState | null | undefined;
}): RevenueOsLaunchDayPlan[] {
  const { profile, readiness, signals, launchAngle, wf } = params;
  const brand = profile.businessName.trim() || "your business";
  const offerHint = profile.coreOffer.trim() || "your core offer";
  const aud = profile.targetAudience.trim() || "your ideal buyer";
  const weakOffer = (signals.offerStrengthScore ?? 0) < 55;
  const highGap = (signals.executionGapScore ?? 0) > 50;
  const contentDone = workflowContentReady(wf);
  const campaignDone = workflowCampaignReady(wf);

  const d1Tasks = weakOffer
    ? [
        `Rewrite “${clamp(offerHint, 40)}” into one sentence: outcome, who it’s for, and why now.`,
        `Validate “${aud}” against research/trends — remove vague adjectives.`,
        "List three objections buyers voice before they say yes.",
      ]
    : [
        `Align ${brand} messaging with “${clamp(offerHint, 48)}” — one hero promise + proof hint.`,
        `Confirm “${aud}” is specific enough to choose channels and hooks.`,
        "Draft three proof points (results, process, or credibility).",
      ];

  const d2Extra = launchAngle
    ? [`Angle to test: "${launchAngle}"`]
    : ["Pick one contrarian or urgency hook tied to demand you already validated."];

  const days: RevenueOsLaunchDayPlan[] = [
    {
      day: 1,
      title: "Clarify offer + audience",
      objective: `Make the offer and audience undeniable for ${brand}.`,
      tasks: d1Tasks,
      deliverables: ["One-line offer statement", "Audience snapshot (who / pain / desired outcome)", "Objection list"],
      recommendedStep: 4,
    },
    {
      day: 2,
      title: "Finalize positioning + hooks",
      objective: "Lock the story buyers will repeat back to you.",
      tasks: [
        ...d2Extra,
        "Write 3 hook variants (15 words max) for short-form.",
        "Map each hook to a single CTA (DM, link, or lead magnet).",
      ],
      deliverables: ["Positioning paragraph", "Hook bank (3)", "CTA map"],
      recommendedStep: 3,
    },
    {
      day: 3,
      title: "Generate content assets",
      objective: "Ship enough creative to test, not to perfect.",
      tasks: contentDone
        ? [
            "Refresh or extend existing Content Engine outputs for the chosen hooks.",
            "Export captions + shot list; align with posting platforms you selected.",
          ]
        : [
            "Run Content Engine (Step 4) for at least two hooks.",
            "Batch native formats per platform (9:16 short-form + one static or carousel if relevant).",
          ],
      deliverables: ["Minimum 3 posts worth of assets", "Caption set per platform"],
      recommendedStep: 4,
    },
    {
      day: 4,
      title: "Prepare lead capture + deployment path",
      objective: "Remove friction between attention and action.",
      tasks: highGap
        ? [
            "Finish campaign notes → generate campaign → media brief if anything is still open.",
            "Confirm landing or DM path matches the CTA from Day 2.",
            "Open Revenue OS Dashboard → Deployment Center and verify sequences are unblocked.",
          ]
        : [
            "Wire CTA to a single destination (calendar, checkout, or DM script).",
            "Pre-load Deployment Center sequences; dry-run one funnel path.",
            "Set tracking: UTM or simple spreadsheet for leads.",
          ],
      deliverables: ["Working CTA path", "Deployment checklist", "Tracking sheet"],
      recommendedStep: campaignDone ? null : 4,
    },
    {
      day: 5,
      title: "Publish first wave",
      objective: "Get signal from the market, not applause.",
      tasks: [
        `Post first wave on ${profile.postingPlatforms.length ? profile.postingPlatforms.join(", ") : "your primary channels"}.`,
        "Reply to every comment in the first 2 hours where possible.",
        "Log what people ask — that’s the next content batch.",
      ],
      deliverables: ["Live posts", "Engagement log", "Follow-up prompts"],
      recommendedStep: null,
    },
    {
      day: 6,
      title: "Monitor + optimize",
      objective: "Double down on what earns DMs or clicks.",
      tasks: [
        "Compare hooks by saves, shares, and outbound DMs — not vanity views alone.",
        "Cut or rewrite the bottom performer; remix the winner with a new CTA.",
        "Adjust posting times using one platform’s native analytics.",
      ],
      deliverables: ["Quick performance snapshot", "One iteration shipped"],
      recommendedStep: null,
    },
    {
      day: 7,
      title: "Review results + expand",
      objective: "Decide scale vs. pivot with numbers.",
      tasks: [
        "Update traffic / conversion / AOV assumptions if you captured leads or sales.",
        readiness.isReady
          ? "Plan week two: either add budget, add channel, or deepen offer ladder."
          : "Close remaining blockers before scaling spend — see readiness list in Launch Mode panel.",
        "Schedule a dashboard review or Run Full Analysis when numbers exist.",
      ],
      deliverables: ["7-day recap (3 bullets)", "Next-week hypothesis", "Optional dashboard run"],
      recommendedStep: 5,
    },
  ];

  return days;
}

export function buildSevenDayLaunchPlan(args: {
  systemSignals: RevenueOsSystemSignals;
  sharedProfile: RevenueOsLaunchSharedProfile;
  trendsResult?: TrendsResponse | null;
  researchResult?: ResearchResult | null;
  workflowState?: BentleyWorkflowState | null;
}): RevenueOsLaunchModePlan {
  const { systemSignals, sharedProfile, trendsResult, researchResult, workflowState } = args;
  const readiness = computeLaunchModeReadiness(systemSignals, sharedProfile);
  const trendA = trendAngle(trendsResult ?? undefined);
  const resHook = researchHook(researchResult ?? undefined);
  const launchAngle = trendA ?? resHook;

  const primaryOffer = [profileStr(sharedProfile, "coreOffer"), profileStr(sharedProfile, "transformation")]
    .filter(Boolean)
    .join(" → ")
    .slice(0, 220) || undefined;
  const targetAudience = profileStr(sharedProfile, "targetAudience") || undefined;

  const industryBit = profileStr(sharedProfile, "industry");
  const summaryParts: string[] = [
    `${profileStr(sharedProfile, "businessName") || "Your business"} — 7-day launch sprint`,
    industryBit ? `Industry focus: ${clamp(industryBit, 80)}.` : "",
    readiness.isReady
      ? "Signals show you’re in a launch-ready band: execute the week linearly — clarify, create, deploy, then read results."
      : "You can still run this plan, but treat Week 1 as prep: close readiness blockers before heavy spend.",
    launchAngle ? `Lead with: ${launchAngle}` : "",
  ];

  const days = buildDays({
    profile: sharedProfile,
    readiness,
    signals: systemSignals,
    launchAngle,
    wf: workflowState,
  });

  return {
    summary: summaryParts.filter(Boolean).join(" "),
    primaryOffer,
    targetAudience,
    launchAngle,
    days,
    readiness,
  };
}

export function formatSevenDayLaunchPlanPlain(plan: RevenueOsLaunchModePlan): string {
  const lines: string[] = [
    plan.summary,
    "",
    `Readiness: ${plan.readiness.isReady ? "READY" : "NOT READY"}`,
    plan.readiness.strengths.length ? `Strengths: ${plan.readiness.strengths.join(" | ")}` : "",
    plan.readiness.blockers.length ? `Blockers: ${plan.readiness.blockers.join(" | ")}` : "",
    "",
  ];
  for (const d of plan.days) {
    lines.push(`Day ${d.day} — ${d.title}`);
    lines.push(`Objective: ${d.objective}`);
    lines.push("Tasks:");
    d.tasks.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
    lines.push("Deliverables:");
    d.deliverables.forEach((x, i) => lines.push(`  ${i + 1}. ${x}`));
    if (d.recommendedStep != null) lines.push(`Go to Step: ${d.recommendedStep}`);
    lines.push("");
  }
  return lines.filter((l) => l !== "").join("\n");
}

export function formatBentleyLaunchPlanChatReply(
  plan: RevenueOsLaunchModePlan,
  options?: { includeFullPlan?: boolean }
): string {
  const head = [
    "**7-day launch path**",
    "",
    plan.summary,
    "",
    plan.readiness.isReady
      ? "**Readiness:** You’re green to treat this as a live launch week — still ship Day 1–2 before you scale spend."
      : "**Readiness:** Not fully green yet — address the blockers below before you treat this as a hard launch.",
  ];

  if (!plan.readiness.isReady && plan.readiness.blockers.length) {
    head.push("", "**Blockers (fix these first):**");
    plan.readiness.blockers.slice(0, 5).forEach((b) => head.push(`• ${b}`));
  } else if (plan.readiness.strengths.length) {
    head.push("", "**What’s working:**");
    plan.readiness.strengths.slice(0, 3).forEach((s) => head.push(`• ${s}`));
  }

  head.push(
    "",
    "**Next step:** Scroll to **7-Day Launch Mode** (below System diagnostics), tap **Generate Launch Plan**, then execute **Day 1**."
  );

  let out = head.join("\n");

  if (options?.includeFullPlan) {
    out += `\n\n---\n\n${formatSevenDayLaunchPlanPlain(plan)}`;
  }

  return out;
}
