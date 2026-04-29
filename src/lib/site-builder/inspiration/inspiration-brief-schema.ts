import { z } from "zod";

/**
 * Transformed design/copy patterns from a reference site — not scraped text for reuse.
 */
export const InspirationBriefSchema = z.object({
  detectedIndustry: z.string().min(1).max(200),
  tone: z.string().min(1).max(500),
  colorDirection: z.string().min(1).max(500),
  layoutPatterns: z.array(z.string().min(1).max(300)).max(20),
  heroPattern: z.string().min(1).max(500),
  ctaPatterns: z.array(z.string().min(1).max(200)).max(16),
  trustSignals: z.array(z.string().min(1).max(200)).max(16),
  sectionPatterns: z.array(z.string().min(1).max(200)).max(20),
  keywordThemes: z.array(z.string().min(1).max(80)).max(24),
  doNotCopyNotice: z.literal(true),
  /** Single-user analysis; respect site robots.txt for automated crawling. */
  robotsNote: z.string().max(500).optional(),
});

export type InspirationBrief = z.infer<typeof InspirationBriefSchema>;
