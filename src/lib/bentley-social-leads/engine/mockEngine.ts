/**
 * Mock raw records for tests and local demos (no external APIs).
 */

import type { LeadRawRecord } from "./domainTypes";

export const MOCK_ENGINE_RAW_RECORDS: LeadRawRecord[] = [
  {
    sourcePlatform: "instagram",
    sourceId: "mock-1",
    sourceTitle: "Salon owner Q&A",
    authorHandle: "busyowner_mia",
    commentText:
      "I'm struggling to get leads — DM is a black hole. Anyone recommend a simple CRM? Need help this week.",
    postedAt: new Date().toISOString(),
  },
  {
    sourcePlatform: "youtube",
    sourceId: "mock-2",
    sourceTitle: "Marketing tips 2025",
    authorHandle: "localroofpro",
    commentText: "Our sales are down 30% and we're not sure if it's the ads or the offer. Frustrated.",
    postedAt: new Date().toISOString(),
  },
];
