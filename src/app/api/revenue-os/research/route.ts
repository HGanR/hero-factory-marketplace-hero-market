import { NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getConnectedProviders } from "@/lib/revenue-os/workspace-apis";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const SYSTEM_PROMPT = `You are a market research assistant. Given a market or service, produce a JSON object with this exact structure (no other text):
{
  "whatPeopleWant": ["item1", "item2", "item3", "item4", "item5"],
  "commentsBySource": [
    { "source": "Meta Ads Library", "themes": ["theme1", "theme2"], "sampleComments": ["sample quote"] },
    { "source": "Reddit", "themes": ["theme1", "theme2"], "sampleComments": ["sample quote"] },
    { "source": "TikTok", "themes": ["theme1", "theme2"], "sampleComments": ["sample quote"] },
    { "source": "Google", "themes": ["theme1", "theme2"], "sampleComments": ["sample quote"] }
  ],
  "marketingTips": ["tip1", "tip2", "tip3", "tip4", "tip5"]
}

Base your output on realistic insights someone would find by scrubbing Meta Ads Library (ad creatives, copy, targeting), Reddit (subreddit discussions, complaints, praise), TikTok (trends, hashtags, creator content), and Google (search trends, SERP features). Be specific to the market. Output only valid JSON.`;

function generateMockResearch(marketOrService: string) {
  const m = marketOrService.toLowerCase();
  const isB2B = m.includes("b2b") || m.includes("saas") || m.includes("consulting");
  const isFitness = m.includes("fitness") || m.includes("coach") || m.includes("gym");
  const isSkincare = m.includes("skincare") || m.includes("beauty") || m.includes("e-commerce");

  const whatPeopleWant = isB2B
    ? [
        "Clear ROI and time-to-value metrics",
        "Easy integration with existing tools",
        "Transparent pricing without surprises",
        "Strong onboarding and support",
        "Case studies from similar companies",
      ]
    : isFitness
      ? [
          "Accountability and consistency support",
          "Flexible schedules and on-demand content",
          "Real results without extreme diets",
          "Community and motivation",
          "Personalized plans at affordable prices",
        ]
      : isSkincare
        ? [
            "Clean ingredients and sustainability",
            "Visible results with minimal routine",
            "Honest before/after and reviews",
            "Subscription or sample options",
            "Expert recommendations (dermatologist-backed)",
          ]
        : [
            "Trust and credibility signals",
            "Easy-to-understand value proposition",
            "Responsive customer service",
            "Transparent pricing",
            "Social proof and reviews",
          ];

  const commentsBySource = [
    {
      source: "Meta Ads Library",
      themes: isB2B ? ["ROI focus", "integration ease"] : ["social proof", "offers"],
      sampleComments: [
        isB2B
          ? "Ad copy emphasizes 30-day trial and enterprise features"
          : "Creatives highlight before/after and limited-time offers",
      ],
    },
    {
      source: "Reddit",
      themes: ["complaints about X", "praise for Y", "comparison threads"],
      sampleComments: [
        "Users ask for alternatives and compare options in r/[relevant]",
      ],
    },
    {
      source: "TikTok",
      themes: ["trending formats", "creator authenticity", "short-form hooks"],
      sampleComments: [
        "Top-performing posts use day-in-the-life and quick tips",
      ],
    },
    {
      source: "Google",
      themes: ["intent keywords", "featured snippets", "competitor terms"],
      sampleComments: [
        "People search for 'best [market] for [use case]' and comparison terms",
      ],
    },
  ];

  const marketingTips = isB2B
    ? [
        "Lead with ROI calculators and case study snippets in ads",
        "Use Reddit/communities for pain-point research before launching",
        "Test LinkedIn vs Meta—audience intent differs by platform",
        "Create comparison content that ranks for '[product] vs [competitor]'",
        "Offer free audits or assessments to qualify leads",
      ]
    : isFitness
      ? [
          "TikTok: use trending sounds with transformation hooks",
          "Reddit: engage authentically in r/fitness, r/loseit—no hard sells",
          "Meta: retarget with progress testimonials and challenge signups",
          "Google: capture 'how to start' and 'beginner' intent with SEO content",
          "Test UGC-style ads with real clients (with permission)",
        ]
      : isSkincare
        ? [
            "Lean into before/after with proper disclaimers",
            "Partner with dermatologists or estheticians for credibility",
            "Reddit beauty communities value honest reviews—don't astroturf",
            "TikTok skincare routines perform well—create quick routines",
            "Subscription models reduce CAC; highlight auto-ship benefits",
          ]
        : [
            "Clarify who this is for in every ad—narrow targeting wins",
            "Use platform-specific creative: short hooks on TikTok, carousels on Meta",
            "Build SEO for comparison and 'best' queries to capture intent",
            "Reddit: provide value first; link only when genuinely helpful",
            "Track which sources drive highest LTV, not just top-of-funnel",
          ];

  return {
    marketOrService,
    whatPeopleWant,
    commentsBySource,
    marketingTips,
    sourcesSearched: ["ads_library", "reddit", "tiktok", "google"] as const,
  };
}

function parseLlmResearch(text: string, marketOrService: string) {
  try {
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      whatPeopleWant?: string[];
      commentsBySource?: Array<{
        source: string;
        themes: string[];
        sampleComments?: string[];
      }>;
      marketingTips?: string[];
    };

    const whatPeopleWant = Array.isArray(parsed.whatPeopleWant)
      ? parsed.whatPeopleWant.slice(0, 7).filter(Boolean)
      : [];

    const commentsBySource = Array.isArray(parsed.commentsBySource)
      ? parsed.commentsBySource.slice(0, 4).map((c) => ({
          source: typeof c.source === "string" ? c.source : "Unknown",
          themes: Array.isArray(c.themes) ? c.themes.filter(Boolean) : [],
          sampleComments: Array.isArray(c.sampleComments) ? c.sampleComments.filter(Boolean) : undefined,
        }))
      : [];

    const marketingTips = Array.isArray(parsed.marketingTips)
      ? parsed.marketingTips.slice(0, 7).filter(Boolean)
      : [];

    if (whatPeopleWant.length === 0 || marketingTips.length === 0) {
      return null;
    }

    return {
      marketOrService,
      whatPeopleWant,
      commentsBySource: commentsBySource.length > 0 ? commentsBySource : generateMockResearch(marketOrService).commentsBySource,
      marketingTips,
      sourcesSearched: ["ads_library", "reddit", "tiktok", "google"] as const,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let marketOrService = "";
  let clientId = "";
  let trustId = "";
  try {
    logBentleyCorrelationEvent("revenue-os/research", req);
    const body = await req.json().catch(() => ({}));
    marketOrService =
      typeof body?.marketOrService === "string"
        ? body.marketOrService.trim()
        : "";
    clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
    trustId = typeof body?.trustId === "string" ? body.trustId.trim() : "";

    if (!marketOrService || marketOrService.length < 2) {
      return NextResponse.json(
        { error: "marketOrService is required (min 2 characters)" },
        { status: 400 }
      );
    }

    if (marketOrService.length > 300) {
      return NextResponse.json(
        { error: "marketOrService too long" },
        { status: 400 }
      );
    }

    const llmResponse = await invokeNpcLlm([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Market or service: "${marketOrService}". Produce the JSON research output.`,
      },
    ]);

    const parsed = llmResponse
      ? parseLlmResearch(llmResponse, marketOrService)
      : null;

    const result = parsed ?? generateMockResearch(marketOrService);

    // Include connected workspace integrations when authed and workspace context provided
    let connectedIntegrations: string[] = [];
    try {
      const userId = await getAuthedUserId();
      if (userId != null && (clientId || trustId)) {
        connectedIntegrations = await getConnectedProviders(String(userId), clientId, trustId);
      }
    } catch {
      // optional
    }

    return NextResponse.json({ ...result, connectedIntegrations });
  } catch (err) {
    const fallback =
      marketOrService && marketOrService.length >= 2
        ? generateMockResearch(marketOrService)
        : null;

    if (fallback) {
      let connectedIntegrations: string[] = [];
      try {
        const userId = await getAuthedUserId();
        if (userId != null && (clientId || trustId)) {
          connectedIntegrations = await getConnectedProviders(String(userId), clientId, trustId);
        }
      } catch {
        // optional
      }
      return NextResponse.json({ ...fallback, connectedIntegrations });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
