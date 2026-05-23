export type StephonBuilderSessionRow = {
  sessionId: string;
  sessionRowId: number;
  siteLabel: string;
  startedAt: string;
  lastActivity: string;
  messageCount: number;
  operatorLabel: string;
  topic: string | null;
  lastSnippet: string;
  usabilityHint: string | null;
};

export type StephonSiteBuilderOverviewDto = {
  ok: true;
  generatedAt: string;
  worldId: string;
  worldLabel: string;
  engineId: string;
  npcConfigured: boolean;
  npcId: string | null;
  npcName: string | null;
  totals: {
    sessions30d: number;
    messages30d: number;
    activeSessions: number;
  };
  sessions: StephonBuilderSessionRow[];
  skipperBrief: string;
  usabilityThemes: string[];
  meta: {
    readOnly: true;
    piiMasked: true;
    skipperCanAccessTranscripts: true;
  };
};
