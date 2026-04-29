/**
 * LinkedIn REST — social action summary for a UGC post or share URN.
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/network-update-social-actions
 *
 * Uses `GET /rest/socialActions/{ugcPostUrn|shareUrn}` (likes/comments counts only; no impression fabrications).
 */

import type {
  PlatformPerformanceSnapshot,
  PlatformPostPerformanceFetchStatus,
} from "@/lib/social/platform-performance-sync-contract";

/** Monthly REST API version (LinkedIn requires LinkedIn-Version on /rest/*). */
const LINKEDIN_REST_API_VERSION = "202411";

type LiErrorBody = {
  message?: string;
  status?: number;
  errorDetailType?: string;
};

type LiSocialSummary = {
  likesSummary?: {
    totalLikes?: number;
    aggregatedTotalLikes?: number;
  };
  commentsSummary?: {
    aggregatedTotalComments?: number;
    totalFirstLevelComments?: number;
  };
  target?: string;
};

function linkedInErrorMessage(context: string, body: LiErrorBody | null, status: number): string {
  const m = body?.message?.trim();
  const bits = [m || `HTTP ${status}`];
  if (body?.errorDetailType) bits.push(String(body.errorDetailType));
  return `${context}: ${bits.join(" · ")}`;
}

/**
 * Normalize stored `platform_post_id` to a URN accepted by socialActions.
 * Publish stores `X-RestLi-Id` (typically `urn:li:ugcPost:{id}` or share URN).
 */
export function normalizeLinkedInSocialActionUrn(externalPostId: string): string | null {
  const raw = externalPostId.trim();
  if (!raw) return null;
  let s = raw;
  try {
    if (raw.includes("%")) s = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (/^urn:li:ugcPost:/i.test(s)) {
    const parts = s.split(":");
    const id = parts[parts.length - 1]?.trim();
    if (id && /^\d+$/.test(id)) return `urn:li:ugcPost:${id}`;
    return null;
  }
  if (/^urn:li:share:/i.test(s)) {
    return s;
  }
  if (/^\d+$/.test(s)) {
    return `urn:li:ugcPost:${s}`;
  }
  return null;
}

function extractReactionCounts(data: LiSocialSummary): { likes: number; comments: number } | null {
  const hasLikes = data.likesSummary != null;
  const hasComments = data.commentsSummary != null;
  const keys = Object.keys(data as object);

  let likes: number | undefined;
  if (hasLikes) {
    const ls = data.likesSummary!;
    if (typeof ls.totalLikes === "number") likes = ls.totalLikes;
    else if (typeof ls.aggregatedTotalLikes === "number") likes = ls.aggregatedTotalLikes;
    else likes = 0;
  }

  let comments: number | undefined;
  if (hasComments) {
    const cs = data.commentsSummary!;
    if (typeof cs.aggregatedTotalComments === "number") comments = cs.aggregatedTotalComments;
    else if (typeof cs.totalFirstLevelComments === "number") comments = cs.totalFirstLevelComments;
    else comments = 0;
  }

  if (likes === undefined && comments === undefined) {
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "target")) {
      return { likes: 0, comments: 0 };
    }
    return null;
  }

  return { likes: likes ?? 0, comments: comments ?? 0 };
}

export async function fetchLinkedInPostPerformanceSnapshot(args: {
  accessToken: string;
  externalPostId: string;
  fetchImpl?: typeof fetch;
}): Promise<PlatformPostPerformanceFetchStatus> {
  const fetchFn = args.fetchImpl ?? fetch;
  const token = args.accessToken.trim();
  if (!token) {
    return { status: "error", message: "LinkedIn metric sync: missing access token." };
  }

  const urn = normalizeLinkedInSocialActionUrn(args.externalPostId);
  if (!urn) {
    return {
      status: "error",
      message:
        "LinkedIn metric sync needs a ugcPost or share URN in platform_post_id (from X-RestLi-Id on publish), or a numeric ugcPost id. Re-publish if the stored id is invalid.",
    };
  }

  const pathUrn = encodeURIComponent(urn);
  const url = `https://api.linkedin.com/rest/socialActions/${pathUrn}`;

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": LINKEDIN_REST_API_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
  } catch (e) {
    return {
      status: "error",
      message: `LinkedIn socialActions request failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let body: LiErrorBody & LiSocialSummary;
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { status: "error", message: `LinkedIn socialActions: invalid JSON (HTTP ${res.status}).` };
  }

  if (!res.ok || body.message) {
    const msg = linkedInErrorMessage("LinkedIn socialActions", body, res.status);
    if (res.status === 401 || res.status === 403) {
      return {
        status: "error",
        message: `${msg} Reconnect LinkedIn with **w_member_social** (and ensure the token can read social actions for this post).`,
      };
    }
    if (res.status === 404) {
      return {
        status: "error",
        message: `${msg} Post may be deleted or the stored URN does not match this token.`,
      };
    }
    return { status: "error", message: msg };
  }

  const extracted = extractReactionCounts(body);
  if (!extracted) {
    return {
      status: "error",
      message:
        "LinkedIn returned a socialActions payload without usable like/comment summaries — cannot build a snapshot (no fabricated metrics).",
    };
  }

  const engagement = extracted.likes + extracted.comments;
  const capturedAt = new Date().toISOString();
  const snapshot: PlatformPerformanceSnapshot = {
    platform: "linkedin",
    externalPostId: urn,
    capturedAt,
    impressions: null,
    reach: null,
    clicks: null,
    engagement,
    likes: extracted.likes,
    comments: extracted.comments,
    shares: null,
    saves: null,
    leads: null,
    videoViews: null,
    ctr: null,
    cpc: null,
  };

  return { status: "ok", snapshot };
}
