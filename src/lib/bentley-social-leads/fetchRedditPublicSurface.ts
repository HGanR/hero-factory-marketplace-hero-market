/**
 * Reddit user profile (old.reddit.com or www) — karma + bio from HTML/JSON fragments.
 */

import { fetchGenericPublicSocialSurface } from "./fetchGenericPublicSocialSurface";
import {
  extractDescription,
  extractTitle,
  fetchPublicHtml,
  PRIVATE_OR_LOGIN_HINTS,
} from "./publicSurfaceHtml";
import { classifyComments } from "./classifyComments";
import { summarizePostMetadata } from "./summarizePostMetadata";
import type { AccessStatus, PublicCommentMeta, PublicPostMeta, PublicSocialSurface } from "./types";

function redditPublicUrl(profileUrl: string): string {
  try {
    const u = new URL(profileUrl.trim().startsWith("http") ? profileUrl.trim() : `https://${profileUrl.trim()}`);
    if (u.hostname === "www.reddit.com" || u.hostname === "reddit.com") {
      u.hostname = "old.reddit.com";
    }
    return u.toString();
  } catch {
    return profileUrl;
  }
}

function extractHandle(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "user" && parts[1]) return parts[1];
  if (parts[0] === "u" && parts[1]) return parts[1];
  return parts[0] ?? "";
}

function parseKarma(html: string): number | undefined {
  const m = html.match(/([\d,]+)\s*karma/i);
  if (m) {
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    if (!Number.isNaN(n)) return n;
  }
  const jm = html.match(/"totalKarma":\s*(\d+)/);
  if (jm) return parseInt(jm[1], 10);
  const jm2 = html.match(/"linkKarma":\s*(\d+)/);
  if (jm2) return parseInt(jm2[1], 10);
  return undefined;
}

function extractComments(html: string): PublicCommentMeta[] {
  const snippets: PublicCommentMeta[] = [];
  const chunk = html.slice(0, 500_000);
  const bits = chunk.match(/>([^<]{25,400})</g)?.slice(0, 50) ?? [];
  for (const bit of bits) {
    const text = bit.replace(/^>|<$/g, "").trim();
    if (text.length < 25) continue;
    if (/cookie|javascript|reddit\.com\/prefs/i.test(text)) continue;
    snippets.push({ text: text.slice(0, 500), classifications: classifyComments(text) });
    if (snippets.length >= 18) break;
  }
  return snippets;
}

export async function fetchRedditPublicSurface(profileUrl: string): Promise<PublicSocialSurface> {
  const extractionNotes: string[] = ["Reddit: preferring old.reddit.com layout for simpler public HTML when possible."];

  const targetUrl = redditPublicUrl(profileUrl);
  const res = await fetchPublicHtml(targetUrl);
  if (!res.html || res.status === 404) {
    const g = await fetchGenericPublicSocialSurface(profileUrl);
    return { ...g, extractionNotes: [...extractionNotes, "404 or empty — generic fallback."] };
  }

  const html = res.html;
  const title = extractTitle(html);
  const desc = extractDescription(html);
  const joined = `${html}\n${title ?? ""}\n${desc ?? ""}`;

  for (const hint of PRIVATE_OR_LOGIN_HINTS) {
    if (hint.test(joined)) {
      const g = await fetchGenericPublicSocialSurface(profileUrl);
      return { ...g, extractionNotes: [...extractionNotes, "Blocked/private — generic fallback."] };
    }
  }

  let url: URL;
  try {
    url = new URL(res.url);
  } catch {
    return fetchGenericPublicSocialSurface(profileUrl);
  }

  const handle = extractHandle(url.pathname);
  const karma = parseKarma(html);
  if (karma != null) extractionNotes.push("Karma count parsed from page text/JSON.");

  const bio = desc?.slice(0, 2000);

  let accessStatus: AccessStatus = "access_limited";
  const accessNotes: string[] = [];
  if (html.length < 600) accessNotes.push("Very small HTML body.");
  else if (title || karma != null || handle) accessStatus = "public";

  const posts: PublicPostMeta[] = summarizePostMetadata(html, title, desc);
  const comments = extractComments(html);

  return {
    accessStatus,
    handle,
    displayName: title?.replace(/\s*\|\s*Reddit\s*$/i, "").trim() || handle,
    bio,
    followerCount: karma,
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
