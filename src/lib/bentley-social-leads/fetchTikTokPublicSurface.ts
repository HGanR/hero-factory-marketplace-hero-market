/**
 * TikTok public profile — parses embedded hydration JSON when present (read-only GET).
 */

import { fetchGenericPublicSocialSurface } from "./fetchGenericPublicSocialSurface";
import {
  extractDescription,
  extractScriptJsonById,
  extractTitle,
  fetchPublicHtml,
  PRIVATE_OR_LOGIN_HINTS,
} from "./publicSurfaceHtml";
import { classifyComments } from "./classifyComments";
import { summarizePostMetadata } from "./summarizePostMetadata";
import type { AccessStatus, PublicCommentMeta, PublicPostMeta, PublicSocialSurface } from "./types";

function extractHandle(pathname: string): string {
  const p = pathname.replace(/^\/+/, "");
  if (p.startsWith("@")) return p.slice(1).split("/")[0] ?? "";
  return p.split("/")[0] ?? "";
}

function digFollowerCount(obj: unknown): { followers?: number; following?: number } {
  const out: { followers?: number; following?: number } = {};
  const walk = (v: unknown, depth: number): void => {
    if (depth > 12 || v == null) return;
    if (typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (typeof o.followerCount === "number") out.followers = o.followerCount;
      if (typeof o.followingCount === "number") out.following = o.followingCount;
      if (typeof o.fans === "number" && out.followers == null) out.followers = o.fans;
      for (const k of Object.keys(o)) walk(o[k], depth + 1);
    } else if (Array.isArray(v)) {
      for (const x of v.slice(0, 40)) walk(x, depth + 1);
    }
  };
  walk(obj, 0);
  return out;
}

function extractComments(html: string): PublicCommentMeta[] {
  const snippets: PublicCommentMeta[] = [];
  const chunk = html.slice(0, 400_000);
  const bits = chunk.match(/>([^<]{18,300})</g)?.slice(0, 40) ?? [];
  for (const bit of bits) {
    const text = bit.replace(/^>|<$/g, "").trim();
    if (text.length < 18) continue;
    if (/cookie|javascript|__NEXT_DATA__/i.test(text)) continue;
    snippets.push({ text: text.slice(0, 500), classifications: classifyComments(text) });
    if (snippets.length >= 15) break;
  }
  return snippets;
}

export async function fetchTikTokPublicSurface(profileUrl: string): Promise<PublicSocialSurface> {
  const extractionNotes: string[] = ["TikTok: extracting __UNIVERSAL_DATA_FOR_REHYDRATION__ / SIGI_STATE when available."];

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
      return { ...g, extractionNotes: [...extractionNotes, "Login/private signal — generic fallback."] };
    }
  }

  let url: URL;
  try {
    url = new URL(res.url);
  } catch {
    return fetchGenericPublicSocialSurface(profileUrl);
  }

  const handle = extractHandle(url.pathname);

  let hydration: unknown =
    extractScriptJsonById(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__") ??
    extractScriptJsonById(html, "__NEXT_DATA__");
  if (!hydration) {
    const sigi = html.indexOf("SIGI_STATE");
    if (sigi >= 0) {
      const sub = html.slice(sigi, sigi + 80_000);
      const m = sub.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          hydration = JSON.parse(m[0]) as unknown;
        } catch {
          hydration = null;
        }
      }
    }
  }

  const counts = hydration ? digFollowerCount(hydration) : {};
  if (counts.followers != null) extractionNotes.push("Found follower stats in embedded JSON.");

  let bio: string | undefined = desc?.slice(0, 2000);
  if (bio && bio.length < 6) bio = undefined;

  let accessStatus: AccessStatus = "access_limited";
  const accessNotes: string[] = [];
  if (html.length < 800) accessNotes.push("Thin HTML — possible challenge page.");
  else if (title || counts.followers != null || desc) accessStatus = "public";

  const posts: PublicPostMeta[] = summarizePostMetadata(html, title, desc);
  const comments = extractComments(html);

  return {
    accessStatus,
    handle,
    displayName: title?.split(/[·|]/)[0]?.trim() || handle,
    bio,
    followerCount: counts.followers,
    followingCount: counts.following,
    linkInBio: undefined,
    profileUrlResolved: res.url,
    posts,
    comments,
    accessNotes,
    extractionNotes,
    rawHtmlSnippet: html.slice(0, 4000),
  };
}
