import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { getKnowledgeForNpc, getNpcRowByNpcId } from "@/lib/npc/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getConnectedProviders } from "@/lib/revenue-os/workspace-apis";
import { resolveUnifiedGenerationContext } from "@/lib/revenue-os/resolveUnifiedGenerationContext";
import { formatUnifiedGenerationPromptAddendum } from "@/lib/revenue-os/formatUnifiedGenerationPrompt";
import {
  parseTrendsResponse,
  generateMockTrends,
  type TrendsResponse,
} from "@/lib/revenue-os/trends-schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export type { TrendsResponse, TrendItem } from "@/lib/revenue-os/trends-schema";
export type { TrendsPlatform } from "@/lib/revenue-os/trends-schema";

function extractJson(text: string): unknown | null {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  return null;
}

async function getConnectedIntegrations(clientId: string, trustId: string): Promise<string[]> {
  try {
    const userId = await getAuthedUserId();
    if (userId != null && (clientId || trustId)) {
      return getConnectedProviders(String(userId), clientId, trustId);
    }
  } catch {
    // optional
  }
  return [];
}

async function getNpcKnowledge(npcId: string): Promise<string> {
  try {
    const npcRow = await getNpcRowByNpcId(npcId);
    if (!npcRow) return "";
    const knowledge = await getKnowledgeForNpc(npcRow.id);
    if (knowledge.length === 0) return "";
    return knowledge.map((k) => `[${k.topic}] ${k.content}`).join("\n");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let clientId = "";
  let trustId = "";
  try {
    logBentleyCorrelationEvent("revenue-os/trends", req);
    const body = await req.json().catch(() => ({}));
    const industry = String(body?.industry || "").trim();
    const targetAudience =
      String(body?.targetAudience || "").trim() || "general audience";
    clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
    trustId = typeof body?.trustId === "string" ? body.trustId.trim() : "";

    if (!industry || industry.length < 2) {
      return NextResponse.json(
        { error: "industry is required (min 2 characters)" },
        { status: 400 }
      );
    }

    if (industry.length > 200 || targetAudience.length > 300) {
      return NextResponse.json(
        { error: "industry or targetAudience too long" },
        { status: 400 }
      );
    }

    const npcKnowledge = await getNpcKnowledge("ai-revenue-trends");

    const userId = await getAuthedUserId();
    const bodyRecord = body as Record<string, unknown>;
    const operatorNotes = typeof bodyRecord.operatorNotes === "string" ? String(bodyRecord.operatorNotes) : "";
    const { context: unifiedCtx, userInputForPrompt } = await resolveUnifiedGenerationContext({
      body: bodyRecord,
      userId,
      userNotes: operatorNotes,
      skipConversion: bodyRecord.skipConversionIntelligence === true,
    });
    const unifiedAddendum = formatUnifiedGenerationPromptAddendum(unifiedCtx, userInputForPrompt);

    const system = [
      "You are an assistant that produces strict JSON only.",
      "Do not include markdown, explanations, or extra keys.",
      "Normalization rules:",
      "- Always return 9–15 items.",
      "- commentInsights must contain 3–6 strings.",
      "- tags must contain 3–8 strings.",
      "- If you don't know publishedAt, return null.",
      "- engagement fields: numbers or null only; do not use strings for numbers.",
      "- confidence is always one of: high, medium, low.",
      "- isEstimated must be true if any engagement is guessed or if URL is a search link.",
      "- url must start with https://",
      "Return ONLY valid JSON.",
    ].join("\n");

    const user = `
Context (NPC Knowledge):
${npcKnowledge}

${unifiedAddendum}

Task:
Generate a "Trends Library" for:
- Industry: ${industry}
- Target audience: ${targetAudience}

Platforms:
- YouTube
- TikTok
- Reddit

Time window:
Focus on the last 30 days when possible. If unknown, treat engagement as "estimated" and use search URLs.

If you don't know an exact post URL, use search URLs:
- YouTube: https://www.youtube.com/results?search_query=QUERY
- TikTok: https://www.tiktok.com/search?q=QUERY
- Reddit: https://www.reddit.com/search/?q=QUERY

Return 9–15 items total across platforms (balanced: 3–5 per platform).
Each item must include:
- platform (youtube|tiktok|reddit)
- title
- url (direct link if known; otherwise a platform search link)
- summary (1–2 sentences)
- whyTrending (format + hook + audience pain point + emotion/benefit)
- commentInsights (3–6 bullets as strings; patterns, objections, FAQs, buying intent)
- publishedAt (ISO date if known, otherwise null)
- engagement (object with likes, comments, views; may be null)
- tags (3–8 short tags)

Then include:
- campaignAngles (5–10 bullet strings)
- contentBlueprints (3–6 objects: platform, format, hook, cta, notes)
- disclaimers (array of strings)

Return ONLY valid JSON.
`.trim();

    const text = await invokeNpcLlm([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    const extracted = extractJson(String(text ?? ""));
    if (!extracted) {
      const mock = generateMockTrends(industry, targetAudience);
      const integrations = await getConnectedIntegrations(clientId, trustId);
      return NextResponse.json({ ...mock, connectedIntegrations: integrations });
    }

    let parsed: TrendsResponse;
    try {
      parsed = parseTrendsResponse(extracted);
    } catch {
      const mock = generateMockTrends(industry, targetAudience);
      const integrations = await getConnectedIntegrations(clientId, trustId);
      return NextResponse.json({ ...mock, connectedIntegrations: integrations });
    }

    if (!parsed.items || parsed.items.length < 1) {
      const mock = generateMockTrends(industry, targetAudience);
      const integrations = await getConnectedIntegrations(clientId, trustId);
      return NextResponse.json({ ...mock, connectedIntegrations: integrations });
    }

    if (parsed.items.length < 9) {
      const mock = generateMockTrends(industry, targetAudience);
      const integrations = await getConnectedIntegrations(clientId, trustId);
      return NextResponse.json({ ...mock, connectedIntegrations: integrations });
    }

    const connectedIntegrations = await getConnectedIntegrations(clientId, trustId);
    return NextResponse.json({ ...parsed, connectedIntegrations });
  } catch (err: unknown) {
    const industry = "Unknown";
    const targetAudience = "general audience";
    const mock = generateMockTrends(industry, targetAudience);
    const errMsg = err instanceof Error ? err.message : String(err);
    const connectedIntegrations = await getConnectedIntegrations(clientId, trustId);
    return NextResponse.json({
      ...mock,
      industry: "Unknown",
      targetAudience: "general audience",
      connectedIntegrations,
      disclaimers: [
        ...mock.disclaimers,
        `API fallback used: ${errMsg}`,
      ],
    });
  }
}
