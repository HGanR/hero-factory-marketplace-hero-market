import type { MissionPathPrerequisites, UserMissionPathApiResponse, MissionPathStep, MissionStepId } from "./mission-path-types";
import { MISSION_STEP_IDS } from "./mission-path-types";

const STEP_DEF: Array<{ id: (typeof MISSION_STEP_IDS)[number]; title: string; shortLabel: string }> = [
  { id: "entity", title: "Entity created", shortLabel: "Entity" },
  { id: "website", title: "Website built", shortLabel: "Site" },
  { id: "agent", title: "AI agent installed on site", shortLabel: "Agent" },
  { id: "campaign", title: "Campaign launched", shortLabel: "Campaign" },
  { id: "lead", title: "First real lead captured", shortLabel: "Lead" },
];

function ctaForStep(step: MissionStepId) {
  if (step === "complete") return null;
  switch (step) {
    case "entity":
      return { label: "Create or register entity", href: "/entity-maps", stepId: step } as const;
    case "website":
      return { label: "Open Site Builder", href: "/site-builder", stepId: step } as const;
    case "agent":
      return { label: "Connect agent to a site", href: "/app/agents", stepId: step } as const;
    case "campaign":
      return {
        label: "Go to campaign dashboard",
        href: "/revenue-os/dashboard",
        stepId: step,
      } as const;
    case "lead":
      return { label: "Open contacts (CRM)", href: "/app/contacts", stepId: step } as const;
    default:
      return null;
  }
}

/**
 * Deterministic: builds API payload from precomputed boolean flags. Pure; unit-test friendly.
 */
export function buildUserMissionPathResponse(p: MissionPathPrerequisites): UserMissionPathApiResponse {
  const flags: Record<(typeof MISSION_STEP_IDS)[number], boolean> = {
    entity: p.hasEntity,
    website: p.hasWebsite,
    agent: p.hasAgentOnSite,
    campaign: p.hasLaunchedCampaign,
    lead: p.hasFirstRealLead,
  };

  const details: Record<(typeof MISSION_STEP_IDS)[number], string | undefined> = {
    entity: p.hasEntity ? "Trust or entity onboarding on file" : undefined,
    website: p.hasWebsite ? "At least one site project" : undefined,
    agent: p.hasAgentOnSite ? "Active site↔agent binding" : undefined,
    campaign: p.hasLaunchedCampaign ? "Active or completed campaign" : undefined,
    lead: p.hasFirstRealLead ? "Non-synthetic contact" : undefined,
  };

  const steps: MissionPathStep[] = STEP_DEF.map((d, i) => ({
    id: d.id,
    order: i + 1,
    title: d.title,
    shortLabel: d.shortLabel,
    done: flags[d.id],
    detail: details[d.id],
  }));

  const doneCount = steps.filter((s) => s.done).length;
  const total = MISSION_STEP_IDS.length;
  const allComplete = doneCount === total;

  let firstIncomplete: MissionStepId = "entity";
  for (const id of MISSION_STEP_IDS) {
    if (!flags[id]) {
      firstIncomplete = id;
      break;
    }
  }
  if (allComplete) {
    firstIncomplete = "complete";
  }

  const cta = allComplete || firstIncomplete === "complete" ? null : ctaForStep(firstIncomplete);

  return {
    version: 1,
    totalSteps: total,
    doneCount,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    continueStepId: allComplete ? "complete" : firstIncomplete,
    allComplete,
    steps,
    continue: cta ? { label: cta.label, href: cta.href, stepId: cta.stepId } : null,
  };
}
