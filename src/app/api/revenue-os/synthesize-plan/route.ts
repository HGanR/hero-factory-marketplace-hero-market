import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { getKnowledgeForNpc, getNpcRowByNpcId } from "@/lib/npc/db";
import { getAuthedUserId } from "@/lib/api/auth";
import type { TrendsResponse, TrendItem } from "@/lib/revenue-os/trends-schema";
import { resolveUnifiedGenerationContext } from "@/lib/revenue-os/resolveUnifiedGenerationContext";
import { formatUnifiedGenerationPromptAddendum } from "@/lib/revenue-os/formatUnifiedGenerationPrompt";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
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

async function getNpcKnowledge(npcId: string): Promise<string> {
  try {
    const { getNpcRowByNpcId: getRow, getKnowledgeForNpc: getK } = await import("@/lib/npc/db");
    const npcRow = await getRow(npcId);
    if (!npcRow) return "";
    const knowledge = await getK(npcRow.id);
    if (knowledge.length === 0) return "";
    return knowledge.map((k) => `[${k.topic}] ${k.content}`).join("\n");
  } catch {
    return "";
  }
}

/** Pick item with highest engagement signal for "top comment" emphasis. */
function pickTopEngagementItem(items: TrendItem[]): TrendItem | null {
  if (!items?.length) return null;
  let best: TrendItem | null = null;
  let bestScore = -1;
  for (const it of items) {
    const eng = it.engagement && typeof it.engagement === "object" ? it.engagement : null;
    const views = eng?.views ?? 0;
    const likes = eng?.likes ?? 0;
    const comments = eng?.comments ?? 0;
    const score = (views || 0) + (likes || 0) * 2 + (comments || 0) * 3;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best ?? items[0] ?? null;
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/synthesize-plan", req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const trends = body?.trends as TrendsResponse | null;
    const research = body?.research as { whatPeopleWant?: string[]; commentsBySource?: Array<{ source: string; themes: string[]; sampleComments?: string[] }>; marketingTips?: string[] } | null;

    const userId = await getAuthedUserId();
    const operatorNotes = typeof body?.operatorNotes === "string" ? String(body.operatorNotes) : "";
    const { context: unifiedCtx, userInputForPrompt } = await resolveUnifiedGenerationContext({
      body,
      userId,
      userNotes: operatorNotes,
      skipConversion: body.skipConversionIntelligence === true,
    });
    const unifiedAddendum = formatUnifiedGenerationPromptAddendum(unifiedCtx, userInputForPrompt);

    if (!trends?.items?.length) {
      return NextResponse.json(
        { error: "trends with items is required" },
        { status: 400 }
      );
    }

    const topItem = pickTopEngagementItem(trends.items);
    const topCommentInsight = topItem?.commentInsights?.[0] ?? "High-engagement pattern identified.";
    const npcKnowledge = await getNpcKnowledge("ai-revenue-trends");

    const system = `You produce strict JSON only. Output: { "consultantPlan": string, "campaignBrief": string }.
consultantPlan: A step-by-step plan for the consultant to instruct the client on launching the marketing campaign. Include: (1) Key insights from top-performing content, (2) The top comment/insight to leverage: "${topCommentInsight}", (3) Platform-specific actions, (4) Timeline suggestion.
campaignBrief: A structured brief for "Paste Notes → Generate Campaign" with TWO parts. Part 1 — SOLUTION ROADMAP: numbered steps that equate each campaign angle to an action (e.g. "Angle 1: [angle] → Action: [specific step]"). Part 2 — CAMPAIGN CONTEXT: 2–3 paragraphs combining trends, content blueprints, and the top insight. No markdown, plain text.`;

    const itemsSummary = trends.items.slice(0, 9).map((it) => {
      const eng = it.engagement && typeof it.engagement === "object" ? it.engagement : null;
      return `[${it.platform}] ${it.title} | why: ${(it.whyTrending || "").slice(0, 100)} | engagement: views=${eng?.views ?? "—"} likes=${eng?.likes ?? "—"} comments=${eng?.comments ?? "—"} | insights: ${(it.commentInsights ?? []).slice(0, 2).join("; ")}`;
    }).join("\n");

    const researchSummary = research
      ? `Research: What people want: ${(research.whatPeopleWant ?? []).join("; ")}. Marketing tips: ${(research.marketingTips ?? []).join("; ")}.`
      : "";

    const user = `
Context (NPC Knowledge):
${npcKnowledge}

Industry: ${trends.industry ?? ""}
Target audience: ${trends.targetAudience ?? ""}

Trends items:
${itemsSummary}

Campaign angles: ${(trends.campaignAngles ?? []).join(" | ")}
Content blueprints: ${JSON.stringify(trends.contentBlueprints ?? [])}

${researchSummary}

${unifiedAddendum}

Top engagement insight to emphasize: "${topCommentInsight}"

Produce JSON:
{ "consultantPlan": "...", "campaignBrief": "..." }
`.trim();

    const text = await invokeNpcLlm([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    const extracted = extractJson(String(text ?? ""));
    if (!extracted || typeof extracted !== "object") {
      const fallbackPlan = `Consultant plan for ${trends.industry} / ${trends.targetAudience}:
1. Review top-performing content patterns from YouTube, TikTok, Reddit.
2. Key insight to leverage: ${topCommentInsight}
3. Use campaign angles: ${(trends.campaignAngles ?? []).slice(0, 3).join("; ")}
4. Launch in phases: Week 1–2 hooks, Week 3–4 long-form, Week 5+ iterate.`;

      const fallbackBrief = `Trends for ${trends.industry} targeting ${trends.targetAudience}. Top insight: ${topCommentInsight}. Campaign angles: ${(trends.campaignAngles ?? []).join(". ")}. Content blueprints: ${(trends.contentBlueprints ?? []).map((b: { platform?: string; hook?: string }) => `${b.platform}: ${b.hook}`).join(". ")}.`;

      return NextResponse.json({
        consultantPlan: fallbackPlan,
        campaignBrief: fallbackBrief,
        industry: trends.industry ?? "",
        targetAudience: trends.targetAudience ?? "",
        campaignAngles: trends.campaignAngles ?? [],
        contentBlueprints: trends.contentBlueprints ?? [],
      });
    }

    const plan = (extracted as { consultantPlan?: string }).consultantPlan ?? "";
    const brief = (extracted as { campaignBrief?: string }).campaignBrief ?? "";
    return NextResponse.json({
      consultantPlan: typeof plan === "string" ? plan : String(plan),
      campaignBrief: typeof brief === "string" ? brief : String(brief),
      industry: trends.industry ?? "",
      targetAudience: trends.targetAudience ?? "",
      campaignAngles: trends.campaignAngles ?? [],
      contentBlueprints: trends.contentBlueprints ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
