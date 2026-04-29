import { and, asc, desc, eq } from "drizzle-orm";
import {
  campaigns,
  socialEngagementMessages,
  socialEngagementThreads,
  socialEngagementThreadLabels,
  socialEngagementLabels,
  socialEngagementAssignments,
  socialAccounts,
  socialAccountCapabilities,
} from "@/lib/db/schema";
import type { NormalizedEngagementIngest } from "@/lib/social/engagement/normalize-engagement-event";
import { logEngagementIngestDebug } from "@/lib/social/engagement/engagement-ingest-debug";
import { applyEngagementRulesOnIngest } from "@/lib/social/engagement/engagement-apply-rules";
import { getGraphParentCommentIdFromThreadMetadata } from "@/lib/social/engagement/graph-comment-reply";
import { batchInboxListEnrichment } from "@/lib/social/engagement/inbox-batched-list";
import { resolveInboxReplyGovernance } from "@/lib/social/engagement/inbox-reply-governance";
import { resolveSocialEngagementCapabilities, type SocialEngagementSourceType } from "@/lib/social/engagement/social-engagement-capabilities";
import { buildBentleyEngagementSuggestion, persistSuggestion } from "@/lib/revenue-os/bentley-engagement-suggestion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Idempotent: same (`socialAccountId`, `externalThreadId`) returns same thread `id` (upserts by select + insert or update).
 */
export async function upsertSocialEngagementFromIngest(
  db: Db,
  input: NormalizedEngagementIngest,
  options: { flagsOverride: unknown; socialAccount: typeof import("@/lib/db/schema").socialAccounts.$inferSelect | null }
): Promise<{ threadId: string; isNew: boolean }> {
  const existing = await db
    .select()
    .from(socialEngagementThreads)
    .where(
      and(
        eq(socialEngagementThreads.socialAccountId, input.socialAccountId),
        eq(socialEngagementThreads.externalThreadId, input.externalThreadId)
      )
    )
    .limit(1);
  const cap = resolveSocialEngagementCapabilities({
    provider: input.provider,
    flagsOverride: options.flagsOverride as never,
    socialAccount: options.socialAccount,
    sourceType: input.sourceType as SocialEngagementSourceType,
  });
  const requiresManual = cap.requiresManualForReplies;
  const status = requiresManual ? "manual_only" : "new";
  const lastAt = input.lastMessageAt ?? input.message.createdAt;
  const sug = buildBentleyEngagementSuggestion({
    text: input.message.messageText,
    sourceType: input.sourceType,
    provider: input.provider,
    capabilities: cap,
  });
  if (existing[0]) {
    const tid = existing[0].id;
    await db
      .update(socialEngagementThreads)
      .set({
        lastMessageAt: lastAt,
        status: (existing[0].status === "resolved" || existing[0].status === "waiting"
          ? existing[0].status
          : status) as string,
        requiresManual: requiresManual,
        updatedAt: new Date(),
        metadataJson: { ...(typeof existing[0].metadataJson === "object" && existing[0].metadataJson ? (existing[0].metadataJson as object) : {}), ...((input.metadataJson ?? {}) as object) },
        intent: sug.intent,
        sentiment: sug.sentiment,
        urgency: sug.urgency,
      })
      .where(eq(socialEngagementThreads.id, tid));
    const msgNew = await upsertMessage(db, tid, input);
    await persistSuggestion(db, tid, sug);
    const tr = await db.select().from(socialEngagementThreads).where(eq(socialEngagementThreads.id, tid)).limit(1);
    if (tr[0] && msgNew) {
      await applyEngagementRulesOnIngest(db, {
        userId: String(input.userId),
        clientId: String(input.clientId),
        thread: tr[0],
        text: input.message.messageText,
        sourceType: input.sourceType as SocialEngagementSourceType,
        flagsOverride: options.flagsOverride,
        socialAccount: options.socialAccount,
      });
    }
    return { threadId: tid, isNew: false };
  }
  const id = (await import("crypto")).randomUUID();
  const meta = {
    ...(input.metadataJson ?? {}),
    engagement: { sourceType: input.sourceType, requiresManual, capabilityReasons: cap.reasons.slice(0, 6) },
  };
  await db.insert(socialEngagementThreads).values({
    id,
    userId: input.userId,
    clientId: input.clientId,
    campaignId: input.campaignId,
    socialAccountId: input.socialAccountId,
    provider: input.provider,
    externalThreadId: input.externalThreadId,
    sourceType: input.sourceType,
    status,
    intent: sug.intent,
    sentiment: sug.sentiment,
    urgency: sug.urgency,
    requiresManual: requiresManual,
    lastMessageAt: lastAt,
    metadataJson: meta,
  });
  const msgNew = await upsertMessage(db, id, input);
  await persistSuggestion(db, id, sug);
  const tr = await db.select().from(socialEngagementThreads).where(eq(socialEngagementThreads.id, id)).limit(1);
  if (tr[0]) {
    await applyEngagementRulesOnIngest(db, {
      userId: String(input.userId),
      clientId: String(input.clientId),
      thread: tr[0],
      text: input.message.messageText,
      sourceType: input.sourceType as SocialEngagementSourceType,
      flagsOverride: options.flagsOverride,
      socialAccount: options.socialAccount,
    });
  }
  return { threadId: id, isNew: true };
}

async function upsertMessage(db: Db, threadId: string, input: NormalizedEngagementIngest): Promise<boolean> {
  const ex = await db
    .select()
    .from(socialEngagementMessages)
    .where(
      and(
        eq(socialEngagementMessages.threadId, threadId),
        eq(socialEngagementMessages.externalMessageId, input.message.externalMessageId)
      )
    )
    .limit(1);
  if (ex[0]) {
    logEngagementIngestDebug("duplicate_message", {
      threadId,
      externalMessageId: input.message.externalMessageId,
      provider: input.provider,
      sourceType: input.sourceType,
    });
    return false;
  }
  const mid = (await import("crypto")).randomUUID();
  await db.insert(socialEngagementMessages).values({
    id: mid,
    threadId,
    externalMessageId: input.message.externalMessageId,
    direction: input.message.direction,
    authorDisplay: input.message.authorDisplay,
    messageText: input.message.messageText,
    rawPayloadJson: input.message.rawPayload,
    createdAt: input.message.createdAt,
  });
  return true;
}

export type ThreadWithPreview = typeof socialEngagementThreads.$inferSelect & {
  preview: string;
  messageCount: number;
  campaignName: string | null;
  labelSlugs: string[];
  lastAssignedRole: string | null;
  hasOpenAssignment: boolean;
};

/**
 * List threads for UI (by client + user).
 */
export async function listEngagementThreadsForClient(
  db: Db,
  args: { userId: string; clientId: string; limit: number }
): Promise<ThreadWithPreview[]> {
  const rows = await db
    .select()
    .from(socialEngagementThreads)
    .where(
      and(eq(socialEngagementThreads.userId, String(args.userId)), eq(socialEngagementThreads.clientId, String(args.clientId)))
    )
    .orderBy(desc(socialEngagementThreads.lastMessageAt))
    .limit(args.limit);
  const threadIds = rows.map((r) => r.id);
  const campMap = new Map<string, string | null>();
  for (const t of rows) {
    campMap.set(t.id, t.campaignId);
  }
  const batch = await batchInboxListEnrichment(db, { threadIds, campaignIdByThread: campMap });
  const out: ThreadWithPreview[] = [];
  for (const t of rows) {
    const tid = t.id;
    out.push({
      ...t,
      preview: batch.previewBy.get(tid) ?? "",
      messageCount: batch.countBy.get(tid) ?? 0,
      campaignName: batch.campaignNameBy.get(tid) ?? null,
      labelSlugs: batch.labelSlugsBy.get(tid) ?? [],
      lastAssignedRole: batch.lastAssignBy.get(tid)?.role ?? null,
      hasOpenAssignment: batch.lastAssignBy.get(tid)?.has ?? false,
    });
  }
  return out;
}

export async function loadEngagementThreadDetail(
  db: Db,
  args: { userId: string; threadId: string }
): Promise<{
  thread: typeof socialEngagementThreads.$inferSelect;
  messages: (typeof socialEngagementMessages.$inferSelect)[];
  campaignName: string | null;
  labels: { id: string; slug: string; displayName: string }[];
  assignments: (typeof socialEngagementAssignments.$inferSelect)[];
  accountFlags: Record<string, unknown> | null;
  canCommentReplyInApp: boolean;
  replyGovernance: ReturnType<typeof resolveInboxReplyGovernance>;
  debug: {
    provider: string;
    sourceType: string;
    externalThreadId: string;
    socialAccountId: string;
    hasGraphParentCommentId: boolean;
  };
} | null> {
  const tr = await db
    .select()
    .from(socialEngagementThreads)
    .where(and(eq(socialEngagementThreads.id, args.threadId), eq(socialEngagementThreads.userId, String(args.userId))))
    .limit(1);
  const t = tr[0];
  if (!t) return null;
  const msgs = await db
    .select()
    .from(socialEngagementMessages)
    .where(eq(socialEngagementMessages.threadId, t.id))
    .orderBy(asc(socialEngagementMessages.createdAt));
  let campaignName: string | null = null;
  if (t.campaignId) {
    const c = await db
      .select({ name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, t.campaignId))
      .limit(1);
    campaignName = c[0]?.name ?? null;
  }
  const lab = await db
    .select({
      id: socialEngagementLabels.id,
      slug: socialEngagementLabels.slug,
      displayName: socialEngagementLabels.displayName,
    })
    .from(socialEngagementThreadLabels)
    .innerJoin(socialEngagementLabels, eq(socialEngagementThreadLabels.labelId, socialEngagementLabels.id))
    .where(eq(socialEngagementThreadLabels.threadId, t.id));
  const assignments = await db
    .select()
    .from(socialEngagementAssignments)
    .where(eq(socialEngagementAssignments.threadId, t.id))
    .orderBy(desc(socialEngagementAssignments.createdAt))
    .limit(20);
  const acc = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, t.socialAccountId))
    .limit(1);
  const capRow = acc[0]
    ? await db
        .select()
        .from(socialAccountCapabilities)
        .where(eq(socialAccountCapabilities.socialAccountId, acc[0].id))
        .limit(1)
    : [];
  const accountFlags = (capRow[0]?.flagsJson as Record<string, unknown> | null) ?? null;
  const st = String(t.sourceType || "") as import("@/lib/social/engagement/social-engagement-capabilities").SocialEngagementSourceType;
  const r = resolveSocialEngagementCapabilities({
    provider: t.provider,
    flagsOverride: accountFlags,
    socialAccount: acc[0] ?? null,
    sourceType: st,
  });
  const hasGraphParent = Boolean(getGraphParentCommentIdFromThreadMetadata(t.metadataJson));
  const hasToken = Boolean(acc[0]?.accessTokenEnc);
  const replyGovernance = resolveInboxReplyGovernance({
    thread: { clientId: String(t.clientId), sourceType: st, metadataJson: t.metadataJson },
    sourceType: st,
    capabilities: r,
    hasAccessToken: hasToken,
    hasGraphParent,
  });
  return {
    thread: t,
    messages: msgs,
    campaignName,
    labels: lab.map((x) => ({ id: String(x.id), slug: String(x.slug), displayName: String(x.displayName) })),
    assignments,
    accountFlags,
    canCommentReplyInApp: replyGovernance.canReplyNow,
    replyGovernance,
    debug: {
      provider: String(t.provider),
      sourceType: st,
      externalThreadId: String(t.externalThreadId),
      socialAccountId: String(t.socialAccountId),
      hasGraphParentCommentId: hasGraphParent,
    },
  };
}
