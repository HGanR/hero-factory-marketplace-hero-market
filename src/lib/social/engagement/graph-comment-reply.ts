/**
 * Facebook / Instagram Graph: reply to a comment as the connected Page / IG user.
 * Requires a valid graph comment id (parent) on the thread metadata (`graphParentCommentId`).
 */
export type GraphCommentReplyResult =
  | { ok: true; platformReplyId: string }
  | { ok: false; error: string };

export function getGraphParentCommentIdFromThreadMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const o = meta as Record<string, unknown>;
  const eng = o.engagement;
  if (eng && typeof eng === "object") {
    const e = eng as Record<string, unknown>;
    const a = e.graphParentCommentId ?? e.parentCommentId;
    if (typeof a === "string" && a.trim()) return a.trim();
  }
  const b = o.graphParentCommentId ?? o.parentCommentId;
  if (typeof b === "string" && b.trim()) return b.trim();
  return null;
}

/**
 * @see https://developers.facebook.com/docs/graph-api/reference/comment/replies
 */
export async function postGraphCommentReply(args: { accessToken: string; parentCommentId: string; message: string }): Promise<GraphCommentReplyResult> {
  const message = String(args.message ?? "").trim();
  if (!message) {
    return { ok: false, error: "Reply text is required." };
  }
  if (message.length > 8000) {
    return { ok: false, error: "Reply text is too long for the Graph API (max 8000 characters)." };
  }
  const token = String(args.accessToken ?? "").trim();
  if (!token) {
    return { ok: false, error: "Missing access token." };
  }
  const parent = String(args.parentCommentId ?? "").trim();
  if (!parent) {
    return { ok: false, error: "Missing parent comment id on the thread (ingest `graphParentCommentId`)." };
  }
  const body = new URLSearchParams();
  body.set("message", message);
  body.set("access_token", token);
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(parent)}/comments`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }
  );
  const raw = await res.text();
  let j: { id?: string; error?: { message?: string } } = {};
  try {
    j = raw ? (JSON.parse(raw) as { id?: string; error?: { message?: string } }) : {};
  } catch {
    j = {};
  }
  if (!res.ok) {
    const msg = j.error?.message || raw || `HTTP ${res.status}`;
    return { ok: false, error: msg.length > 400 ? msg.slice(0, 399) + "..." : msg };
  }
  const id = j.id ? String(j.id) : null;
  if (!id) {
    return { ok: false, error: "Graph did not return a comment id for the reply." };
  }
  return { ok: true, platformReplyId: id };
}
