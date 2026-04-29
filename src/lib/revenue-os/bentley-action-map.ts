/**
 * Repo-level map of real Revenue OS actions — no DOM simulation.
 * Shared implementations live in `revenue-os-pipeline-actions.ts` and thin `run-*.ts` wrappers.
 */

export interface BentleyActionDescriptor {
  key:
    | "research"
    | "trends"
    | "viral_content"
    | "campaign"
    | "media_brief"
    | "full_analysis"
    | "synthesize_plan";
  sourceComponent: string;
  handlerName: string;
  apiRoute?: string;
  requiredInputs: string[];
  outputTarget: string[];
  alreadySharedCallable: boolean;
  notes?: string;
}

export const BENTLEY_ACTION_MAP: BentleyActionDescriptor[] = [
  {
    key: "research",
    sourceComponent: "src/components/ai-revenue-os/ResearchAssistantSection.tsx",
    handlerName: "handleRunResearch",
    apiRoute: "/api/revenue-os/research",
    requiredInputs: ["marketOrService (industry label)", "optional clientId", "optional trustId"],
    outputTarget: [
      "React state `result` in ResearchAssistantSection",
      "Parent `onResult` / AiRevenueOsPipeline `researchResult`",
    ],
    alreadySharedCallable: true,
    notes: "UI calls `runResearchApi` from `revenue-os-pipeline-actions.ts`; barrel `runResearch` in `run-research.ts`. Bentley: `runResearchAction` → same POST.",
  },
  {
    key: "trends",
    sourceComponent: "src/components/ai-revenue-os/TrendsLibrarySection.tsx",
    handlerName: "runTrends",
    apiRoute: "/api/revenue-os/trends",
    requiredInputs: ["industry", "targetAudience", "optional clientId", "optional trustId"],
    outputTarget: [
      "React state `result` in TrendsLibrarySection",
      "onTrendsResult → AiRevenueOsPipeline `trendsResult`",
    ],
    alreadySharedCallable: true,
    notes: "Refactored to `runTrendsApi` (`run-trends.ts`). Separate optional `/api/trends/generate` bundle is not part of the core Bentley pipeline.",
  },
  {
    key: "synthesize_plan",
    sourceComponent: "src/components/ai-revenue-os/AiRevenueOsPipeline.tsx",
    handlerName: "runSynthesis (useCallback) / effect on trends+research",
    apiRoute: "/api/revenue-os/synthesize-plan",
    requiredInputs: ["trends (TrendsResponse)", "research snippet or null"],
    outputTarget: [
      "consultantPlan, campaignBrief, campaignAngles state in AiRevenueOsPipeline",
      "optional shared state updates (industry, audience)",
    ],
    alreadySharedCallable: true,
    notes: "Refactored to `runSynthesizePlanApi` + `researchResultToSnippet` (`run-synthesize-plan.ts`). Not a separate Bentley map key for orchestration ordering (folded into trends step in `bentley-action-runner`).",
  },
  {
    key: "viral_content",
    sourceComponent: "src/components/ai-revenue-os/ContentEngineSection.tsx",
    handlerName: "generateContent",
    apiRoute: "/api/revenue-os/content-engine",
    requiredInputs: [
      "businessName",
      "industry",
      "targetAudience",
      "coreOffer",
      "transformation",
      "tone",
      "platform (label)",
      "contentType",
    ],
    outputTarget: [
      "React state `result` in ContentEngineSection",
      "session cache via `writeCachedContentEngineOutput`",
      "optional onOutputChange callback",
    ],
    alreadySharedCallable: true,
    notes: "Refactored to `runViralContent` in `run-viral-content.ts` (POST + cache write). Underlying fetch: `runContentEngineApi`.",
  },
  {
    key: "campaign",
    sourceComponent: "src/components/ai-revenue-os/CampaignFromNotesSection.tsx",
    handlerName: "runGenerate",
    apiRoute: "/api/revenue-os/campaign-from-notes",
    requiredInputs: ["industry", "targetAudience", "notes (≥10 chars)"],
    outputTarget: ["React state `result` (CampaignResponse)", "shared `campaignNotes` when provider active"],
    alreadySharedCallable: true,
    notes: "Refactored to `runCampaignFromNotes` (`run-campaign.ts` → `runCampaignFromNotesApi`). Errors include rate-limit retry + trace when API returns them.",
  },
  {
    key: "media_brief",
    sourceComponent: "src/components/ai-revenue-os/CampaignFromNotesSection.tsx",
    handlerName: "handleCompileMediaBrief",
    apiRoute: "/api/revenue-os/compile-media-brief",
    requiredInputs: [
      "industry",
      "targetAudience",
      "campaign fields from last generation",
      "notes (truncated in UI)",
      "optional campaignAngles from props/trends",
    ],
    outputTarget: ["React state `compiledMediaBrief`"],
    alreadySharedCallable: true,
    notes: "Refactored to `runCompileMediaBrief` (`run-media-brief.ts`).",
  },
  {
    key: "full_analysis",
    sourceComponent: "src/app/revenue-os/dashboard/page.tsx + BentleyDashboardBridge",
    handlerName: "runRevenueOsFullAnalysis",
    apiRoute: "/api/revenue-os/analyze",
    requiredInputs: [
      "userId",
      "RevenueOsDashboardFormValues (profile + optional constraints from form)",
    ],
    outputTarget: [
      "Dashboard React state (`res` / analysis result)",
      "session keys from bentley-dashboard-handoff (e.g. analysis session)",
    ],
    alreadySharedCallable: true,
    notes: "Canonical: `runRevenueOsFullAnalysis` in `run-revenue-os-analysis.ts` (also re-exported from `run-full-analysis.ts`). Bentley runner builds form via `buildBentleyDashboardPayload` + `payloadToDashboardFormState`.",
  },
];
