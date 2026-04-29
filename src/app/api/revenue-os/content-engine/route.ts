import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { getAuthedUserId } from "@/lib/api/auth";
import { resolveUnifiedGenerationContext } from "@/lib/revenue-os/resolveUnifiedGenerationContext";
import { formatUnifiedGenerationPromptAddendum } from "@/lib/revenue-os/formatUnifiedGenerationPrompt";
import { serializeUnifiedGenerationForStorage } from "@/lib/generation-memory/serializeGenerationSnapshot";
import { withContentBatchRoutingSnapshot } from "@/lib/revenue-os/with-content-batch-routing-snapshot";
import {
  buildUnifiedGenerationAuditPayload,
  buildSignalStrengthPayload,
} from "@/lib/revenue-os/unified-generation-audit";
import { logUnifiedGenerationJson } from "@/lib/revenue-os/unified-generation-audit-log";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export interface ContentEngineInput {
  businessName: string;
  industry: string;
  targetAudience: string;
  coreOffer: string;
  transformation: string;
  tone: string;
  platform: string;
  contentType: string;
}

export interface ContentEngineOutput {
  captions: {
    hook: string;
    authority: string;
    curiosity: string;
    controversial: string;
    shortViral: string;
  };
  imagePrompts: string[];
  viralIdeas: Array<{
    title: string;
    description: string;
  }>;
  hooks: string[];
  fullPost: {
    caption: string;
    content: string;
    visualPrompt: string;
    hashtags: string[];
  };
}

const CONTENT_ENGINE_SYSTEM_PROMPT = `You are the Content Engine for the AI Revenue Operating System.

Your purpose is to generate high-engagement social media content that increases attention, curiosity, and sharing.

When given business information you must produce:

1. Scroll-stopping captions (5 styles: hook, authority, curiosity, controversial, short viral)
2. AI image prompts for visual content (3 prompts for Sora/Hedra/Midjourney)
3. Viral content ideas (5 ideas with titles and descriptions)
4. Hook variations (10 hooks)
5. A complete social post ready to publish

The outputs must be optimized for social platforms such as TikTok, Instagram, X, and LinkedIn.

Use psychological triggers such as: curiosity, controversy, authority, transformation, data insights, and myth busting.

Avoid exaggerated financial promises. Focus on strategic insight and value.

Always structure outputs clearly so users can immediately copy and publish the content.

Respond ONLY with valid JSON matching this exact structure:
{
  "captions": {
    "hook": "string",
    "authority": "string", 
    "curiosity": "string",
    "controversial": "string",
    "shortViral": "string"
  },
  "imagePrompts": ["string", "string", "string"],
  "viralIdeas": [
    {"title": "string", "description": "string"}
  ],
  "hooks": ["string"],
  "fullPost": {
    "caption": "string",
    "content": "string",
    "visualPrompt": "string",
    "hashtags": ["string"]
  }
}`;

function buildUserPrompt(input: ContentEngineInput, unifiedAddendum: string): string {
  const base = `Generate viral social media content for:

**Business:** ${input.businessName}
**Industry:** ${input.industry}
**Target Audience:** ${input.targetAudience}
**Core Offer:** ${input.coreOffer}
**Transformation/Outcome:** ${input.transformation}
**Tone:** ${input.tone}
**Platform:** ${input.platform}
**Content Type Focus:** ${input.contentType}

Generate scroll-stopping content optimized for ${input.platform}. Include all 5 output categories.`;
  const extra = unifiedAddendum.trim();
  if (!extra) return base;
  return `${base}\n\n${extra}`;
}

function extractJson(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // continue
      }
    }
    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(text.slice(braceStart, braceEnd + 1));
      } catch {
        // continue
      }
    }
  }
  return null;
}

function summarizeContentEngineOutputPopulated(c: ContentEngineOutput): Record<string, unknown> {
  const cap = c.captions;
  const captionsFilled = cap
    ? ["hook", "authority", "curiosity", "controversial", "shortViral"].filter(
        (k) => String((cap as Record<string, string>)[k] ?? "").trim().length > 0
      ).length
    : 0;
  const fp = c.fullPost;
  return {
    captionsFieldsNonEmpty: captionsFilled,
    hooksCount: Array.isArray(c.hooks) ? c.hooks.filter((h) => String(h).trim().length > 0).length : 0,
    imagePromptsCount: Array.isArray(c.imagePrompts) ? c.imagePrompts.length : 0,
    viralIdeasCount: Array.isArray(c.viralIdeas) ? c.viralIdeas.length : 0,
    fullPostCaptionChars: fp?.caption ? String(fp.caption).length : 0,
    fullPostContentChars: fp?.content ? String(fp.content).length : 0,
    fullPostHashtagsCount: Array.isArray(fp?.hashtags) ? fp.hashtags.length : 0,
  };
}

function generateFallbackContent(input: ContentEngineInput): ContentEngineOutput {
  const { businessName, industry, coreOffer, transformation, platform } = input;
  
  return {
    captions: {
      hook: `Most people in ${industry} are doing it wrong. Here's what actually works.`,
      authority: `After helping hundreds of ${input.targetAudience}, here's the #1 thing that moves the needle.`,
      curiosity: `This simple framework quietly builds successful ${industry} businesses.`,
      controversial: `The biggest lie in ${industry}? That you need to work harder, not smarter.`,
      shortViral: `${coreOffer}. That's it. That's the system.`,
    },
    imagePrompts: [
      `A futuristic entrepreneur in ${industry} standing in front of glowing data visualizations, neon blue and violet lighting, digital dashboards floating in the air, cinematic lighting, hyper-realistic, 4k, symbolizing ${transformation}`,
      `A modern digital command center showing growth metrics and success indicators, AI assistant hologram helping analyze data, cyberpunk business environment, high contrast lighting, ultra detailed, ${industry} themed`,
      `Luxury professional office with transparent digital screens showing progress graphs, sunset lighting through glass walls, minimalist high-end aesthetic, symbolizing ${transformation}`,
    ],
    viralIdeas: [
      { title: `The ${businessName} Method`, description: `Break down how ${coreOffer} leads to ${transformation}` },
      { title: `Why Most ${industry} Businesses Fail`, description: `Explain the common mistakes and how to avoid them` },
      { title: `AI Changed ${industry} Forever`, description: `Show how modern tools accelerate success` },
      { title: `The 3 Systems Every ${industry} Business Needs`, description: `Traffic, Conversion, and Delivery systems` },
      { title: `From Zero to ${transformation}`, description: `The step-by-step journey your audience wants` },
    ],
    hooks: [
      `Nobody talks about this ${industry} secret.`,
      `I built this after studying how successful ${industry} businesses grow.`,
      `If your ${industry} business isn't doing this, it will struggle.`,
      `This one system replaced 10 tools for our clients.`,
      `Most ${input.targetAudience} are missing this simple equation.`,
      `Stop scrolling. This will change how you think about ${industry}.`,
      `The truth about ${industry} that experts won't tell you.`,
      `I wish someone told me this when I started.`,
      `Here's the ${industry} playbook nobody shares.`,
      `${transformation} isn't luck. It's strategy.`,
    ],
    fullPost: {
      caption: `${transformation} isn't magic — it's a system.`,
      content: `Most ${input.targetAudience} try to grow by guessing.\n\nSuccessful ones grow through systems.\n\n${coreOffer}\n\nThat's the foundation of ${businessName}.\n\nThe question isn't IF it works.\n\nThe question is: are you ready to implement it?`,
      visualPrompt: `Futuristic digital dashboard displaying ${industry} success metrics, AI assistant helping ${input.targetAudience} analyze growth systems, glowing neon interface, cinematic lighting, 4k ultra detailed`,
      hashtags: [`#${industry.replace(/\s+/g, "")}`, "#BusinessGrowth", "#Entrepreneurship", `#${platform}`, "#AIBusiness", "#Strategy"],
    },
  };
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  const traceId = crypto.randomUUID();
  try {
    logBentleyCorrelationEvent("revenue-os/content-engine", req);
    const body = (await req.json()) as Record<string, unknown> & Partial<ContentEngineInput>;
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
      explicitCampaignBrief:
        typeof body.campaignBrief === "string" ? body.campaignBrief : undefined,
      skipConversion: body.skipConversionIntelligence === true,
      cloneFromVariantId,
    });
    if (!businessName || !industry || !targetAudience || !coreOffer) {
      return NextResponse.json(
        { error: "Missing required fields: businessName, industry, targetAudience, coreOffer" },
        { status: 400 }
      );
    }

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

    const unifiedAddendum = formatUnifiedGenerationPromptAddendum(unifiedCtx, userInputForPrompt);
    const userTrimLen = userInputForPrompt.trim().length;
    logUnifiedGenerationJson(
      buildUnifiedGenerationAuditPayload({
        route: "content-engine",
        ctx: unifiedCtx,
        userInputForPrompt,
        traceId,
      })
    );
    logUnifiedGenerationJson(
      buildSignalStrengthPayload({
        route: "content-engine",
        ctx: unifiedCtx,
        userInputLength: userTrimLen,
        traceId,
      })
    );

    const userPrompt = buildUserPrompt(input, unifiedAddendum);

    let result: ContentEngineOutput;

    try {
      const llmResponse = await invokeNpcLlm({
        systemPrompt: CONTENT_ENGINE_SYSTEM_PROMPT,
        userMessage: userPrompt,
        maxTokens: 2500,
        temperature: 0.8,
      });

      const llmText = String(llmResponse ?? "");
      logUnifiedGenerationJson({
        tag: "generation_output_audit",
        route: "content-engine",
        traceId,
        llmResponseCharCount: llmText.length,
        userPromptCharCount: userPrompt.length,
      });

      const parsed = extractJson(llmResponse);
      if (parsed && typeof parsed === "object") {
        result = parsed as ContentEngineOutput;
        logUnifiedGenerationJson({
          tag: "generation_output_audit",
          route: "content-engine",
          traceId,
          phase: "parsed",
          ...summarizeContentEngineOutputPopulated(result),
        });
      } else {
        console.warn("[Content Engine] Failed to parse LLM response, using fallback");
        logUnifiedGenerationJson({
          tag: "generation_fallback",
          route: "content-engine",
          traceId,
          reason: "parse_failed",
        });
        result = generateFallbackContent(input);
        logUnifiedGenerationJson({
          tag: "generation_output_audit",
          route: "content-engine",
          traceId,
          phase: "fallback_template",
          ...summarizeContentEngineOutputPopulated(result),
        });
      }
    } catch (llmError) {
      console.error("[Content Engine] LLM error:", llmError);
      logUnifiedGenerationJson({
        tag: "generation_fallback",
        route: "content-engine",
        traceId,
        reason: "llm_error",
      });
      result = generateFallbackContent(input);
      logUnifiedGenerationJson({
        tag: "generation_output_audit",
        route: "content-engine",
        traceId,
        phase: "fallback_template",
        ...summarizeContentEngineOutputPopulated(result),
      });
    }

    const snapshotCtx = withContentBatchRoutingSnapshot(unifiedCtx, {
      contentEngineResult: result,
    });
    const unifiedGenerationSnapshot = serializeUnifiedGenerationForStorage(snapshotCtx);

    return NextResponse.json({
      success: true,
      content: result,
      input,
      unifiedGeneration: {
        hadBentley: Boolean(unifiedCtx.bentleyMarketIntelligence),
        hadConversion: Boolean(unifiedCtx.conversionIntelligence),
        hadCampaignBrief: Boolean(unifiedCtx.campaignBrief.trim()),
        hadOperatorActions: Boolean(unifiedCtx.operatorNextActionsSummary),
      },
      unifiedGenerationSnapshot,
    });
  } catch (error: any) {
    console.error("[Content Engine] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate content" },
      { status: 500 }
    );
  }
}
