import { NextRequest, NextResponse } from "next/server";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Image Prompt API — produces a formatted prompt for users to paste into
 * external image apps (Midjourney, DALL·E, Stable Diffusion, etc.).
 * No image generation — avoids API costs.
 */

const STYLE_PRESETS: Record<string, string> = {
  cinematic:
    "cinematic widescreen movie poster style, dramatic lighting, film grain, deep shadows, professional color grading",
  bold: "bold graphic design, large impactful typography overlay space, high contrast, eye-catching colors, social media optimized",
  minimal: "clean minimalist design, lots of white space, subtle gradients, modern sans-serif aesthetic, elegant",
  vibrant: "vibrant saturated colors, energetic, dynamic composition, pop art inspired, bright and exciting",
  dark: "dark moody atmosphere, deep blacks, neon accent lighting, cyberpunk aesthetic, dramatic shadows",
  neon: "neon glow effects, synthwave aesthetic, electric purple and cyan colors, retro-futuristic, glowing outlines",
};

export interface ImagePromptRequest {
  prompt: string;
  style?: string;
}

export interface ImagePromptResponse {
  fullPrompt: string;
  basePrompt: string;
  style?: string;
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const body = (await req.json().catch(() => ({}))) as ImagePromptRequest;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const style = typeof body?.style === "string" ? body.style.trim().toLowerCase() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

    const styleSuffix = style && STYLE_PRESETS[style] ? STYLE_PRESETS[style] : "";
    const fullPrompt = styleSuffix ? `${prompt}. Style: ${styleSuffix}` : prompt;

    return NextResponse.json({
      fullPrompt,
      basePrompt: prompt,
      ...(style && STYLE_PRESETS[style] ? { style } : {}),
    } satisfies ImagePromptResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
