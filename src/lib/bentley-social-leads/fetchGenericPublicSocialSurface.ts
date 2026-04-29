/**
 * Generic public HTML fetch + meta extraction (fallback for all platforms).
 * No login bypass; no video/audio analysis.
 */

import type { AccessStatus, PublicCommentMeta, PublicPostMeta, PublicSocialSurface } from "./types";
import { classifyComments } from "./classifyComments";
import {
  BENTLEY_SLI_UA,
  extractDescription,
  extractTitle,
  PRIVATE_OR_LOGIN_HINTS,
  sniffFollowerCounts,
} from "./publicSurfaceHtml";
import { summarizePostMetadata } from "./summarizePostMetadata";

function sniffBio(html: string, description?: string): string | undefined {
  if (description && description.length > 10) return description.slice(0, 2000);
  return undefined;
}

function sniffLinkInBio(html: string): string | undefined {
  const m = html.match(/https?:\/\/[^\s"'<>]+/gi);
  if (!m?.length) return undefined;
  const skip = /instagram\.com|facebook\.com|fb\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com/i;
  for (const u of m) {
    if (!skip.test(u)) return u.replace(/&amp;/g, "&").slice(0, 2000);
  }
  return undefined;
}

function extractVisibleCommentsFromHtml(html: string): PublicCommentMeta[] {
  const snippets: PublicCommentMeta[] = [];
  const chunk = html.slice(0, 500_000);
  const re = /data-comment|CommentThread|comment-text|class="[^"]*comment[^"]*"/gi;
  if (!re.test(chunk)) return snippets;
  const textBits = chunk.match(/>([^<]{20,240})</g)?.slice(0, 40) ?? [];
  for (const bit of textBits) {
    const text = bit.replace(/^>|<$/g, "").trim();
    if (text.length < 20) continue;
    if (/cookie|javascript|navigation/i.test(text)) continue;
    snippets.push({ text: text.slice(0, 500), classifications: classifyComments(text) });
    if (snippets.length >= 15) break;
  }
  return snippets;
}

export function emptySurface(status: AccessStatus, notes: string[]): PublicSocialSurface {
  return {
    accessStatus: status,
    handle: "",
    posts: [],
    comments: [],
    accessNotes: notes,
    extractionNotes: ["Generic surface — no platform-specific JSON."],
  };
}

/** Single GET of public profile URL; parse visible metadata only. */
export async function fetchGenericPublicSocialSurface(
  profileUrl: string | null | undefined
): Promise<PublicSocialSurface> {
  if (!profileUrl?.trim()) {
    return emptySurface("not_found", ["No profile URL provided."]);
  }

  let url: URL;
  try {
    url = new URL(profileUrl.trim().startsWith("http") ? profileUrl.trim() : `https://${profileUrl.trim()}`);
  } catch {
    return emptySurface("broken_link", ["Profile URL could not be parsed."]);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return emptySurface("broken_link", ["Only http(s) URLs are supported."]);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": BENTLEY_SLI_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(18_000),
    });

    if (res.status === 404 || res.status === 410) {
      return emptySurface("broken_link", [`HTTP ${res.status} — page not found.`]);
    }

    if (res.status >= 500) {
      return emptySurface("access_limited", [`HTTP ${res.status} — server error; metadata not retrieved.`]);
    }

    const html = await res.text();
    const title = extractTitle(html);
    const desc = extractDescription(html);
    const joined = `${html}\n${title ?? ""}\n${desc ?? ""}`;

    for (const hint of PRIVATE_OR_LOGIN_HINTS) {
      if (hint.test(joined)) {
        return {
          accessStatus: "private",
          handle: "",
          displayName: title,
          bio: sniffBio(html, desc),
          profileUrlResolved: url.toString(),
          posts: [],
          comments: [],
          accessNotes: ["Page indicates login, privacy, or restricted visibility — no deeper public scrape."],
          extractionNotes: ["Generic HTML — login/privacy wall; no deeper public scrape."],
        };
      }
    }

    const { followers, following } = sniffFollowerCounts(html);
    const bio = sniffBio(html, desc);
    const linkInBio = sniffLinkInBio(html);

    let accessStatus: AccessStatus = "access_limited";
    const accessNotes: string[] = [];

    if (html.length < 800) {
      accessNotes.push("Very little HTML returned — likely interstitial, bot challenge, or minimal public surface.");
      accessStatus = "access_limited";
    } else if (bio || title) {
      accessStatus = "public";
    }

    const fakePosts: PublicPostMeta[] = summarizePostMetadata(html, title, desc);
    const comments = extractVisibleCommentsFromHtml(html);

    return {
      accessStatus,
      handle: "",
      displayName: title,
      bio,
      followerCount: followers,
      followingCount: following,
      linkInBio,
      profileUrlResolved: url.toString(),
      posts: fakePosts,
      comments,
      accessNotes,
      extractionNotes: ["Generic HTML fetch — no platform-specific embedded JSON."],
      rawHtmlSnippet: html.slice(0, 4000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return emptySurface("access_limited", [`Fetch failed: ${msg.slice(0, 200)}`]);
  }
}
