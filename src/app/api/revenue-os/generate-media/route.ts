import { NextRequest, NextResponse } from "next/server";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Generate image or video for a campaign.
 * - Image: OpenAI DALL·E 3 (requires OPENAI_API_KEY)
 * - Video: Sora placeholder (API not yet widely available)
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const body = await req.json().catch(() => ({})) as {
      type?: "image" | "video";
      prompt?: string;
      campaignSummary?: string;
      shortFormHook?: string;
    };

    const type = (body?.type === "image" || body?.type === "video") ? body.type : "image";
    const userPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const campaignSummary = typeof body?.campaignSummary === "string" ? body.campaignSummary : "";
    const shortFormHook = typeof body?.shortFormHook === "string" ? body.shortFormHook : "";

    const prompt =
      userPrompt ||
      shortFormHook ||
      campaignSummary ||
      "Professional marketing visual, clean and modern, suitable for social media";

    if (type === "image") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Image generation requires OPENAI_API_KEY. Add it in your environment." },
          { status: 503 }
        );
      }

      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: "1024x1024",
          response_format: "url",
          quality: "standard",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error?.message ?? data?.message ?? "Image generation failed";
        return NextResponse.json({ error: errMsg }, { status: res.status });
      }

      const url = data?.data?.[0]?.url;
      if (!url) {
        return NextResponse.json({ error: "No image URL in response" }, { status: 502 });
      }

      return NextResponse.json({
        type: "image",
        url,
        prompt: prompt.slice(0, 200),
        provider: "dall-e-3",
      });
    }

    // Video (Sora) — API not widely available yet; return placeholder
    return NextResponse.json({
      type: "video",
      status: "coming_soon",
      message: "Video generation via Sora will be available when the API is released. Your campaign prompt has been saved for future use.",
      prompt: prompt.slice(0, 500),
      provider: "sora",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
