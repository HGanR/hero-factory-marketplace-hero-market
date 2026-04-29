import { NextResponse } from "next/server";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const MAX_INDUSTRY = 200;
const MAX_AUDIENCE = 200;

async function wikipediaContext(industry: string): Promise<{ title: string | null; extract: string | null; url: string | null }> {
  const q = industry.trim().slice(0, 120);
  if (q.length < 2) return { title: null, extract: null, url: null };
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json&origin=*`;
    const r = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "HeroMarketRevenueOS/1.0 (campaign-notes-crawl)",
      },
      next: { revalidate: 86400 },
    });
    if (!r.ok) return { title: null, extract: null, url: null };
    const data = (await r.json()) as [string, string[], string[], string[]];
    const title = data[1]?.[0];
    const url = data[3]?.[0] ?? null;
    if (!title) return { title: null, extract: null, url: null };
    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    const sr = await fetch(sumUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "HeroMarketRevenueOS/1.0 (campaign-notes-crawl)",
      },
      next: { revalidate: 86400 },
    });
    if (!sr.ok) return { title, extract: null, url };
    const j = (await sr.json()) as { extract?: string };
    const extract = typeof j.extract === "string" ? j.extract.slice(0, 1200) : null;
    return { title, extract, url };
  } catch {
    return { title: null, extract: null, url: null };
  }
}

function fallbackNotesBlock(params: {
  industry: string;
  targetAudience: string;
  wikiTitle: string | null;
  wikiExtract: string | null;
  wikiUrl: string | null;
}): string {
  const lines: string[] = [
    "## Industry web crawl (automated)",
    "",
    `**Focus industry:** ${params.industry}`,
    `**Target audience:** ${params.targetAudience || "general"}`,
    "",
  ];
  if (params.wikiExtract?.trim()) {
    lines.push("### Reference snapshot (Wikipedia)");
    lines.push(params.wikiExtract.trim());
    if (params.wikiUrl) lines.push(`Source: ${params.wikiUrl}`);
    lines.push("");
  }
  lines.push("### How to use this block");
  lines.push(
    "• Treat the reference as background — validate claims for your niche.",
    "• Pair with Research Assistant findings and Trends for channel-specific execution.",
    "• Bentley appended this block to your Notes so Generate Campaign has structured context.",
    ""
  );
  return lines.join("\n").trim();
}

const SYSTEM = `You are Bentley’s industry research assistant. Given an industry label, audience, and optional Wikipedia extract, write a concise **markdown** section for “Campaign notes” in a revenue operating system.

Rules:
- Output plain markdown only (no JSON, no code fences).
- Start with exactly: ## Industry web crawl (Bentley)
- Include subsections ### Market context, ### Buyer/job-to-be-done signals, ### Content & positioning angles (bullet lists).
- Every bullet must tie back to the stated industry and audience; be specific, not generic platitudes.
- If Wikipedia extract is empty, infer carefully from industry name only and label assumptions explicitly in one short line.
- Keep total length under 900 words.`;

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let industry = "";
  let targetAudience = "";
  try {
    logBentleyCorrelationEvent("revenue-os/campaign-notes-crawl", req);
    const body = await req.json().catch(() => ({}));
    industry = typeof body?.industry === "string" ? body.industry.trim().slice(0, MAX_INDUSTRY) : "";
    targetAudience =
      typeof body?.targetAudience === "string" ? body.targetAudience.trim().slice(0, MAX_AUDIENCE) : "";

    if (industry.length < 2) {
      return NextResponse.json({ error: "industry is required (min 2 characters)" }, { status: 400 });
    }

    const { title, extract, url } = await wikipediaContext(industry);
    const wikiHint = extract
      ? `Wikipedia — ${title ?? industry}:\n${extract}`
      : "No Wikipedia summary matched; use industry name only.";

    const userMsg = `Industry: "${industry}"
Target audience: "${targetAudience || "general audience"}"
${wikiHint}
${url ? `Article URL: ${url}` : ""}

Write the markdown notes section.`;

    const llm = await invokeNpcLlm([
      { role: "system", content: SYSTEM },
      { role: "user", content: userMsg },
    ]);

    const notesBlock =
      llm?.trim() && llm.length > 40
        ? llm.trim()
        : fallbackNotesBlock({
            industry,
            targetAudience: targetAudience || "general audience",
            wikiTitle: title,
            wikiExtract: extract,
            wikiUrl: url,
          });

    const sources: string[] = [];
    if (url) sources.push(url);
    sources.push("Wikipedia API (opensearch + page summary)");

    return NextResponse.json({
      notesBlock,
      sources,
      meta: { wikipediaTitle: title, hadExtract: Boolean(extract?.trim()) },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crawl failed" },
      { status: 500 }
    );
  }
}
