/**
 * Merge manually imported public comment text into the fetched social surface
 * so extractCommercialSignals / engine / scoring see CSV-provided signals.
 * Analysis-only; no automated engagement.
 */

import { classifyComments } from "./classifyComments";
import type { PostKind, PublicCommentMeta, PublicPostMeta, PublicSocialSurface } from "./types";

export function applyBentleyCsvImportSurfaceMerge(
  social: PublicSocialSurface,
  rawRow: Record<string, unknown>
): PublicSocialSurface {
  const bi = rawRow.bentleyCsvImport;
  if (!bi || typeof bi !== "object") return social;

  const payload = bi as {
    commentText?: string;
    sourceTitle?: string;
    authorHandle?: string;
    authorDisplayName?: string;
  };

  const commentText = typeof payload.commentText === "string" ? payload.commentText.trim() : "";
  if (!commentText) return social;

  const comments: PublicCommentMeta[] = [...social.comments];
  const c: PublicCommentMeta = {
    text: commentText.slice(0, 4000),
    classifications: classifyComments(commentText),
  };
  if (payload.authorHandle?.trim()) c.authorHandle = payload.authorHandle.trim().replace(/^@+/, "");
  comments.push(c);

  const posts: PublicPostMeta[] = [...social.posts];
  const title = typeof payload.sourceTitle === "string" ? payload.sourceTitle.trim() : "";
  if (title) {
    posts.push({
      captionSnippet: title.slice(0, 500),
      classifications: [] as PostKind[],
    });
  }

  const handle =
    social.handle ||
    (payload.authorHandle?.trim() ? payload.authorHandle.trim().replace(/^@+/, "") : "");
  const displayName = social.displayName || payload.authorDisplayName?.trim() || undefined;

  const extractionNotes = [
    ...(social.extractionNotes ?? []),
    "CSV import: scoring uses operator-provided public comment text (and optional title) as primary thread signals.",
  ];

  return {
    ...social,
    handle,
    displayName,
    posts,
    comments,
    extractionNotes,
  };
}
