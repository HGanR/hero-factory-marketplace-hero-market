import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4J — Batch variations from unified context (optional winning-variant clone bias).
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { getAuthedUserId } from "@/lib/api/auth";
import { resolveUnifiedGenerationContext } from "@/lib/revenue-os/resolveUnifiedGenerationContext";
import { formatUnifiedGenerationPromptAddendum } from "@/lib/revenue-os/formatUnifiedGenerationPrompt";
import { serializeUnifiedGenerationForStorage } from "@/lib/generation-memory/serializeGenerationSnapshot";
import { withContentBatchRoutingSnapshot } from "@/lib/revenue-os/with-content-batch-routing-snapshot";
import { extractJsonFromLlmText } from "@/lib/revenue-os/extractLlmJson";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import { buildShortFormPlatformPack } from "@/lib/distribution/platformShortForm";

type ContentEngineInput = {
  businessName: string;
  industry: string;
  targetAudience: string;
  coreOffer: string;
  transformation: string;
  tone: string;
  platform: string;
  contentType: string;
};
import { getDb } from "@/lib/db";
import { bentleyContentQueueItems } from "@/lib/db/schema.bentley-social-leads";

export const runtime = "nodejs";

const BATCH_SYSTEM = `You are the Content Engine batch generator for the AI Revenue Operating System.

Return ONLY valid JSON:
{
  "variations": [
    {
      "variationIndex": 0,
      "captions": { "hook": "", "authority": "", "curiosity": "", "controversial": "", "shortViral": "" },
      "hooks": ["string"],
      "fullPost": { "caption": "", "content": "", "visualPrompt": "", "hashtags": ["string"] },
      "imagePrompts": ["string","string","string"],
      "viralIdeas": [{"title":"","description":""}]
    }
  ]
}

Rules:
- Produce EXACTLY N variations where N is given in the user message.
- All variations must preserve the SAME core offer, transformation promise, and strategic angle.
- Each variation must use DISTINCT hooks and opening lines (no duplicated first sentences).
- Hooks should explore different emotional triggers: curiosity, authority, contrarian, urgency, empathy.
- Keep each fullPost.caption under 2200 characters.
- No exaggerated financial promises.`;

function buildBatchUserMessage(
  input: ContentEngineInput,
  unifiedAddendum: string,
  variationCount: number
): string {
  const base = `Business: ${input.businessName}
Industry: ${input.industry}
Audience: ${input.targetAudience}
Offer: ${input.coreOffer}
Transformation: ${input.transformation}
Tone: ${input.tone}
Primary platform: ${input.platform}
Content type: ${input.contentType}

Generate EXACTLY ${variationCount} variations.

${unifiedAddendum}`;
  return base;
}

function coerceVariation(raw: unknown, index: number): ContentEngineOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fp = o.fullPost;
  const cap = o.captions;
  if (!fp || typeof fp !== "object" || !cap || typeof cap !== "object") return null;
  const fullPost = fp as Record<string, unknown>;
  const captions = cap as Record<string, unknown>;
  const hooks = Array.isArray(o.hooks) ? o.hooks.map(String) : [];
  return {
    captions: {
      hook: String(captions.hook ?? ""),
      authority: String(captions.authority ?? ""),
      curiosity: String(captions.curiosity ?? ""),
      controversial: String(captions.controversial ?? ""),
      shortViral: String(captions.shortViral ?? ""),
    },
    imagePrompts: Array.isArray(o.imagePrompts) ? o.imagePrompts.map(String).slice(0, 5) : ["", "", ""],
    viralIdeas: Array.isArray(o.viralIdeas)
      ? o.viralIdeas
          .slice(0, 5)
          .map((v) =>
            v && typeof v === "object"
              ? {
                  title: String((v as { title?: string }).title ?? ""),
                  description: String((v as { description?: string }).description ?? ""),
                }
              : { title: "", description: "" }
          )
      : [],
    hooks: hooks.length ? hooks : [String(captions.hook ?? "")],
    fullPost: {
      caption: String(fullPost.caption ?? ""),
      content: String(fullPost.content ?? ""),
      visualPrompt: String(fullPost.visualPrompt ?? ""),
      hashtags: Array.isArray(fullPost.hashtags) ? fullPost.hashtags.map(String) : [],
    },
  };
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/content-engine/batch-variations", req);
    const body = (await req.json()) as Record<string, unknown> & Partial<ContentEngineInput> & {
      variationCount?: number;
      enqueueToQueue?: boolean;
      cloneFromVariantId?: string;
      generationVariantId?: string | null;
    };

    const {
      businessName,
      industry,
      targetAudience,
      coreOffer,
      transformation,
      tone,
      platform,
      contentType,
    } = body;

    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const extraNotes =
      typeof body.notes === "string"
        ? body.notes
        : typeof body.campaignNotes === "string"
          ? body.campaignNotes
          : "";
    const cloneFromVariantId =
      typeof body.cloneFromVariantId === "string" ? body.cloneFromVariantId.trim() : undefined;

    const { context: unifiedCtx, userInputForPrompt } = await resolveUnifiedGenerationContext({
      body,
      userId,
      userNotes: extraNotes,
      explicitCampaignBrief: typeof body.campaignBrief === "string" ? body.campaignBrief : undefined,
      skipConversion: body.skipConversionIntelligence === true,
      cloneFromVariantId,
    });
    const unifiedAddendum = formatUnifiedGenerationPromptAddendum(unifiedCtx, userInputForPrompt);

    if (!businessName || !industry || !targetAudience || !coreOffer) {
      return NextResponse.json(
        { error: "Missing required fields: businessName, industry, targetAudience, coreOffer" },
        { status: 400 }
      );
    }

    const n = Math.min(10, Math.max(5, parseInt(String(body.variationCount ?? 6), 10) || 6));
    const input: ContentEngineInput = {
      businessName: businessName.trim(),
      industry: industry.trim(),
      targetAudience: targetAudience.trim(),
      coreOffer: coreOffer.trim(),
      transformation: (transformation || "").trim() || "business growth and success",
      tone: (tone || "").trim() || "professional",
      platform: (platform || "").trim() || "Instagram",
      contentType: (contentType || "").trim() || "Full Post",
    };

    const userMessage = buildBatchUserMessage(input, unifiedAddendum, n);
    const llmResponse = await invokeNpcLlm({
      systemPrompt: BATCH_SYSTEM,
      userMessage,
      maxTokens: 4500,
      temperature: 0.85,
    });

    const parsed = extractJsonFromLlmText(llmResponse) as { variations?: unknown[] } | null;
    const rawList = parsed?.variations;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json({ error: "Batch model returned no variations" }, { status: 502 });
    }

    const variations: ContentEngineOutput[] = [];
    for (let i = 0; i < rawList.length; i++) {
      const v = coerceVariation(rawList[i], i);
      if (v) variations.push(v);
    }
    if (variations.length < Math.min(3, n)) {
      return NextResponse.json({ error: "Too few valid variations after parsing" }, { status: 502 });
    }

    const snapshotCtx = withContentBatchRoutingSnapshot(unifiedCtx, {
      contentEngineResult: variations[0] ?? null,
    });
    const unifiedGenerationSnapshot = serializeUnifiedGenerationForStorage(snapshotCtx);
    const batchId = randomUUID();
    const genVar =
      typeof body.generationVariantId === "string" && body.generationVariantId.trim()
        ? body.generationVariantId.trim()
        : null;

    const enriched = variations.map((v, i) => ({
      content: v,
      shortForm: buildShortFormPlatformPack(v, input.businessName),
    }));

    let queuedIds: string[] = [];
    if (body.enqueueToQueue === true) {
      const db = await getDb();
      queuedIds = [];
      for (let i = 0; i < enriched.length; i++) {
        const id = randomUUID();
        const row = enriched[i];
        await db.insert(bentleyContentQueueItems).values({
          id,
          userId,
          generationVariantId: genVar,
          batchId,
          variationIndex: i,
          queueStatus: "draft",
          platformFormat: "multi",
          title: `${input.businessName.slice(0, 80)} · batch ${batchId.slice(0, 8)} · #${i + 1}`,
          payloadJson: {
            schemaVersion: 1,
            variationIndex: i,
            batchId,
            content: row.content,
            shortForm: row.shortForm,
            unifiedGenerationSnapshot,
          },
        });
        queuedIds.push(id);
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      variationCount: enriched.length,
      variations: enriched,
      unifiedGenerationSnapshot,
      queuedItemIds: queuedIds,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Batch generation failed";
    console.error("[batch-variations]", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
