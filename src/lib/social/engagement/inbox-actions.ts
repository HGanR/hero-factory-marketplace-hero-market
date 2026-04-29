import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  campaignAuditEvents,
  socialAccounts,
  socialAccountCapabilities,
  socialEngagementAiSuggestions,
  socialEngagementAssignments,
  socialEngagementMessages,
  socialEngagementThreads,
} from "@/lib/db/schema";
import { decryptToken } from "@/lib/social/encrypt";
import { getGraphParentCommentIdFromThreadMetadata, postGraphCommentReply } from "@/lib/social/engagement/graph-comment-reply";
import { resolveInboxReplyGovernance } from "@/lib/social/engagement/inbox-reply-governance";
import { resolveSocialEngagementCapabilities, type SocialEngagementSourceType } from "@/lib/social/engagement/social-engagement-capabilities";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const COMMENT_SOURCE: SocialEngagementSourceType[] = ["comment", "reply", "ad_comment"];

/**
 * Outbound comment reply: capability-gated, Graph when parent id is present, audit is always written on success.
 */
export async function inboxReplyToThreadComment(
  db: Db,
  args: {
    userId: string;
    threadId: string;
    socialAccountId: string;
    messageId: string | null;
    replyText: string;
  }
): Promise<
  | { ok: true; platformReplyId?: string; threadStatus: string; heldForApproval?: true }
  | { ok: false; requiresManual: true; reason: string; canReply: boolean }
  | { ok: false; error: string; status: number }
> {
  if (process.env.REVENUE_OS_INBOX_BLOCK_REPLIES === "1") {
    return { ok: false, error: "Inbox replies are disabled by policy.", status: 403 };
  }
  const trows = await db
    .select()
    .from(socialEngagementThreads)
    .where(and(eq(socialEngagementThreads.id, args.threadId), eq(socialEngagementThreads.userId, String(args.userId))))
    .limit(1);
  const thread = trows[0];
  if (!thread) {
    return { ok: false, error: "Thread not found", status: 404 };
  }
  if (String(thread.socialAccountId) !== String(args.socialAccountId)) {
    return { ok: false, error: "Account does not match this thread", status: 400 };
  }
  const st = String(thread.sourceType || "") as SocialEngagementSourceType;
  if (!COMMENT_SOURCE.includes(st)) {
    return { ok: false, error: "This thread is not a comment thread — in-app comment reply is not available.", status: 400 };
  }
  const accRows = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.id, args.socialAccountId),
        eq(socialAccounts.userId, String(args.userId)),
        eq(socialAccounts.clientId, String(thread.clientId))
      )
    )
    .limit(1);
  const acc = accRows[0];
  if (!acc) {
    return { ok: false, error: "Social account not found", status: 404 };
  }
  const capRow = await db
    .select()
    .from(socialAccountCapabilities)
    .where(eq(socialAccountCapabilities.socialAccountId, acc.id))
    .limit(1);
  const flagsOverride = (capRow[0]?.flagsJson as object | null) ?? null;
  const cap = resolveSocialEngagementCapabilities({
    provider: acc.platform,
    flagsOverride,
    socialAccount: acc,
    sourceType: st,
  });
  if (!cap.canReplyComments) {
    return {
      ok: false,
      requiresManual: true,
      canReply: false,
      reason: cap.reasons[0] ?? "In-app comment reply is not available for this account — use the native app.",
    };
  }
  const accessToken = acc.accessTokenEnc ? decryptToken(acc.accessTokenEnc) : "";
  const parent = getGraphParentCommentIdFromThreadMetadata(thread.metadataJson);
  const gov = resolveInboxReplyGovernance({
    thread: { clientId: String(thread.clientId), sourceType: st, metadataJson: thread.metadataJson },
    sourceType: st,
    capabilities: cap,
    hasAccessToken: Boolean(accessToken),
    hasGraphParent: Boolean(parent),
  });
  if (gov.effectiveActorMode === "approval_queue") {
    const ext = `pending-reply-${randomUUID()}`;
    await db.insert(socialEngagementMessages).values({
      id: randomUUID(),
      threadId: args.threadId,
      externalMessageId: ext,
      direction: "note",
      authorDisplay: "operator",
      messageText: `[PENDING INBOX REPLY — not sent] ${args.replyText}`,
      rawPayloadJson: { source: "reply_governance", pendingOutreach: true, governance: "approval_queue" },
      createdAt: new Date(),
    });
    const nextStatus = "triaged" as const;
    await db
      .update(socialEngagementThreads)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(socialEngagementThreads.id, args.threadId));
    await db.insert(campaignAuditEvents).values({
      id: randomUUID(),
      userId: String(args.userId),
      postId: null,
      action: "inbox_reply_queued_approval",
      platform: acc.platform,
      details: {
        source: "operator",
        threadId: args.threadId,
        clientId: thread.clientId,
        governance: "approval_queue",
      } as never,
    });
    return { ok: true, heldForApproval: true, threadStatus: nextStatus };
  }
  if (!accessToken) {
    return {
      ok: false,
      requiresManual: true,
      canReply: true,
      reason: "No OAuth token for this account — reconnect.",
    };
  }
  if (!parent) {
    return {
      ok: false,
      requiresManual: true,
      canReply: true,
      reason: "Missing graph parent comment id (set `graphParentCommentId` in thread metadata from ingestion) — use native app.",
    };
  }
  if (!gov.canReplyNow) {
    return {
      ok: false,
      requiresManual: true,
      canReply: gov.effectiveActorMode !== "manual_only",
      reason: gov.reason,
    };
  }
  const sent = await postGraphCommentReply({ accessToken, parentCommentId: parent, message: args.replyText });
  if (!sent.ok) {
    return { ok: false, requiresManual: true, canReply: true, reason: sent.error };
  }
  const extId = `out-reply-${sent.platformReplyId}`;
  await db.insert(socialEngagementMessages).values({
    id: randomUUID(),
    threadId: args.threadId,
    externalMessageId: extId,
    direction: "outbound",
    authorDisplay: "operator",
    messageText: args.replyText,
    rawPayloadJson: { messageId: args.messageId, source: "operator" },
    createdAt: new Date(),
  });
  const nextStatus = "waiting" as const;
  await db
    .update(socialEngagementThreads)
    .set({ status: nextStatus, lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(socialEngagementThreads.id, args.threadId));
  const audId = randomUUID();
  await db.insert(campaignAuditEvents).values({
    id: audId,
    userId: String(args.userId),
    postId: null,
    action: "inbox_comment_reply",
    platform: acc.platform,
    details: {
      source: "operator",
      threadId: args.threadId,
      clientId: thread.clientId,
      campaignId: thread.campaignId,
      socialAccountId: acc.id,
      platformReplyId: sent.platformReplyId,
      governance: "operator_direct",
    } as never,
  });
  return { ok: true, platformReplyId: sent.platformReplyId, threadStatus: nextStatus };
}

export async function inboxAddNote(
  db: Db,
  args: { userId: string; threadId: string; noteText: string }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const trows = await db
    .select()
    .from(socialEngagementThreads)
    .where(and(eq(socialEngagementThreads.id, args.threadId), eq(socialEngagementThreads.userId, String(args.userId))))
    .limit(1);
  if (!trows[0]) {
    return { ok: false, error: "Not found", status: 404 };
  }
  const ext = `note-${randomUUID()}`;
  await db.insert(socialEngagementMessages).values({
    id: randomUUID(),
    threadId: args.threadId,
    externalMessageId: ext,
    direction: "note",
    authorDisplay: "operator",
    messageText: args.noteText,
    rawPayloadJson: { source: "note" },
    createdAt: new Date(),
  });
  const audId = randomUUID();
  await db.insert(campaignAuditEvents).values({
    id: audId,
    userId: String(args.userId),
    postId: null,
    action: "inbox_add_note",
    platform: null,
    details: { source: "operator", threadId: args.threadId } as never,
  });
  return { ok: true };
}

export async function inboxAssignThread(
  db: Db,
  args: { userId: string; threadId: string; assignedUserId: string; assignedRole: string | null }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const trows = await db
    .select()
    .from(socialEngagementThreads)
    .where(and(eq(socialEngagementThreads.id, args.threadId), eq(socialEngagementThreads.userId, String(args.userId))))
    .limit(1);
  if (!trows[0]) {
    return { ok: false, error: "Not found", status: 404 };
  }
  const id = randomUUID();
  await db.insert(socialEngagementAssignments).values({
    id,
    threadId: args.threadId,
    assignedUserId: args.assignedUserId,
    assignedRole: args.assignedRole?.trim() || null,
    createdAt: new Date(),
  });
  const audId = randomUUID();
  await db.insert(campaignAuditEvents).values({
    id: audId,
    userId: String(args.userId),
    postId: null,
    action: "inbox_assign",
    platform: null,
    details: { source: "operator", threadId: args.threadId, assignedUserId: args.assignedUserId, role: args.assignedRole } as never,
  });
  return { ok: true };
}

export async function inboxUpdateSuggestionStatus(
  db: Db,
  args: { userId: string; threadId: string; suggestionId: string; status: "accepted" | "dismissed" }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const trows = await db
    .select()
    .from(socialEngagementThreads)
    .where(and(eq(socialEngagementThreads.id, args.threadId), eq(socialEngagementThreads.userId, String(args.userId))))
    .limit(1);
  if (!trows[0]) {
    return { ok: false, error: "Not found", status: 404 };
  }
  const s = await db
    .select()
    .from(socialEngagementAiSuggestions)
    .where(and(eq(socialEngagementAiSuggestions.id, args.suggestionId), eq(socialEngagementAiSuggestions.threadId, args.threadId)))
    .limit(1);
  if (!s[0]) {
    return { ok: false, error: "Suggestion not found", status: 404 };
  }
  await db
    .update(socialEngagementAiSuggestions)
    .set({ status: args.status })
    .where(eq(socialEngagementAiSuggestions.id, args.suggestionId));
  return { ok: true };
}

/**
 * "Use suggestion" = accept + optional save body as out-of-band note with prefix.
 */
export async function inboxAcceptSuggestionAsNote(
  db: Db,
  args: { userId: string; threadId: string; suggestionId: string; textOverride: string | null }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const trows = await db
    .select()
    .from(socialEngagementThreads)
    .where(and(eq(socialEngagementThreads.id, args.threadId), eq(socialEngagementThreads.userId, String(args.userId))))
    .limit(1);
  if (!trows[0]) {
    return { ok: false, error: "Not found", status: 404 };
  }
  const s = await db
    .select()
    .from(socialEngagementAiSuggestions)
    .where(and(eq(socialEngagementAiSuggestions.id, args.suggestionId), eq(socialEngagementAiSuggestions.threadId, args.threadId)))
    .limit(1);
  if (!s[0]) {
    return { ok: false, error: "Suggestion not found", status: 404 };
  }
  const body = (args.textOverride ?? s[0].suggestedText ?? "").trim();
  if (body) {
    const ext = `note-${randomUUID()}`;
    await db.insert(socialEngagementMessages).values({
      id: randomUUID(),
      threadId: args.threadId,
      externalMessageId: ext,
      direction: "note",
      authorDisplay: "operator",
      messageText: `[Bentley accepted] ${body}`,
      rawPayloadJson: { source: "suggestion_accept" },
      createdAt: new Date(),
    });
  }
  await db
    .update(socialEngagementAiSuggestions)
    .set({ status: "accepted" })
    .where(eq(socialEngagementAiSuggestions.id, args.suggestionId));
  const audId = randomUUID();
  await db.insert(campaignAuditEvents).values({
    id: audId,
    userId: String(args.userId),
    postId: null,
    action: "inbox_suggestion_accept",
    platform: null,
    details: { source: "operator", threadId: args.threadId, suggestionId: args.suggestionId } as never,
  });
  return { ok: true };
}
