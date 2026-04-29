import { z } from "zod";

/**
 * Trend Card — input from Identify Trending Content results.
 * Accepts both the full TrendItem shape and a minimal shape.
 */
export const TrendCardSchema = z.object({
  platform: z.enum(["youtube", "tiktok", "reddit"]),
  title: z.string(),
  description: z.string().optional(),
  summary: z.string().optional(),
  whyTrending: z.string().optional(),
  tags: z.array(z.string()).default([]),
  url: z.string().optional(),
  commentInsights: z.array(z.string()).optional(),
  estimated: z.enum(["low", "med", "high"]).optional(),
});

export type TrendCard = z.infer<typeof TrendCardSchema>;

/**
 * Trend Signal Packet — extracted performance variables from a trend card.
 */
export const TrendPacketSchema = z.object({
  platform: z.enum(["youtube", "tiktok", "reddit"]),
  format: z.enum([
    "how_to",
    "mistakes",
    "pov",
    "hacks",
    "tools_stack",
    "case_study",
    "worth_it_debate",
  ]),
  hookType: z.enum([
    "pov",
    "contrarian",
    "fear_avoidance",
    "curiosity",
    "do_this_not_that",
    "proof_first",
  ]),
  targetPersona: z.string(),
  promise: z.string(),
  objections: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type TrendPacket = z.infer<typeof TrendPacketSchema>;

/**
 * Content Bundle — ready-to-use output for Sora / Hedra / posting.
 */
export const ContentBundleSchema = z.object({
  platform: z.enum(["tiktok", "youtube_shorts", "youtube_long"]),
  durationSec: z.number().int().min(10).max(900),
  soraPrompt: z.string(),
  hedraPrompt: z.string(),
  voiceoverScript: z.string(),
  onScreenText: z.array(z.string()),
  scenes: z.array(z.string()),
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

export type ContentBundle = z.infer<typeof ContentBundleSchema>;
