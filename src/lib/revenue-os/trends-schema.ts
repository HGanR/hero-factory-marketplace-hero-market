import { z } from "zod";

/**
 * Accepts either numbers or numeric strings for engagement fields,
 * normalizes to number|null.
 */
const NumericOrNull = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const trimmed = String(v).trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  });

export const EngagementSchema = z
  .object({
    views: NumericOrNull,
    likes: NumericOrNull,
    comments: NumericOrNull,
    confidence: z.enum(["high", "medium", "low"]).catch("low"),
    isEstimated: z.boolean().catch(true),
  })
  .passthrough();

export const TrendPlatformSchema = z.enum(["youtube", "tiktok", "reddit"]);
export type TrendsPlatform = z.infer<typeof TrendPlatformSchema>;

export const TrendItemSchema = z
  .object({
    platform: TrendPlatformSchema,
    title: z.string().min(1).catch("Untitled"),
    url: z.string().url().catch("https://example.com"),
    summary: z.string().min(1).catch(""),
    whyTrending: z.string().catch(""),
    commentInsights: z.array(z.string()).catch([]),
    publishedAt: z.string().nullable().catch(null),
    engagement: z
      .union([
        EngagementSchema,
        z.string(),
        z.null(),
        z.undefined(),
      ])
      .catch(null),
    tags: z.array(z.string()).catch([]),
  })
  .passthrough();

export const ContentBlueprintSchema = z
  .object({
    platform: TrendPlatformSchema.optional(),
    format: z.string().min(1).catch("short-form"),
    hook: z.string().min(1).catch(""),
    cta: z.string().min(1).catch(""),
    notes: z.string().catch(""),
  })
  .passthrough();

export const TrendsResponseSchema = z
  .object({
    industry: z.string().min(1).catch(""),
    targetAudience: z.string().min(1).catch(""),
    generatedAt: z.string().catch(() => new Date().toISOString()),
    items: z.array(TrendItemSchema).catch([]),
    campaignAngles: z.array(z.string()).catch([]),
    contentBlueprints: z.array(ContentBlueprintSchema).catch([]),
    disclaimers: z.array(z.string()).catch([]),
  })
  .passthrough();

export type TrendsResponse = z.infer<typeof TrendsResponseSchema>;
export type TrendItem = z.infer<typeof TrendItemSchema>;
export type Engagement = z.infer<typeof EngagementSchema>;
export type ContentBlueprint = z.infer<typeof ContentBlueprintSchema>;

function clampArray<T>(
  arr: T[],
  min: number,
  max: number,
  fillWith: T[] = []
): T[] {
  const a = Array.isArray(arr) ? arr : [];
  if (a.length < min) return a.concat(fillWith).slice(0, min);
  if (a.length > max) return a.slice(0, max);
  return a;
}

function normalizeUrl(
  url: string,
  platform: z.infer<typeof TrendPlatformSchema>
): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") u.protocol = "https:";
    return u.toString();
  } catch {
    const q = encodeURIComponent(url || "trending");
    if (platform === "youtube")
      return `https://www.youtube.com/results?search_query=${q}`;
    if (platform === "tiktok")
      return `https://www.tiktok.com/search?q=${q}`;
    return `https://www.reddit.com/search/?q=${q}`;
  }
}

function normalizeEngagement(
  engagement: unknown,
  url: string
): z.infer<typeof EngagementSchema> {
  if (typeof engagement === "string") {
    const s = engagement.toLowerCase();
    const getNum = (label: string) => {
      const m = s.match(new RegExp(`${label}\\s*[:=]\\s*([0-9,\\.]+)`));
      if (!m) return null;
      const n = Number(String(m[1]).replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const views = getNum("views");
    const likes = getNum("likes");
    const comments = getNum("comments");
    const isSearchLink =
      url.includes("youtube.com/results?") ||
      url.includes("tiktok.com/search?") ||
      url.includes("reddit.com/search/?");

    return {
      views,
      likes,
      comments,
      confidence: "low",
      isEstimated: true,
    };
  }

  const parsed = EngagementSchema.safeParse(engagement);
  if (parsed.success) {
    const isSearchLink =
      url.includes("youtube.com/results?") ||
      url.includes("tiktok.com/search?") ||
      url.includes("reddit.com/search/?");
    return {
      ...parsed.data,
      isEstimated: parsed.data.isEstimated || isSearchLink,
    };
  }

  const isSearchLink =
    url.includes("youtube.com/results?") ||
    url.includes("tiktok.com/search?") ||
    url.includes("reddit.com/search/?");
  return {
    views: null,
    likes: null,
    comments: null,
    confidence: "low",
    isEstimated: true,
  };
}

/**
 * Normalizes and validates any parsed JSON (object).
 */
export function parseTrendsResponse(raw: unknown): TrendsResponse {
  const base = TrendsResponseSchema.parse(raw);

  const items = base.items.map((it) => {
    const url = normalizeUrl(it.url, it.platform);
    const commentInsights = clampArray(
      (it.commentInsights ?? []).filter(Boolean),
      3,
      6
    );
    const tags = clampArray((it.tags ?? []).filter(Boolean), 3, 8);

    const whyTrending = (it.whyTrending || "").trim();
    const summary = (it.summary || "").trim();

    return {
      ...it,
      url,
      summary:
        summary ||
        (whyTrending ? "" : "High-performing content pattern candidate."),
      whyTrending: whyTrending || summary,
      commentInsights,
      tags,
      engagement: normalizeEngagement(it.engagement, url),
    };
  });

  return {
    ...base,
    items,
    campaignAngles: (base.campaignAngles ?? []).filter(Boolean),
    contentBlueprints: (base.contentBlueprints ?? []).filter(Boolean),
    disclaimers: (base.disclaimers ?? []).filter(Boolean),
  };
}

export function generateMockTrends(
  industry: string,
  targetAudience: string
): TrendsResponse {
  const now = new Date().toISOString();
  const q = encodeURIComponent(`${industry} ${targetAudience}`.trim());

  const mk = (
    platform: "youtube" | "tiktok" | "reddit",
    title: string,
    url: string,
    whyTrending: string,
    tags: string[]
  ): TrendItem => ({
    platform,
    title,
    url,
    summary: "Mock trend candidate generated as fallback.",
    whyTrending,
    commentInsights: [
      "People ask for step-by-step instructions and examples.",
      "Strong interest in pricing, setup costs, and time-to-result.",
      "Common objection: 'Does this work for beginners?'",
    ],
    publishedAt: null,
    engagement: {
      views: null,
      likes: null,
      comments: null,
      confidence: "low",
      isEstimated: true,
    },
    tags,
  });

  const items: TrendItem[] = [
    mk(
      "youtube",
      `"How to start in ${industry}" (beginner roadmap)`,
      `https://www.youtube.com/results?search_query=${q}`,
      "Evergreen 'how-to' format with clear outcomes; high search intent; converts well to lead magnets.",
      ["how-to", "beginner", "roadmap", "steps"]
    ),
    mk(
      "youtube",
      `${industry} mistakes to avoid (top 7)`,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${industry} mistakes`)}`,
      "Fear/avoidance framing + list format drives retention; great for credibility and authority.",
      ["mistakes", "authority", "retention", "list"]
    ),
    mk(
      "tiktok",
      `POV: ${targetAudience} discovers a faster way (hook-first)`,
      `https://www.tiktok.com/search?q=${q}`,
      "Hook-first POV + quick reveal; ideal for UGC-style ads and comment-triggered variants.",
      ["pov", "hook", "ugc", "short"]
    ),
    mk(
      "tiktok",
      `${industry} "3 hacks in 15 seconds"`,
      `https://www.tiktok.com/search?q=${encodeURIComponent(`${industry} hacks`)}`,
      "Ultra-short '3 tips' format; boosts saves/shares; easy to batch-produce for campaigns.",
      ["tips", "hacks", "batch", "saves"]
    ),
    mk(
      "reddit",
      `"What's the best way to get results in ${industry}?" (thread)`,
      `https://www.reddit.com/search/?q=${q}`,
      "Question threads reveal objections + language users actually use; gold for ad copy and landing pages.",
      ["pain-points", "language", "objections", "faq"]
    ),
    mk(
      "reddit",
      `"I tried X in ${industry} — here's what happened" (case study)`,
      `https://www.reddit.com/search/?q=${encodeURIComponent(`${industry} case study`)}`,
      "Case studies surface real constraints, budgets, and timelines; great for offer positioning.",
      ["case-study", "constraints", "budget", "positioning"]
    ),
    mk(
      "youtube",
      `${industry} tools stack for ${targetAudience}`,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${industry} tools stack`)}`,
      "Tool-stack videos attract high-intent viewers; easy to turn into affiliate or bundle offers.",
      ["tools", "stack", "high-intent", "bundle"]
    ),
    mk(
      "tiktok",
      `Before/After transformation in ${industry}`,
      `https://www.tiktok.com/search?q=${encodeURIComponent(`${industry} before after`)}`,
      "Transformation format drives emotion + belief; perfect for proof-based creatives.",
      ["before-after", "proof", "emotion", "transformation"]
    ),
    mk(
      "reddit",
      `"Is ${industry} worth it?" (buying intent + skepticism)`,
      `https://www.reddit.com/search/?q=${encodeURIComponent(`${industry} worth it`)}`,
      "Worth-it debates reveal purchase friction; directly informs objection handling and guarantees.",
      ["skepticism", "buying-intent", "objection", "guarantee"]
    ),
  ];

  return parseTrendsResponse({
    industry,
    targetAudience,
    generatedAt: now,
    items,
    campaignAngles: [
      "Outcome-first: promise a specific measurable win in a short timeframe.",
      "Myth-busting: challenge a common belief holding beginners back.",
      "Proof-first: show before/after, receipts, and constraints.",
      "Beginner-friendly: 'start here' onboarding path with templates.",
      "Objection reversal: address time, cost, complexity directly.",
    ],
    contentBlueprints: [
      {
        platform: "tiktok",
        format: "15–25s UGC hook + reveal",
        hook: "Stop doing X — do this instead (watch the result).",
        cta: "Comment 'PLAN' for the checklist.",
        notes: "Batch 10 variations using different pain points and outcomes.",
      },
      {
        platform: "youtube",
        format: "8–12 min tutorial",
        hook: "From zero to first result in under a week (step-by-step).",
        cta: "Grab the free template in the description.",
        notes: "Turn into Shorts + TikTok cuts for distribution.",
      },
      {
        platform: "reddit",
        format: "Value post + soft CTA",
        hook: "Here's the exact framework I'd use if I started today.",
        cta: "If you want the template, I can share it.",
        notes: "Avoid spam; lead with real value and transparency.",
      },
    ],
    disclaimers: [
      "Some items may be candidates based on common platform patterns when live links/metrics are unavailable.",
      "Do not copy creators; emulate formats and angles while producing original content.",
      "Use platform-approved access methods; avoid scraping or violating Terms of Service.",
    ],
  });
}
