import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { invokeNpcLlm } from "@/lib/npc/llm";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/** Fallback brief when LLM is unavailable (no NPC_LLM_ENDPOINT or empty response). */
function buildFallbackBrief(
  industry: string,
  targetAudience: string,
  offerStatement: string,
  messagePillars: string[],
  shortFormHooks: string[],
  campaignAngles: string[]
): string {
  const hook1 = shortFormHooks[0] ?? offerStatement?.slice(0, 80) ?? "Professional marketing visual";
  const hook2 = shortFormHooks[1] ?? messagePillars[0]?.slice(0, 80) ?? hook1;
  const hook3 = shortFormHooks[2] ?? campaignAngles[0]?.slice(0, 80) ?? hook1;

  return `1. IMAGE PROMPT (for DALL·E, Midjourney, etc.)
   - ${hook1}, photorealistic, soft key lighting, medium shot, 35mm lens, professional mood — ${industry} marketing
   - ${hook2}, stylized cartoon, warm lighting, close-up, 50mm lens, energetic — for ${targetAudience}
   - ${hook3}, hybrid realistic/cartoon, natural light, establishing shot, wide angle, aspirational — ${industry} campaign

2. VIDEO SCRIPT (for Sora, Runway, etc.)
   [0–3s] HOOK: "${hook1}"
   [3–15s] KEY MESSAGE: ${offerStatement || "Deliver clear value proposition."}
   [15–20s] VISUAL: Medium shot, person addressing camera. Transition to product/result.
   [20–30s] CTA: "Comment PLAN for the full guide." Style: photorealistic or stylized. Pacing: punchy, 15–25 seconds.

3. CAMERA & PRODUCTION SETTINGS
   - Angles: establishing (wide), medium (waist-up), close-up (face/hands)
   - Lenses: 35mm for context, 50mm for interviews, 85mm for b-roll
   - Lighting: key/fill 2:1, soft backlight. Mood: professional yet approachable
   - Style: photorealistic for ads, stylized for social. Platform: vertical 9:16 for TikTok/Reels, 16:9 for YouTube

4. HOOK VARIANTS FOR PLATFORMS
   - TikTok/Reels: "${hook1}"
   - YouTube: "${hook2}"
   - Ads: "${hook3}"
`.trim();
}

/**
 * Compiles all campaign input into an industry-standard media brief for pasting
 * into ChatGPT, Sora, Midjourney, Runway, etc. No image/video API calls — user
 * copies the output and pastes into their chosen platform.
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/compile-media-brief", req);
    const body = await req.json().catch(() => ({})) as {
      industry?: string;
      targetAudience?: string;
      offerStatement?: string;
      messagePillars?: string[];
      shortFormHooks?: string[];
      campaignAngles?: string[];
      objectionReplies?: string[];
      longFormOutlines?: Array<{ title?: string; sections?: string[]; cta?: string }>;
      notes?: string;
    };

    const industry = String(body?.industry ?? "").trim() || "General";
    const targetAudience = String(body?.targetAudience ?? "").trim() || "general audience";
    const offerStatement = String(body?.offerStatement ?? "").trim();
    const messagePillars = Array.isArray(body?.messagePillars) ? body.messagePillars : [];
    const shortFormHooks = Array.isArray(body?.shortFormHooks) ? body.shortFormHooks : [];
    const campaignAngles = Array.isArray(body?.campaignAngles) ? body.campaignAngles : [];
    const objectionReplies = Array.isArray(body?.objectionReplies) ? body.objectionReplies : [];
    const longFormOutlines = Array.isArray(body?.longFormOutlines) ? body.longFormOutlines : [];
    const notes = String(body?.notes ?? "").trim();

    const system = `You produce a single, copy-paste-ready media brief in plain text (no markdown). This will be pasted into ChatGPT, Sora, Midjourney, Runway, DALL·E, or similar tools. Output must be INDUSTRY-STANDARD quality for professional media production.

Include these sections in order, each clearly labeled:

1. IMAGE PROMPT (for DALL·E, Midjourney, etc.)
   - One rich prompt per line (3–5 variations)
   - Include: subject, style (realistic / cartoon / mixed), lighting, camera angle, lens suggestion (e.g. 35mm, wide, macro), mood, industry-specific aesthetic
   - Example structure: "[Subject], [style], [lighting], [angle], [lens], [mood] — for [industry] marketing"

2. VIDEO SCRIPT (for Sora, Runway, etc.)
   - 15–30 second script with scene direction
   - Include: hook, key message, CTA, pacing notes
   - Add VISUAL DIRECTIONS: shots, angles, transitions, style (realistic/cartoon/both)

3. CAMERA & PRODUCTION SETTINGS
   - Suggested angles: establishing, close-up, over-shoulder, etc.
   - Lens choices and why (e.g. "35mm for environmental context")
   - Lighting: key/fill/back, mood
   - Style options: photorealistic, stylized/cartoon, hybrid
   - Platform-specific notes (TikTok vs YouTube vs ads)

4. HOOK VARIANTS FOR PLATFORMS
   - 3 hooks optimized for: short-form (TikTok/Reels), YouTube, ads
   - Each under 100 chars where applicable

Use industry-specific language and visuals that match ${industry}. Target audience: ${targetAudience}.`;

    const user = `
Industry: ${industry}
Target audience: ${targetAudience}

Offer statement: ${offerStatement}

Message pillars:
${messagePillars.map((p) => `• ${p}`).join("\n")}

Short-form hooks:
${shortFormHooks.map((h) => `"${h}"`).join("\n")}

Campaign angles:
${campaignAngles.map((a) => `• ${a}`).join("\n")}

Objection replies (use tone):
${objectionReplies.slice(0, 3).map((r) => `• ${r}`).join("\n")}

Long-form outline CTA(s):
${longFormOutlines.map((o) => o.cta ?? "").filter(Boolean).join(" | ")}

Additional context:
${notes.slice(0, 500)}

Produce the complete media brief now. Plain text only, no markdown headers or code blocks.
`.trim();

    let text: string | null = null;
    try {
      text = await invokeNpcLlm([
        { role: "system", content: system },
        { role: "user", content: user },
      ]);
    } catch (llmErr) {
      console.warn("[compile-media-brief] LLM failed, using fallback:", llmErr);
    }

    let brief = String(text ?? "").trim();
    if (!brief) {
      brief = buildFallbackBrief(
        industry,
        targetAudience,
        offerStatement,
        messagePillars,
        shortFormHooks,
        campaignAngles
      );
    }

    return NextResponse.json({
      brief,
      industry,
      targetAudience,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
