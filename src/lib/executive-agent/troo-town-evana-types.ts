export type EvanaVisitorSessionRow = {
  sessionId: string;
  sessionRowId: number;
  startedAt: string;
  lastActivity: string;
  messageCount: number;
  visitorLabel: string;
  topic: string | null;
  lastSnippet: string;
  followUpHint: string | null;
};

export type TrooTownEvanaOverviewDto = {
  ok: true;
  generatedAt: string;
  worldId: string;
  worldLabel: string;
  buildingId?: string | null;
  buildingLabel?: string | null;
  npcConfigured: boolean;
  npcId: string | null;
  npcName: string | null;
  totals: {
    sessions30d: number;
    messages30d: number;
    activeSessions: number;
  };
  sessions: EvanaVisitorSessionRow[];
  skipperBrief: string;
  followUpThemes: string[];
  meta: {
    readOnly: true;
    piiMasked: true;
    skipperCanAccessTranscripts: true;
  };
};
