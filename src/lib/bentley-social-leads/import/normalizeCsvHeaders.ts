/**
 * Deterministic header normalization for Bentley SLI CSV import.
 *
 * Canonical columns (defaults):
 * platform, authorHandle, commentText, sourceTitle, sourceUrl, sourceId, postId, parentId,
 * publishedAt, verticalHint, authorDisplayName, likeCount, replyCount
 *
 * Aliases map to these canonical keys (case- and space-insensitive after folding).
 */

/** Fold user header to a lookup key: lower snake_case. */
export function foldHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Maps folded header -> canonical field name.
 * Documented aliases (extend in one place only).
 */
const FOLDED_TO_CANONICAL: Record<string, string> = {
  // explicit camelCase headers folded (no spaces)
  commenttext: "commentText",
  comment_text: "commentText",
  authorhandle: "authorHandle",
  author_handle: "authorHandle",
  sourcetitle: "sourceTitle",
  sourceurl: "sourceUrl",
  sourceid: "sourceId",
  postid: "postId",
  parentid: "parentId",
  publishedat: "publishedAt",
  verticalhint: "verticalHint",
  authordisplayname: "authorDisplayName",
  likecount: "likeCount",
  replycount: "replyCount",
  // platform
  platform: "platform",
  network: "platform",
  site: "platform",
  channel: "platform",
  // author
  author: "authorHandle",
  username: "authorHandle",
  user: "authorHandle",
  handle: "authorHandle",
  user_handle: "authorHandle",
  // comment
  text: "commentText",
  comment: "commentText",
  body: "commentText",
  message: "commentText",
  content: "commentText",
  // source / post
  title: "sourceTitle",
  posttitle: "sourceTitle",
  post_title: "sourceTitle",
  threadtitle: "sourceTitle",
  thread_title: "sourceTitle",
  source_title: "sourceTitle",
  url: "sourceUrl",
  link: "sourceUrl",
  permalink: "sourceUrl",
  source_url: "sourceUrl",
  source_id: "sourceId",
  post_id: "postId",
  parent_id: "parentId",
  // time
  createdat: "publishedAt",
  created_at: "publishedAt",
  timestamp: "publishedAt",
  date: "publishedAt",
  time: "publishedAt",
  published_at: "publishedAt",
  posted_at: "publishedAt",
  // vertical
  vertical: "verticalHint",
  niche: "verticalHint",
  industry: "verticalHint",
  category: "verticalHint",
  // display
  display_name: "authorDisplayName",
  author_display_name: "authorDisplayName",
  name: "authorDisplayName",
  // counts
  likes: "likeCount",
  like_count: "likeCount",
  replies: "replyCount",
  reply_count: "replyCount",
  comment_count: "replyCount",
};

const CANONICAL_FIELDS = new Set([
  "platform",
  "authorHandle",
  "commentText",
  "sourceTitle",
  "sourceUrl",
  "sourceId",
  "postId",
  "parentId",
  "publishedAt",
  "verticalHint",
  "authorDisplayName",
  "likeCount",
  "replyCount",
]);

/**
 * Map a single raw header cell to canonical name, or the folded key if unknown (pass-through for extra columns).
 */
export function normalizeHeaderToCanonical(rawHeader: string): string {
  const folded = foldHeaderKey(rawHeader);
  if (!folded) return "";
  const mapped = FOLDED_TO_CANONICAL[folded];
  if (mapped) return mapped;
  if (CANONICAL_FIELDS.has(folded)) return folded;
  return folded;
}

/** Parallel canonical header list; duplicate canonical headers → last non-empty cell wins in zip. */
export function normalizeCsvHeaderRow(headers: string[]): string[] {
  return headers.map((h) => normalizeHeaderToCanonical(h));
}
