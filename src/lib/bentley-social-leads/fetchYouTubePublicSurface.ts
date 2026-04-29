/**
 * YouTube channel / @handle public page — ytInitialData JSON when present.
 */

import { fetchGenericPublicSocialSurface } from "./fetchGenericPublicSocialSurface";
import {
  extractDescription,
  extractTitle,
  fetchPublicHtml,
  parseCountToken,
  PRIVATE_OR_LOGIN_HINTS,
} from "./publicSurfaceHtml";
import { classifyComments } from "./classifyComments";
import { summarizePostMetadata } from "./summarizePostMetadata";
import type { AccessStatus, PublicCommentMeta, PublicPostMeta, PublicSocialSurface } from "./types";

function extractYtInitialData(html: string): unknown | null {
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\n\});/);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1]) as unknown;
    } catch {
      /* fall through */
    }
  }
  const m2 = html.match(/ytInitialData"\s*:\s*(\{[\s\S]{100,}?)\s*,\s*"ytInitialPlayerResponse"/);
  if (m2?.[1]) {
    try {
      return JSON.parse(m2[1] + "}") as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

function parseSubscriberText(t: string): number | undefined {
  const s = t.replace(/subscribers?/i, "").trim();
  const numMatch = s.match(/([\d,.]+)\s*([KMB]?)/i);
  if (numMatch) {
    const n = parseCountToken(`${numMatch[1]}${numMatch[2] || ""}`);
    if (n != null) return n;
  }
  return undefined;
}

function digChannelStats(obj: unknown): { subscribers?: number; title?: string; bio?: string } {
  const out: { subscribers?: number; title?: string; bio?: string } = {};
  const walk = (v: unknown, depth: number): void => {
    if (depth > 18 || v == null) return;
    if (typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const subText =
        (o.subscriberCountText as { simpleText?: string } | undefined)?.simpleText ??
        (typeof o.subscriberCountText === "string" ? o.subscriberCountText : undefined);
      if (subText && out.subscribers == null) {
        const n = parseSubscriberText(subText);
        if (n != null) out.subscribers = n;
      }
      if (typeof o.subscriberCount === "string" && out.subscribers == null) {
        const n = parseInt(o.subscriberCount.replace(/\D/g, ""), 10);
        if (!Number.isNaN(n)) out.subscribers = n;
      }
      const title =
        (o.title as { simpleText?: string } | undefined)?.simpleText ??
        (typeof o.title === "string" ? o.title : undefined);
      if (title && !out.title) out.title = title;
      const desc = typeof o.description === "string" ? o.description : undefined;
      if (desc && desc.length > 20 && !out.bio) out.bio = desc.slice(0, 2000);
      for (const k of Object.keys(o)) walk(o[k], depth + 1);
    } else if (Array.isArray(v)) {
      for (const x of v.slice(0, 60)) walk(x, depth + 1);
    }
  };
  walk(obj, 0);
  return out;
}

function extractComments(html: string): PublicCommentMeta[] {
  const snippets: PublicCommentMeta[] = [];
  const chunk = html.slice(0, 400_000);
  const bits = chunk.match(/>([^<]{20,320})</g)?.slice(0, 40) ?? [];
  for (const bit of bits) {
    const text = bit.replace(/^>|<$/g, "").trim();
    if (text.length < 20) continue;
    if (/cookie|javascript|ytInitialData/i.test(text)) continue;
    snippets.push({ text: text.slice(0, 500), classifications: classifyComments(text) });
    if (snippets.length >= 15) break;
  }
  return snippets;
}

export async function fetchYouTubePublicSurface(profileUrl: string): Promise<PublicSocialSurface> {
  const extractionNotes: string[] = ["YouTube: parsing ytInitialData / meta for channel stats."];

  const res = await fetchPublicHtml(profileUrl);
  if (!res.html || res.status >= 500) {
    const g = await fetchGenericPublicSocialSurface(profileUrl);
    return { ...g, extractionNotes: [...extractionNotes, "Fetch failed — generic fallback."] };
  }

  const html = res.html;
  const title = extractTitle(html);
  const desc = extractDescription(html);
  const joined = `${html}\n${title ?? ""}\n${desc ?? ""}`;

  for (const hint of PRIVATE_OR_LOGIN_HINTS) {
    if (hint.test(joined)) {
      const g = await fetchGenericPublicSocialSurface(profileUrl);
      return { ...g, extractionNotes: [...extractionNotes, "Restricted/login signal — generic fallback."] };
    }
  }

  let url: URL;
  try {
    url = new URL(res.url);
  } catch {
    return fetchGenericPublicSocialSurface(profileUrl);
  }

  const path = url.pathname;
  let handle = "";
  if (path.includes("/@")) {
    handle = path.split("/@")[1]?.split("/")[0] ?? "";
  } else if (path.includes("/channel/")) {
    handle = path.split("/channel/")[1]?.split("/")[0] ?? "";
  } else if (path.includes("/c/")) {
    handle = path.split("/c/")[1]?.split("/")[0] ?? "";
  } else {
    handle = path.split("/").filter(Boolean)[0] ?? "";
  }

  const yt = extractYtInitialData(html);
  const stats = yt ? digChannelStats(yt) : {};
  if (stats.subscribers != null) extractionNotes.push("Subscriber count from ytInitialData walk.");

  const displayName = stats.title || title?.replace(/\s*-\s*YouTube\s*$/i, "").trim() || handle;
  const bio = stats.bio || (desc && desc.length > 15 ? desc : undefined);

  let accessStatus: AccessStatus = "access_limited";
  const accessNotes: string[] = [];
  if (html.length < 1200) accessNotes.push("Thin HTML — possible consent or bot interstitial.");
  else if (displayName || stats.subscribers != null || desc) accessStatus = "public";

  const posts: PublicPostMeta[] = summarizePostMetadata(html, displayName, bio);
  const comments = extractComments(html);

  return {
    accessStatus,
    handle,
    displayName,
    bio,
    followerCount: stats.subscribers,
    followingCount: undefined,
    linkInBio: undefined,
    profileUrlResolved: res.url,
    posts,
    comments,
    accessNotes,
    extractionNotes,
    rawHtmlSnippet: html.slice(0, 4000),
  };
}
