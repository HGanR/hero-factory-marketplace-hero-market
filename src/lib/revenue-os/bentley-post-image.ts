/**
 * Bentley campaign post visuals — DALL·E when configured, else deterministic placeholder image.
 */

export type BentleyPostImageContext = {
  platform?: string;
  unitKey?: string;
  campaignId?: string;
};

const MAX_PROMPT_CHARS = 900;
const STORAGE_URL_MAX = 512;

function hashSeed(parts: string[]): string {
  const raw = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = h >>> 0;
  return `b${n.toString(16).padStart(8, "0")}`;
}

export function buildBentleyPostImagePrompt(caption: string, tone: string, imageStyle: string): string {
  const cap = caption.trim().slice(0, 600);
  const t = (tone || "Professional").trim().slice(0, 80);
  const st = (imageStyle || "clean modern").trim().slice(0, 80);
  const base = [
    "Brand-safe marketing visual for social feed.",
    `Tone: ${t}.`,
    `Visual style: ${st}.`,
    "No overlaid text, no logos, no watermarks, no photorealistic faces.",
    cap ? `Concept inspired by post copy (do not render text): ${cap}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return base.slice(0, MAX_PROMPT_CHARS);
}

function placeholderImageUrl(prompt: string, ctx: BentleyPostImageContext): string {
  const seed = hashSeed([ctx.unitKey ?? "", ctx.campaignId ?? "", prompt.slice(0, 120)]);
  return `https://picsum.photos/seed/${seed}/1080/1080`;
}

async function openAiImageUrl(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

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

  const data = (await res.json().catch(() => ({}))) as { data?: { url?: string }[]; error?: { message?: string } };
  if (!res.ok) {
    console.warn("[bentley-post-image] OpenAI images error:", data?.error?.message ?? res.status);
    return null;
  }
  const url = data?.data?.[0]?.url?.trim();
  return url && url.length <= STORAGE_URL_MAX ? url : null;
}

/**
 * Returns a hosted HTTPS URL suitable for `campaign_assets.storage_url`, or null if nothing usable.
 * On OpenAI failure or missing key, uses a deterministic Picsum placeholder (still attaches an image when possible).
 */
export async function generateBentleyPostImage(
  prompt: string,
  context: BentleyPostImageContext
): Promise<{ storageUrl: string; provider: string } | null> {
  const p = prompt.trim();
  if (!p) return null;

  try {
    const openAi = await openAiImageUrl(p);
    if (openAi) {
      return { storageUrl: openAi, provider: "dall-e-3" };
    }
  } catch (e) {
    console.warn("[bentley-post-image] OpenAI request failed:", e instanceof Error ? e.message : e);
  }

  const fallback = placeholderImageUrl(p, context);
  if (fallback.length <= STORAGE_URL_MAX) {
    return { storageUrl: fallback, provider: "picsum_placeholder" };
  }
  return null;
}
