import { z } from "zod";

/** Client-facing consultant deliverables — structured only, no raw HTML. */
export const DeliverablesSummarySchema = z.object({
  title: z.string().max(200),
  executiveSummary: z.string().max(4000),
  topImprovements: z.array(z.string().max(500)).max(8),
  readiness: z.string().max(1200),
});

export const DeliverablesRouteOutlineItemSchema = z.object({
  route: z.string().max(200),
  role: z.string().max(200),
  before: z.string().max(800),
  after: z.string().max(800),
  improvements: z.array(z.string().max(500)).max(12),
});

export const DeliverablesFaqItemSchema = z.object({
  question: z.string().max(400),
  answer: z.string().max(1200),
});

export const DeliverablesLaunchSectionSchema = z.object({
  label: z.string().max(120),
  items: z.array(z.string().max(400)).max(24),
});

export const DeliverablesDocumentSchema = z.object({
  summary: DeliverablesSummarySchema,
  routeOutline: z.array(DeliverablesRouteOutlineItemSchema).max(40),
  stakeholderFaq: z.array(DeliverablesFaqItemSchema).max(16),
  launchChecklist: z.array(DeliverablesLaunchSectionSchema).max(12),
  socialSnippets: z.array(z.string().max(600)).max(3).optional(),
});

export type DeliverablesDocument = z.infer<typeof DeliverablesDocumentSchema>;
