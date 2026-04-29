export const MISSION_STEP_IDS = [
  "entity",
  "website",
  "agent",
  "campaign",
  "lead",
] as const;

export type MissionStepId = (typeof MISSION_STEP_IDS)[number] | "complete";

export type MissionPathStep = {
  id: (typeof MISSION_STEP_IDS)[number];
  order: number;
  title: string;
  shortLabel: string;
  done: boolean;
  /** Opaque: why the step is marked done (for debugging) */
  detail?: string;
};

export type UserMissionPathApiResponse = {
  version: 1;
  totalSteps: number;
  doneCount: number;
  percent: number;
  continueStepId: MissionStepId | null;
  /** If `continueStepId` is null and all `done`, this is true. */
  allComplete: boolean;
  steps: MissionPathStep[];
  /** Suggested CTA to resume onboarding */
  continue: {
    label: string;
    href: string;
    stepId: MissionStepId;
  } | null;
};

export type MissionPathPrerequisites = {
  hasEntity: boolean;
  hasWebsite: boolean;
  hasAgentOnSite: boolean;
  hasLaunchedCampaign: boolean;
  hasFirstRealLead: boolean;
};
