/**
 * LLM + deterministic fallbacks for market sweep string buckets (pre-hybrid merge).
 */

import { z } from "zod";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import type { RealSignalBundle } from "@/lib/revenue-os/market-signals/types";

const BucketsSchema = z.object({
  trendingTopics: z.array(z.string()),
  viralHooks: z.array(z.string()),
  painPoints: z.array(z.string()),
  buyingSignals: z.array(z.string()),
  commentInsights: z.array(z.string()),
  competitorAngles: z.array(z.string()),
  contentGaps: z.array(z.string()),
});

export type MarketSweepSynthesizeInput = {
  industry: string;
  targetAudience: string;
  platforms: string[];
  bundle: RealSignalBundle;
};

function clampLines(lines: string[], max: number, maxLen: number): string[] {
  return lines
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, maxLen))
    .slice(0, max);
}

function bucketLineCount(m: Pick<MarketSweepResult, "trendingTopics" | "viralHooks" | "painPoints" | "commentInsights">): number {
  return (
    (m.trendingTopics?.length ?? 0) +
    (m.viralHooks?.length ?? 0) +
    (m.painPoints?.length ?? 0) +
    (m.commentInsights?.length ?? 0)
  );
}

/** Modeled lines from industry/audience + optional live titles — always enough for downstream verification. */
export function buildDeterministicMarketSweepParsed(input: MarketSweepSynthesizeInput): MarketSweepResult {
  const { industry, targetAudience, platforms } = input;
  const ind = industry.trim() || "this market";
  const aud = targetAudience.trim() || "buyers";
  const plats = platforms.length ? platforms.join(", ") : "major social platforms";
  const sigLines = input.bundle.signals.map((s) => s.title.trim()).filter(Boolean);

  const trendingTopics = clampLines(
    [
      ...sigLines.slice(0, 6),
      `${ind} buyers actively comparing options in ${new Date().getFullYear()}`,
      `Short-form proof beats generic ${ind} thought leadership for ${aud}`,
    ],
    10,
    220
  );

  const viralHooks = clampLines(
    [
      ...sigLines.slice(0, 3).map((t) => `POV: The ${ind} shift nobody’s saying out loud — ${t.slice(0, 52)}`),
      `Stop posting “tips” — show the before/after for ${aud}`,
      `The one ${ind} metric that predicts pipeline (not vanity reach)`,
    ],
    10,
    200
  );

  const painPoints = clampLines(
    [
      `Teams in ${ind} can’t tie content to pipeline with confidence`,
      `${aud} sees undifferentiated messaging — proof is missing in the first 3 seconds`,
      "Scheduling + approvals slow time-to-learn from experiments",
    ],
    10,
    200
  );

  const buyingSignals = clampLines(
    [
      `ROI and comparison threads trending for ${ind} purchases`,
      `“How do we implement?” comments rising on ${plats}`,
    ],
    10,
    200
  );

  const commentInsights = clampLines(
    input.bundle.signals.length
      ? input.bundle.signals.slice(0, 6).map((s) => (s.snippet ? s.snippet.slice(0, 180) : s.title))
      : [
          `${aud} responds to specificity: numbers, timelines, named segments`,
          "Objection threads cluster around risk, proof, and time-to-value",
        ],
    10,
    220
  );

  const competitorAngles = clampLines(
    [
      `Incumbents sell features; winners sell outcomes for ${aud}`,
      "Category leaders publish repeatable systems — not one-off viral hits",
    ],
    10,
    200
  );

  const contentGaps = clampLines(
    [
      `Implementation checklists for ${ind} offers are under-produced`,
      `Before/after stories for ${aud} are rare but high-trust`,
    ],
    10,
    200
  );

  const disclaimers = [
    ...(input.bundle.errors.length ? [`Signal connectors: ${input.bundle.errors.join(" | ")}`] : []),
    ...(input.bundle.signals.length === 0
      ? ["No live connector headlines returned — buckets are modeled from industry/audience (add YOUTUBE_DATA_API_KEY for YouTube search)."]
      : []),
  ];

  const base: MarketSweepResult = {
    trendingTopics,
    viralHooks,
    painPoints,
    buyingSignals,
    commentInsights,
    competitorAngles,
    contentGaps,
    ...(disclaimers.length ? { disclaimers } : {}),
  };

  if (bucketLineCount(base) < 2) {
    base.trendingTopics.push(`Baseline demand signal for ${ind} (modeled)`);
    base.viralHooks.push(`Pattern interrupt: what ${aud} actually asks in sales calls`);
  }

  return base;
}

export type LlmSweepOutcome =
  | { ok: true; parsed: MarketSweepResult }
  | { ok: false; error: string };

export async function synthesizeMarketSweepWithLlm(input: MarketSweepSynthesizeInput): Promise<LlmSweepOutcome> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "OPENAI_API_KEY not set" };
  }

  const signalSnippet = input.bundle.signals
    .slice(0, 18)
    .map((s) => `- [${s.source}] ${s.title}${s.snippet ? ` — ${s.snippet.slice(0, 120)}` : ""}`)
    .join("\n");

  const system = `You are Bentley Market Intelligence. Output ONLY valid JSON with keys:
trendingTopics, viralHooks, painPoints, buyingSignals, commentInsights, competitorAngles, contentGaps
Each value is an array of 4-10 short strings (no markdown). Be specific to the industry and audience.`;

  const user = `Industry: ${input.industry.trim()}
Target audience: ${input.targetAudience.trim()}
Platforms: ${input.platforms.join(", ") || "general"}

Real public signal headlines (may be empty):
${signalSnippet || "(none)"}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MARKET_SWEEP_OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `OpenAI HTTP ${res.status}: ${t.slice(0, 240)}` };
    }

    const raw = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, error: "OpenAI returned empty content" };
    }

    const parsedJson = JSON.parse(text) as unknown;
    const parsed = BucketsSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ok: false, error: `LLM JSON mismatch: ${parsed.error.message}` };
    }

    const d = parsed.data;
    const merged: MarketSweepResult = {
      trendingTopics: clampLines(d.trendingTopics, 28, 240),
      viralHooks: clampLines(d.viralHooks, 28, 240),
      painPoints: clampLines(d.painPoints, 28, 240),
      buyingSignals: clampLines(d.buyingSignals, 28, 240),
      commentInsights: clampLines(d.commentInsights, 28, 240),
      competitorAngles: clampLines(d.competitorAngles, 28, 240),
      contentGaps: clampLines(d.contentGaps, 28, 240),
    };

    if (bucketLineCount(merged) < 2) {
      return { ok: false, error: "LLM produced too few bucket lines" };
    }

    return { ok: true, parsed: merged };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
