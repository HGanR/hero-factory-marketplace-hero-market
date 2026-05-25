/**
 * Derived readiness for AI Revenue OS page sections (BentleySnapshot / shared state only).
 */

import { INDUSTRY_PROFILES } from "@/lib/revenue-os/industry-profiles";
import type { BentleyChecklistId, BentleyFieldKey, BentleyWorkflowPhase } from "@/lib/revenue-os/bentley-flow-types";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  BENTLEY_PROMPT_ORDER,
  completedMilestoneForPhaseLeft,
  fieldLabelShort,
  fieldSatisfied,
  getFirstMissingField,
  industryResolved,
  phaseLabel,
  questionForField,
  structuredGuidedIntakeCompleteForCampaign,
} from "@/lib/revenue-os/bentley-orchestrator";
import { BENTLEY_CAMPAIGN_NOTES_MIN } from "@/lib/revenue-os/bentley-auto-campaign-notes";
import type { BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { getFirstIncompleteWorkflowPhase } from "@/lib/revenue-os/bentley-workflow";
import { pipelinePhaseLabel } from "@/lib/revenue-os/bentley-pipeline-progress";
import type { AdvanceBentleyPipelineStageResult } from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export type AiRevenueSectionKey = "research" | "trends" | "contentEngine" | "campaign";

export type SectionReadinessStatus = "ready" | "needs_input";

export type SectionReadiness = {
  status: SectionReadinessStatus;
  summary: string;
  nextActionLabel: string;
};

export function effectiveIndustryLabelFromSnapshot(s: BentleySnapshot): string {
  const fromProfile =
    s.industryKey != null ? (INDUSTRY_PROFILES[s.industryKey]?.label ?? "") : "";
  return coerceTrimmedString(s.contentIndustry) || coerceTrimmedString(fromProfile);
}

function milestoneNarrativeForChecklist(id: BentleyChecklistId): string {
  const m: Record<BentleyChecklistId, string> = {
    intake: "Intake is complete — industry and audience are saved.",
    revenue_inputs:
      "Revenue inputs are set or skipped — you can refine traffic, conversion, and AOV later in **Industry Intelligence**; the revenue model can still be completed anytime.",
    content_profile: "Content profile is complete — offer, transformation, and platforms are aligned for Content Engine.",
    campaign_notes:
      "Campaign notes are saved or skipped — generation works with less context if notes were skipped.",
    ready_to_run: "All guided steps are done — you can run the page actions in order.",
  };
  return m[id];
}

export function getSectionReadiness(s: BentleySnapshot): Record<AiRevenueSectionKey, SectionReadiness> {
  const industryText = effectiveIndustryLabelFromSnapshot(s);
  const hasIndustry = industryText.length >= 2;
  const hasAudience = coerceTrimmedString(s.targetAudience).length >= 2;

  const research: SectionReadiness = hasIndustry
    ? {
        status: "ready",
        summary: `Research can run for “${industryText.slice(0, 80)}${industryText.length > 80 ? "…" : ""}”.`,
        nextActionLabel: "Run Research",
      }
    : {
        status: "needs_input",
        summary: "Add an industry (dropdown, free text, or Bentley) before Research.",
        nextActionLabel: "Set industry",
      };

  const trends: SectionReadiness = hasIndustry
    ? {
        status: "ready",
        summary: hasAudience
          ? "Trends can run with industry + audience."
          : "Trends can run with industry; audience improves targeting.",
        nextActionLabel: "Identify Trending Content",
      }
    : {
        status: "needs_input",
        summary: "Industry is required for Trends.",
        nextActionLabel: "Set industry",
      };

  const contentReady =
    industryResolved(s) &&
    coerceTrimmedString(s.businessName).length > 0 &&
    coerceTrimmedString(s.targetAudience).length > 0 &&
    coerceTrimmedString(s.coreOffer).length > 0 &&
    coerceTrimmedString(s.transformation).length > 0 &&
    (s.platforms?.length ?? 0) > 0;

  const contentEngine: SectionReadiness = contentReady
    ? {
        status: "ready",
        summary: "Content Engine has the inputs it needs to generate.",
        nextActionLabel: "Generate Viral Content",
      }
    : {
        status: "needs_input",
        summary: "Fill business name, offer, transformation, platforms, audience, and industry.",
        nextActionLabel: "Complete Content Engine",
      };

  const structuredReady = structuredGuidedIntakeCompleteForCampaign(s);
  const notesLen = coerceTrimmedString(s.campaignNotes).length;
  const canCampaign =
    industryResolved(s) &&
    (structuredReady ||
      notesLen >= BENTLEY_CAMPAIGN_NOTES_MIN ||
      s.skipCampaignNotes === true);

  const campaign: SectionReadiness = canCampaign
    ? {
        status: "ready",
        summary:
          notesLen >= BENTLEY_CAMPAIGN_NOTES_MIN
            ? "Campaign generator has industry and sufficient notes."
            : structuredReady
              ? "Guided intake is complete — campaign notes can be auto-built from your answers; add more in Notes anytime."
              : "Notes were skipped — **Generate Campaign** still runs, but output will be less informed.",
        nextActionLabel: "Generate Campaign",
      }
    : {
        status: "needs_input",
        summary: `Add industry and at least ${BENTLEY_CAMPAIGN_NOTES_MIN} characters of notes (or tell Bentley **skip** for notes).`,
        nextActionLabel: "Add notes",
      };

  return { research, trends, contentEngine, campaign };
}

export function formatOptionalRemainingLine(s: BentleySnapshot): string {
  const opt: string[] = [];
  if (!fieldSatisfied(s, "traffic") && s.traffic <= 0 && !s.skipTraffic) opt.push("traffic");
  if (!fieldSatisfied(s, "conversionRate") && s.conversionRate <= 0 && !s.skipConversion) opt.push("conversion");
  if (!fieldSatisfied(s, "aov") && s.aov <= 0 && !s.skipAov) opt.push("AOV");
  if (!fieldSatisfied(s, "tone") && !s.skipTone) opt.push("tone");
  if (!fieldSatisfied(s, "contentType") && !s.skipContentType) opt.push("content type");
  if (!fieldSatisfied(s, "imageStyle") && !s.skipImageStyle) opt.push("image style");
  if (
    !fieldSatisfied(s, "campaignNotes") &&
    !s.skipCampaignNotes &&
    (coerceTrimmedString(s.campaignNotes).length) < BENTLEY_CAMPAIGN_NOTES_MIN
  )
    opt.push("notes");
  if (opt.length === 0) return "Optional refinements are either filled or skipped.";
  return `Still optional: ${opt.join(", ")} — add anytime on the page.`;
}

export function buildPhaseTransitionNarrative(
  phaseBefore: BentleyWorkflowPhase,
  phaseAfter: BentleyWorkflowPhase,
  snap: BentleySnapshot
): string {
  const done = completedMilestoneForPhaseLeft(phaseBefore);
  const sec = getSectionReadiness(snap);
  const optional = formatOptionalRemainingLine(snap);

  const parts: string[] = [];
  if (done) {
    parts.push(`**${milestoneNarrativeForChecklist(done)}**`);
  }
  parts.push(`**Next phase:** ${phaseLabel(phaseAfter)}.`);
  parts.push(`**Section signals:** Research — ${sec.research.status}; Trends — ${sec.trends.status}; Content Engine — ${sec.contentEngine.status}; Campaign — ${sec.campaign.status}.`);
  parts.push(optional);

  if (phaseAfter === "revenue_model") {
    parts.push(
      "If you skipped monthly metrics, you can still complete the **Revenue Equation Engine** later — benchmarks will use your numbers when you add them."
    );
  }
  if (phaseAfter === "content_setup" || phaseAfter === "campaign_prep") {
    parts.push(
      `When this phase wraps, use the primary button in each section: **${sec.research.nextActionLabel}** → **${sec.trends.nextActionLabel}** → **${sec.contentEngine.nextActionLabel}** → **${sec.campaign.nextActionLabel}**.`
    );
  }
  if (phaseAfter === "ready") {
    parts.push(
      `**Ready to Run —** optional refinements are either filled or skipped. **Run order:** 1) Research Assistant — **${sec.research.nextActionLabel}**. 2) Trends Library — **${sec.trends.nextActionLabel}**. 3) Content Engine — **${sec.contentEngine.nextActionLabel}**. 4) Campaign — notes are pre-filled from intake when applicable; use **Industry web crawler** to add more, then **${sec.campaign.nextActionLabel}**.`
    );
  }

  return parts.join("\n\n");
}

export function formatRunHandoff(snap: BentleySnapshot): string {
  const sec = getSectionReadiness(snap);
  const optional = formatOptionalRemainingLine(snap);
  return [
    "**Ready to Run — guided intake is complete.**",
    "",
    optional,
    "",
    `**What’s ready:** Research — ${sec.research.summary} Trends — ${sec.trends.summary} Content — ${sec.contentEngine.summary} Campaign — ${sec.campaign.summary}`,
    "",
    "**Run order (manual or say Run Revenue OS pipeline):**",
    `1) Research Assistant — **${sec.research.nextActionLabel}**`,
    `2) Trends Library — **${sec.trends.nextActionLabel}**`,
    `3) Content Engine — **${sec.contentEngine.nextActionLabel}**`,
    `4) Campaign — notes are filled from guided intake (and research when you run the pipeline); use **Industry web crawler** to add context, then **${sec.campaign.nextActionLabel}**`,
    "",
    "After **Compile Media Brief**, use your **platform of choice** for text-to-video, then upload in **Dashboard → Launch Campaigns → Section 1 · Video**. Match **Connected Accounts** to your intake platforms; without OAuth, post manually using the brief.",
    "",
    "**Deployment:** On the dashboard, **Module 3 — Deployment Center** (`#deployment-center`) shows sequences and funnel runs — fix anything blocking before you rely on automation.",
    "",
    "I won’t auto-run paid or heavy actions unless you start the pipeline.",
    "",
    "**You don’t need to remember special phrases** — tap **What’s next?** or the shortcut buttons under this chat, or type plain questions like “where do I upload my video?”",
    "",
    "**Revenue OS Dashboard:** say **Open Dashboard** or **Open Dashboard and Run Full Analysis**, or use the shortcuts below the chat.",
  ].join("\n");
}

/**
 * Where the user is in the app + what to do next (pathname + snapshot + saved pipeline).
 */
export function buildBentleyLocationAndNextSteps(params: {
  pathname: string | null;
  snapshot: BentleySnapshot;
  workflow: BentleyWorkflowState;
  /** Optional Metricool-style execution handoff (draft posts → connect → schedule). */
  deploymentHandoff?: AdvanceBentleyPipelineStageResult | null;
}): string {
  const path = params.pathname ?? "";
  const onAiPage = path.includes("/ai-revenue-os");
  const onDashboard = path.includes("/revenue-os/dashboard");
  const snap = params.snapshot;
  const wf = params.workflow;
  const missing = getFirstMissingField(snap);
  const nextPhase = getFirstIncompleteWorkflowPhase(wf);

  const parts: string[] = [];

  if (onDashboard) {
    parts.push(
      "**Where you are:** **Revenue OS Dashboard** — analysis, benchmarks, **Launch Campaigns** (video + connected accounts), and **Deployment Center** (Module 3) at the bottom."
    );
    parts.push(
      "**What usually comes next here:** Run or review **Full Analysis** if you haven’t yet → produce assets on this page → when you’re ready to publish, use **Launch Campaigns** for upload and OAuth, or **Deployment Center** to clear deployment blockers."
    );
  } else if (onAiPage) {
    parts.push(
      "**Where you are:** **AI Revenue OS** — guided intake, **Industry Intelligence** / Revenue Equation, then **Research → Trends → Content → Paste Notes** down the page."
    );
    parts.push(
      "**What usually comes next here:** Finish any missing guided answers → optionally **Run Revenue OS pipeline** to automate the four steps → then open the **Dashboard** for numbers, Launch, and Deployment."
    );
  } else {
    parts.push(
      `**Where you are:** this app (**${path || "current page"}**). For the guided flow, open **AI Revenue OS**; for Launch, video upload, and Deployment Center, open **Revenue OS Dashboard**.`
    );
  }

  const dh = params.deploymentHandoff;
  if (dh && !missing) {
    parts.push(
      `**Execution handoff:** ${dh.headline}\n${dh.nextActions.map((a) => `• ${a}`).join("\n")}`
    );
  }

  if (missing) {
    parts.push(
      `**What I need next:** **${fieldLabelShort(missing)}** — ${questionForField(missing)}`
    );
  } else {
    parts.push("**Guided intake:** complete for now (you can still edit fields on the page).");
    if (!wf.completed?.intake) {
      parts.push(
        "**Automated pipeline:** Tap **Run Revenue OS pipeline** once — that saves intake and starts **Research**."
      );
    } else if (nextPhase && nextPhase !== "dashboard" && nextPhase !== "launch_ready") {
      parts.push(
        `**Saved pipeline:** Next step is **${pipelinePhaseLabel(nextPhase)}**. Tap **Run Revenue OS pipeline** or **Resume pipeline** — I’ll continue from the first incomplete step.`
      );
    } else if (nextPhase === "dashboard" || nextPhase === "launch_ready") {
      parts.push(
        "**Saved pipeline:** Core generation is done — use the **Dashboard** for Full Analysis, **video upload** under Launch Campaigns, and **Deployment Center** for Module 3."
      );
    } else if (!nextPhase) {
      parts.push(
        "**Saved pipeline:** Session steps look complete — open the **Dashboard** to run analysis, publish, or review Deployment."
      );
    }
  }

  parts.push(
    "**Tip:** Type **What’s next?**, **Where am I?**, or ask in your own words (e.g. “where do I upload my video?”) — I’ll point you there."
  );

  return parts.join("\n\n");
}

/** Full reply for one Bentley turn (confirm + optional phase narrative + next question or run handoff). */
export function buildFullBentleyTurnReply(
  confirm: string,
  phaseBefore: BentleyWorkflowPhase,
  phaseAfter: BentleyWorkflowPhase,
  nextMissing: BentleyFieldKey | null,
  snap: BentleySnapshot
): string {
  const parts: string[] = [confirm];
  if (phaseBefore !== phaseAfter) {
    parts.push(buildPhaseTransitionNarrative(phaseBefore, phaseAfter, snap));
  }
  if (nextMissing) {
    parts.push(`**Next step:** ${fieldLabelShort(nextMissing)}\n${questionForField(nextMissing)}`);
  } else {
    parts.push(formatRunHandoff(snap));
  }
  return parts.join("\n\n");
}

export type OpeningContextOptions = {
  pathname?: string | null;
  workflow?: BentleyWorkflowState;
};

/** Second NPC message after intro — acknowledges progress without re-asking filled fields. */
export function buildOpeningContextSummary(s: BentleySnapshot, options?: OpeningContextOptions): string {
  const filled: string[] = [];
  const open: string[] = [];
  for (const key of BENTLEY_PROMPT_ORDER) {
    if (fieldSatisfied(s, key)) filled.push(fieldLabelShort(key));
    else open.push(fieldLabelShort(key));
  }

  const next = getFirstMissingField(s);
  const sec = getSectionReadiness(s);

  const lines: string[] = ["**Here’s what I see on the page:**"];

  if (filled.length) {
    lines.push(
      `\n• **Already in good shape:** ${filled.slice(0, 14).join(", ")}${filled.length > 14 ? "…" : ""}. I won’t ask again for these unless you change them.`
    );
  } else {
    lines.push(`\n• No guided fields filled yet — we’ll start from the beginning.`);
  }

  if (open.length && next) {
    lines.push(`\n• **Still open:** ${open.slice(0, 10).join(", ")}${open.length > 10 ? "…" : ""}.`);
    lines.push(`\n**Next question:** ${questionForField(next)}`);
  } else if (!next) {
    lines.push(
      `\n• Guided intake looks complete — use **Research → Trends → Content → Campaign** when you’re ready (I won’t auto-run actions).`
    );
  }

  lines.push(
    `\n**Sections:** Research ${sec.research.status} · Trends ${sec.trends.status} · Content ${sec.contentEngine.status} · Campaign ${sec.campaign.status}.`
  );

  let out = lines.join("");

  if (options?.workflow != null) {
    out += `\n\n---\n\n${buildBentleyLocationAndNextSteps({
      pathname: options.pathname ?? null,
      snapshot: s,
      workflow: options.workflow,
    })}`;
  }

  return out;
}
