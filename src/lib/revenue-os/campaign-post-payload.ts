/**
 * Consistent client shapes for campaign post copy fields (avoid mixing "" and undefined).
 */

import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

/** Empty / whitespace-only → null; preserves null; undefined stays undefined (omit key). */
export function normalizeHashtagsField(v: string | undefined | null): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = coerceTrimmedString(v);
  return t === "" ? null : t;
}

/** linkUrl: undefined omits; null clears; empty string → null */
export function normalizeLinkUrlField(v: string | undefined | null): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = coerceTrimmedString(v);
  return t === "" ? null : t;
}

export function normalizeUtmParamsField(
  v: Record<string, string> | undefined | null
): Record<string, string> | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const entries = Object.entries(v).filter(([, val]) => coerceTrimmedString(val) !== "");
  if (entries.length === 0) return null;
  return Object.fromEntries(entries.map(([k, val]) => [k, coerceTrimmedString(val)]));
}

export type PatchPostCopyInput = {
  caption?: string;
  hashtags?: string | null;
  linkUrl?: string | null;
  utmParams?: Record<string, string> | null;
};

/** Body for PATCH /api/campaigns/posts/:id — only includes keys that should be sent. */
export function buildPatchPostCopyBody(input: PatchPostCopyInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.caption !== undefined) body.caption = input.caption;
  if (input.hashtags !== undefined) {
    body.hashtags = normalizeHashtagsField(input.hashtags) ?? null;
  }
  if (input.linkUrl !== undefined) {
    body.linkUrl = normalizeLinkUrlField(input.linkUrl) ?? null;
  }
  if (input.utmParams !== undefined) {
    body.utmParams = normalizeUtmParamsField(input.utmParams) ?? null;
  }
  return body;
}

/** POST /api/campaigns/:id/posts — omit empty optional strings; never send "". */
export function buildCreatePostBody(params: {
  platform: string;
  caption: string;
  hashtags?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    platform: params.platform,
    caption: params.caption,
  };
  const h = normalizeHashtagsField(params.hashtags);
  if (h !== undefined && h !== null) out.hashtags = h;
  return out;
}
