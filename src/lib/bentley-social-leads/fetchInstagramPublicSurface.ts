/**
 * Instagram public profile page — HTML + embedded JSON hints only (no login, no API keys).
 */

import { fetchGenericPublicSocialSurface } from "./fetchGenericPublicSocialSurface";
import {
  extractDescription,
  extractTitle,
  fetchPublicHtml,
  PRIVATE_OR_LOGIN_HINTS,
  sniffFollowerCounts,
} from "./publicSurfaceHtml";
import { classifyComments } from "./classifyComments";
import { summarizePostMetadata } from "./summarizePostMetadata";
import type { AccessStatus, PublicCommentMeta, PublicPostMeta, PublicSocialSurface } from "./types";

function extractHandleFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] ?? "";
}

function parseInstagramEmbeddedCounts(html: string): { followers?: number; following?: number } {
  const out: { followers?: number; following?: number } = {};
  const jm = html.match(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)/);
  if (jm) out.followers = parseInt(jm[1], 10);
  const jm2 = html.match(/"edge_follow":\s*\{\s*"count":\s*(\d+)/);
  if (jm2) out.following = parseInt(jm2[1], 10);
  const jm3 = html.match(/"follower_count":\s*(\d+)/);
  if (jm3 && out.followers == null) out.followers = parseInt(jm3[1], 10);
  return out;
}

function parseInstagramBio(html: string, description?: string): string | undefined {
  const bioMatch = html.match(/"biography":\s*"((?:[^"\\]|\\.)*)"/);
  if (bioMatch) {
    try {
      return JSON.parse(`"${bioMatch[1].replace(/\\"/g, '"')}"`) as string;
    } catch {
      /* fall through */
    }
  }
  const alt = html.match(/"biography_with_entities":\s*\{\s*"raw_text":\s*"((?:[^"\\]|\\.)*)"/);
  if (alt) {
    try {
      return JSON.parse(`"${alt[1].replace(/\\"/g, '"')}"`) as string;
    } catch {
      /* fall through */
    }
  }
  if (description && description.length > 8) {
    const strip = description.replace(/\s*·\s*Instagram photos and videos\s*$/i, "").trim();
    if (strip.length > 8) return strip.slice(0, 2000);
  }
  return undefined;
}

function sniffExternalLink(html: string): string | undefined {
  const skip =
    /instagram\.com|facebook\.com|fb\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|google\.com|gstatic/i;
  const patterns = [
    /"external_url":\s*"([^"]+)"/,
    /href=["'](https?:\/\/[^"']+)["'][^>]*rel=["']me["']/i,
    /rel=["']me["'][^>]*href=["'](https?:\/\/[^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && !skip.test(m[1])) {
      return m[1].replace(/\\u0026/g, "&").replace(/&amp;/g, "&").slice(0, 2000);
    }
  }
  const generic = html.match(/https?:\/\/(?!www\.instagram\.com)[^\s"'<>]{8,200}/gi);
  if (generic) {
    for (const u of generic) {
      if (!skip.test(u)) return u.replace(/&amp;/g, "&");
    }
  }
  return undefined;
}

function extractCommentsFromHtml(html: string): PublicCommentMeta[] {
  const snippets: PublicCommentMeta[] = [];
  const chunk = html.slice(0, 500_000);
  const textBits = chunk.match(/>([^<]{20,280})</g)?.slice(0, 50) ?? [];
  for (const bit of textBits) {
    const text = bit.replace(/^>|<$/g, "").trim();
    if (text.length < 20) continue;
    if (/cookie|javascript|navigation|meta name/i.test(text)) continue;
    snippets.push({ text: text.slice(0, 500), classifications: classifyComments(text) });
    if (snippets.length >= 18) break;
  }
  return snippets;
}

export async function fetchInstagramPublicSurface(profileUrl: string): Promise<PublicSocialSurface> {
  const extractionNotes: string[] = ["Instagram: server-side HTML often omits feed; using og/meta + embedded JSON when present."];

  const res = await fetchPublicHtml(profileUrl);
  if (!res.ok && res.status === 404) {
    const g = await fetchGenericPublicSocialSurface(profileUrl);
    return {
      ...g,
      extractionNotes: [...extractionNotes, "Primary fetch returned 404 — used generic fallback."],
    };
  }
  if (!res.html || res.status >= 500) {
    const g = await fetchGenericPublicSocialSurface(profileUrl);
    return {
      ...g,
      extractionNotes: [...extractionNotes, `HTTP ${res.status} or empty body — generic fallback.`],
    };
  }

  const html = res.html;
  const joined = `${html}\n${extractTitle(html) ?? ""}\n${extractDescription(html) ?? ""}`;

  for (const hint of PRIVATE_OR_LOGIN_HINTS) {
    if (hint.test(joined)) {
      const g = await fetchGenericPublicSocialSurface(profileUrl);
      return {
        ...g,
        extractionNotes: [...extractionNotes, "Page signals login/private wall — limited public surface."],
      };
    }
  }

  let url: URL;
  try {
    url = new URL(res.url);
  } catch {
    return fetchGenericPublicSocialSurface(profileUrl);
  }

  const handle = extractHandleFromPath(url.pathname);
  const title = extractTitle(html);
  const desc = extractDescription(html);
  const bio = parseInstagramBio(html, desc);
  const embedded = parseInstagramEmbeddedCounts(html);
  const sniffed = sniffFollowerCounts(html);
  const followers = embedded.followers ?? sniffed.followers;
  const following = embedded.following ?? sniffed.following;
  const linkInBio = sniffExternalLink(html);

  let accessStatus: AccessStatus = "access_limited";
  const accessNotes: string[] = [];
  if (html.length < 900) {
    accessNotes.push("Thin HTML — likely bot challenge or minimal shell.");
  } else if (bio || title || followers != null) {
    accessStatus = "public";
  }

  const posts: PublicPostMeta[] = summarizePostMetadata(html, title, desc);
  const comments = extractCommentsFromHtml(html);

  return {
    accessStatus,
    handle,
    displayName: title?.split(/[·•@]/)[0]?.trim() || handle,
    bio,
    followerCount: followers,
    followingCount: following,
    linkInBio,
    profileUrlResolved: res.url,
    posts,
    comments,
    accessNotes,
    extractionNotes,
    rawHtmlSnippet: html.slice(0, 4000),
  };
}
