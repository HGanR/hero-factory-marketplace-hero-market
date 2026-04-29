import { inArray, sql, count, eq, desc } from "drizzle-orm";
import { socialEngagementMessages, socialEngagementThreadLabels, socialEngagementLabels, socialEngagementAssignments, campaigns } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Batched message counts, latest preview text, label slugs, and latest assignment per thread (replaces N+1 loop).
 */
export async function batchInboxListEnrichment(
  db: Db,
  args: {
    threadIds: string[];
    campaignIdByThread: Map<string, string | null>;
  }
): Promise<{
  countBy: Map<string, number>;
  previewBy: Map<string, string>;
  labelSlugsBy: Map<string, string[]>;
  lastAssignBy: Map<string, { has: boolean; role: string | null }>;
  campaignNameBy: Map<string, string | null>;
}> {
  const { threadIds, campaignIdByThread } = args;
  const empty = {
    countBy: new Map<string, number>(),
    previewBy: new Map<string, string>(),
    labelSlugsBy: new Map<string, string[]>(),
    lastAssignBy: new Map<string, { has: boolean; role: string | null }>(),
    campaignNameBy: new Map<string, string | null>(),
  };
  if (threadIds.length === 0) {
    return empty;
  }
  for (const id of threadIds) {
    empty.labelSlugsBy.set(id, []);
  }

  const countRows = await db
    .select({ tid: socialEngagementMessages.threadId, c: count() })
    .from(socialEngagementMessages)
    .where(inArray(socialEngagementMessages.threadId, threadIds))
    .groupBy(socialEngagementMessages.threadId);
  const countBy = new Map<string, number>();
  for (const r of countRows) {
    countBy.set(String(r.tid), Number(r.c));
  }

  const previewBy = new Map<string, string>();
  try {
    const [previewPacket] = (await db.execute(sql`
      SELECT t.thread_id, t.message_text
      FROM (
        SELECT
          m.thread_id,
          m.message_text,
          ROW_NUMBER() OVER (PARTITION BY m.thread_id ORDER BY m.created_at DESC, m.id DESC) AS rn
        FROM social_engagement_messages m
        WHERE ${inArray(socialEngagementMessages.threadId, threadIds)}
      ) t
      WHERE t.rn = 1
    `)) as unknown as [unknown];
    const prows = Array.isArray(previewPacket) ? previewPacket : (previewPacket as { rows?: unknown[] })?.rows ?? [];
    for (const row of prows as { thread_id: string; message_text: string | null }[]) {
      previewBy.set(String(row.thread_id), (row.message_text ?? "").trim());
    }
  } catch {
    for (const tid of threadIds) {
      const one = await db
        .select()
        .from(socialEngagementMessages)
        .where(eq(socialEngagementMessages.threadId, tid))
        .orderBy(desc(socialEngagementMessages.createdAt))
        .limit(1);
      previewBy.set(tid, one[0]?.messageText?.trim() ?? "");
    }
  }

  const lab = await db
    .select({
      threadId: socialEngagementThreadLabels.threadId,
      slug: socialEngagementLabels.slug,
    })
    .from(socialEngagementThreadLabels)
    .innerJoin(socialEngagementLabels, eq(socialEngagementThreadLabels.labelId, socialEngagementLabels.id))
    .where(inArray(socialEngagementThreadLabels.threadId, threadIds));
  const labelSlugsBy = new Map<string, string[]>();
  for (const id of threadIds) {
    labelSlugsBy.set(id, []);
  }
  for (const l of lab) {
    const tid = String(l.threadId);
    const list = labelSlugsBy.get(tid) ?? [];
    list.push(String(l.slug));
    labelSlugsBy.set(tid, list);
  }

  const assigns = await db
    .select()
    .from(socialEngagementAssignments)
    .where(inArray(socialEngagementAssignments.threadId, threadIds))
    .orderBy(desc(socialEngagementAssignments.createdAt));
  const lastAssignBy = new Map<string, { has: boolean; role: string | null }>();
  for (const id of threadIds) {
    lastAssignBy.set(id, { has: false, role: null });
  }
  const seen = new Set<string>();
  for (const a of assigns) {
    const tid = String(a.threadId);
    if (seen.has(tid)) {
      continue;
    }
    seen.add(tid);
    lastAssignBy.set(tid, { has: true, role: a.assignedRole ? String(a.assignedRole) : null });
  }

  const cids = [...new Set([...campaignIdByThread.values()].filter((x): x is string => Boolean(x)))];
  const campNames = new Map<string, string>();
  if (cids.length) {
    const crows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, cids));
    for (const c of crows) {
      campNames.set(String(c.id), String(c.name ?? ""));
    }
  }
  const campaignNameBy = new Map<string, string | null>();
  for (const tid of threadIds) {
    const cid = campaignIdByThread.get(tid) ?? null;
    campaignNameBy.set(tid, cid ? (campNames.get(cid) ?? null) : null);
  }

  return { countBy, previewBy, labelSlugsBy, lastAssignBy, campaignNameBy };
}
