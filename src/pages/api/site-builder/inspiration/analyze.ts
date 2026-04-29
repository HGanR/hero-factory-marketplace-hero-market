/**
 * POST /api/site-builder/inspiration/analyze
 * One-off, user-initiated pattern extraction — not bulk crawling; no credentialed fetches.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getAuthedMarketplaceUserIdFromCookieHeader } from "@/lib/api/cookie-header-auth";
import { InspirationBriefSchema, type InspirationBrief } from "@/lib/site-builder/inspiration/inspiration-brief-schema";
import {
  extractInspirationSignalsFromHtml,
  fetchInspirationHtmlPublic,
  type InspirationPageSignals,
} from "@/lib/site-builder/inspiration/extract-inspiration-signals";
import { summarizeInspirationSignals, summarizeIndustryOnly } from "@/lib/site-builder/inspiration/inspiration-summarizer";

const BodySchema = z
  .object({
    url: z.string().max(2000).optional(),
    urls: z.array(z.string().max(2000)).max(4).optional(),
    industry: z.string().max(200).optional(),
    industryOnly: z.boolean().optional(),
  })
  .strict()
  .refine(
    (d) => (d.industryOnly ? Boolean(d.industry?.trim()) : Boolean(d.url?.trim() || (d.urls && d.urls.length > 0))),
    { message: "Provide a URL, urls[], or industryOnly with industry." },
  );

function mergeSignals(pages: InspirationPageSignals[]): InspirationPageSignals {
  if (pages.length === 0) {
    return {
      pageTitle: "",
      metaDescription: "",
      headings: [],
      paragraphs: [],
      ctaLabels: [],
      navLabels: [],
      linkLabels: [],
      colorHints: [],
      sectionHeadings: [],
    };
  }
  if (pages.length === 1) return pages[0]!;
  const [a, ...rest] = pages;
  let m = { ...a! };
  for (const p of rest) {
    m = {
      pageTitle: m.pageTitle || p.pageTitle,
      metaDescription: m.metaDescription || p.metaDescription,
      headings: [...m.headings, ...p.headings].slice(0, 40),
      paragraphs: [...m.paragraphs, ...p.paragraphs].slice(0, 50),
      ctaLabels: [...new Set([...m.ctaLabels, ...p.ctaLabels])].slice(0, 32),
      navLabels: [...new Set([...m.navLabels, ...p.navLabels])].slice(0, 24),
      linkLabels: [...new Set([...m.linkLabels, ...p.linkLabels])].slice(0, 40),
      colorHints: [...new Set([...m.colorHints, ...p.colorHints])].slice(0, 20),
      sectionHeadings: [...new Set([...m.sectionHeadings, ...p.sectionHeadings])].slice(0, 20),
    };
  }
  return m;
}

function normalizeUrlList(data: z.infer<typeof BodySchema>): string[] {
  if (data.industryOnly) return [];
  const raw: string[] = [];
  if (data.url?.trim()) raw.push(data.url.trim());
  for (const u of data.urls ?? []) {
    if (u.trim()) raw.push(u.trim());
  }
  return [...new Set(raw)].slice(0, 4);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const userId = getAuthedMarketplaceUserIdFromCookieHeader(req.headers.cookie);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let rawBody: unknown = req.body;
  if (typeof rawBody === "string") {
    try {
      rawBody = JSON.parse(rawBody) as unknown;
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }
  const data = parsed.data;

  try {
    if (data.industryOnly) {
      const b = summarizeIndustryOnly(data.industry!);
      const out = { inspirationBrief: InspirationBriefSchema.parse(b) };
      return res.status(200).json(out);
    }

    const toFetch = normalizeUrlList(data);
    if (toFetch.length === 0) {
      return res.status(400).json({ error: "No valid URLs to fetch." });
    }

    const pages: InspirationPageSignals[] = [];
    for (const u of toFetch) {
      const fetched = await fetchInspirationHtmlPublic(u);
      if (!fetched.ok) {
        return res.status(422).json({ error: fetched.message, code: fetched.code, retryable: fetched.code === "timeout" });
      }
      const signals = extractInspirationSignalsFromHtml(fetched.html);
      pages.push(signals);
    }
    const merged = mergeSignals(pages);
    const rawBrief: InspirationBrief = summarizeInspirationSignals(merged, {
      industry: data.industry?.trim(),
    });
    rawBrief.robotsNote = rawBrief.robotsNote
      ? rawBrief.robotsNote
      : "Respect robots.txt; this endpoint performs a single user-driven fetch per request for non-verbatim pattern analysis.";
    const inspirationBrief = InspirationBriefSchema.parse(rawBrief);
    return res.status(200).json({ inspirationBrief, analyzedUrlCount: toFetch.length, doNotCopyNotice: true as const });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return res.status(500).json({ error: msg });
  }
}
