/**
 * Live pipeline progress for Bentley orchestration (CustomEvents + labels).
 */

import type { BentleyWorkflowPhaseId } from "@/lib/revenue-os/bentley-workflow";

export const BENTLEY_PIPELINE_PROGRESS_EVENT = "bentley:pipeline-progress";

/** Ambient UI + parent listeners open the Bentley floating panel (same tab). */
export const BENTLEY_OPEN_CHAT_EVENT = "bentley:open-chat";

/** Triggers the same full-pipeline run as the “Resume pipeline” chat prompt (ai-revenue-os only). */
export const BENTLEY_RESUME_PIPELINE_EVENT = "bentley:resume-pipeline";

/** Query flag for `/ai-revenue-os` — auto-start resume after navigation from dashboard. */
export const BENTLEY_RESUME_PIPELINE_QUERY = "resumePipeline";

/** Ordered steps for the automated pipeline (after intake). */
export const BENTLEY_PIPELINE_RUN_STEPS: BentleyWorkflowPhaseId[] = [
  "research",
  "trends",
  "market_sweep",
  "content",
  "campaign_notes",
  "campaign_generation",
  "media_brief",
  "analysis",
];

export type BentleyPipelineProgressDetail = {
  mode: "idle" | "running" | "complete" | "failed";
  /** Phase currently executing, or null when idle. */
  activePhase: BentleyWorkflowPhaseId | null;
  /** Phases marked complete in workflow state (may include intake). */
  completedPhases: BentleyWorkflowPhaseId[];
  failedPhase?: BentleyWorkflowPhaseId;
  errorMessage?: string;
  /** Human-readable line for the active step. */
  statusLine: string;
  resumeHint?: string;
};

export function pipelinePhaseLabel(id: BentleyWorkflowPhaseId): string {
  const m: Record<BentleyWorkflowPhaseId, string> = {
    intake: "Intake",
    research: "Research",
    trends: "Trends & synthesis",
    market_sweep: "Market intelligence sweep",
    content: "Viral content",
    campaign_notes: "Campaign notes",
    campaign_generation: "Campaign generation",
    media_brief: "Media brief",
    analysis: "Full analysis",
    dashboard: "Dashboard",
    launch_ready: "Launch",
  };
  return m[id] ?? id;
}

/** One-line success copy after each step completes. */
export const PIPELINE_STEP_SUCCESS_LINE: Partial<Record<BentleyWorkflowPhaseId, string>> = {
  research: "Research complete — audience signals captured.",
  trends: "Trends complete — synthesis updated.",
  market_sweep: "Market sweep complete — TikTok / YouTube / Reddit signals captured.",
  content: "Viral content generated — Generate Content Bundle is next in Paste Notes.",
  campaign_notes: "Campaign notes assembled (industry web crawl merged when available).",
  campaign_generation: "Campaign generated — hooks and pillars ready.",
  media_brief: "Media brief compiled — Content Bundle ready for text-to-video tools.",
  analysis: "Full analysis complete — revenue model updated.",
};

/** Bentley narration: what to extract / what to run next (shown under each milestone). */
export const PIPELINE_STEP_BENTLEY_FOLLOWUP: Partial<Record<BentleyWorkflowPhaseId, string>> = {
  research:
    "**Extract:** Pull out the audience pains, desires, and language that map to your offer.\n**Next trigger:** Run **Identify Trending Content** in Trends Library (or continue the automated pipeline).",
  trends:
    "**Extract:** Note hooks, formats, and angles that fit your audience — discard what doesn’t serve the revenue goal.\n**Next:** Bentley runs **Market Intelligence Sweep** (or continue the automated pipeline).",
  market_sweep:
    "**Sweep:** Cross-platform signals (TikTok search + comments, YouTube titles + comments, Reddit threads) are merged into structured intel.\n**Next trigger:** Run **Generate Viral Content** in Content Engine.",
  content:
    "**Use:** Feed hooks and copy into your narrative.\n**Next:** If Paste Notes aren’t filled yet, Bentley merges **research + trends + synthesis** (and viral content when present) plus an **industry web crawl** — then **Generate Campaign**.",
  campaign_notes:
    "**Notes** now include intake, research, trends, **market sweep**, synthesis, Content Engine output when available, and Bentley’s industry crawl when the API succeeds. Review, edit if needed, then **Generate Campaign**.",
  campaign_generation:
    "**Generate Content Bundle:** Tap **Compile Media Brief** in Paste Notes to build the full bundle for external AI video/image tools.",
  media_brief:
    "**Text → video:** Open your **platform of choice** (Runway, Sora, CapCut, etc.) and generate video using the compiled brief.\n**Then:** On **Revenue OS Dashboard → Launch Campaigns → Section 1 Video**, upload the file. Match **Connected Accounts** to your posting platforms; if OAuth isn’t connected, create the post **manually** using the same copy and brief.",
  analysis:
    "**Dashboard:** Review projections and assets. Open **Module 3 — Deployment Center** at the bottom of the dashboard if anything blocks publishing (sequences, funnel runs, integrations).",
};

export function buildLaunchReadySummary(): string {
  return (
    "**Launch-ready summary**\n\n" +
    "• Revenue OS analysis and campaign artifacts are in place.\n" +
    "• Open **Revenue OS Dashboard** (`/revenue-os/dashboard`) — **Launch Campaigns** (`#campaign-launch`) uses **Section 1 · Video** for your upload; **Connected Accounts** should mirror the platforms you chose in intake.\n" +
    "• If OAuth isn’t available for a platform, **manually** publish using the compiled media brief and campaign copy — nothing auto-posts without your action.\n" +
    "• **Deployment Center** (Module 3 at the bottom of the dashboard: `#deployment-center`) lists deployment/sequence status — fix any blocked items Bentley flags before you rely on automated posting."
  );
}

export function buildPipelineChatReply(milestones: string[]): string {
  const lines = milestones.filter(Boolean);
  const body = lines.length
    ? lines
        .map((l) =>
          l.includes("\n")
            ? l
                .split("\n")
                .map((row, i) => (i === 0 ? `• ${row}` : `  ${row}`))
                .join("\n")
            : `• ${l}`
        )
        .join("\n")
    : "• Pipeline finished.";
  return `${body}\n\n${buildLaunchReadySummary()}`;
}

export function emitBentleyPipelineProgress(detail: BentleyPipelineProgressDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BENTLEY_PIPELINE_PROGRESS_EVENT, { detail }));
}

export function emitIdleProgress(completed: BentleyWorkflowPhaseId[]): void {
  emitBentleyPipelineProgress({
    mode: "idle",
    activePhase: null,
    completedPhases: completed,
    statusLine: "Ready",
  });
}
