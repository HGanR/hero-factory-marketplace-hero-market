import { and, count, eq, gte, like, sql } from "drizzle-orm";
import { socialEngagementMessages, socialEngagementThreads } from "@/lib/db/schema";
import { loadRecentEngagementIngestErrors } from "@/lib/social/engagement/engagement-ingest-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Light ingest / queue health for operators (not full provider sync observability).
 */
export async function loadInboxDiagnostics(
  db: Db,
  args: { userId: string; clientId: string; days: number }
): Promise<{
  newThreadsInPeriod: number;
  totalThreads: number;
  messagesInPeriod: number;
  lastIngestByProvider: { provider: string; lastMessageAt: string | null }[];
  lastIngestByAccount: { socialAccountId: string; provider: string; lastMessageAt: string | null }[];
  recentIngestErrors: { at: string; message: string; count: number; provider: string; errorCode: string }[];
  devSeededThreadCount: number;
  note: string;
}> {
  const since = new Date(Date.now() - args.days * 86400_000);
  const base = and(
    eq(socialEngagementThreads.userId, String(args.userId)),
    eq(socialEngagementThreads.clientId, String(args.clientId))
  );
  const newN = await db
    .select({ c: count() })
    .from(socialEngagementThreads)
    .where(
      and(
        base,
        eq(socialEngagementThreads.status, "new"),
        gte(socialEngagementThreads.lastMessageAt, since)
      )
    );
  const totalN = await db
    .select({ c: count() })
    .from(socialEngagementThreads)
    .where(base);
  const msgN = await db
    .select({ c: count() })
    .from(socialEngagementMessages)
    .innerJoin(socialEngagementThreads, eq(socialEngagementThreads.id, socialEngagementMessages.threadId))
    .where(
      and(
        base,
        gte(socialEngagementMessages.createdAt, since)
      )
    );
  const byProv = await db
    .select({
      provider: socialEngagementThreads.provider,
      last: sql<string | null>`MAX(${socialEngagementThreads.lastMessageAt})`.as("last"),
    })
    .from(socialEngagementThreads)
    .where(base)
    .groupBy(socialEngagementThreads.provider);
  const byAcc = await db
    .select({
      socialAccountId: socialEngagementThreads.socialAccountId,
      provider: socialEngagementThreads.provider,
      last: sql<string | null>`MAX(${socialEngagementThreads.lastMessageAt})`.as("last"),
    })
    .from(socialEngagementThreads)
    .where(base)
    .groupBy(socialEngagementThreads.socialAccountId, socialEngagementThreads.provider)
    .limit(40);
  const devSeedN = await db
    .select({ c: count() })
    .from(socialEngagementThreads)
    .where(
      and(base, like(socialEngagementThreads.externalThreadId, "dev-thread-%"))
    );
  const errRows = await loadRecentEngagementIngestErrors(db, {
    userId: String(args.userId),
    clientId: String(args.clientId),
    limit: 12,
  });
  return {
    newThreadsInPeriod: Number(newN[0]?.c ?? 0),
    totalThreads: Number(totalN[0]?.c ?? 0),
    messagesInPeriod: Number(msgN[0]?.c ?? 0),
    lastIngestByProvider: byProv.map((r) => ({
      provider: String(r.provider),
      lastMessageAt: r.last ? String(r.last) : null,
    })),
    lastIngestByAccount: byAcc.map((r) => ({
      socialAccountId: String(r.socialAccountId),
      provider: String(r.provider),
      lastMessageAt: r.last ? String(r.last) : null,
    })),
    recentIngestErrors: errRows.map((e) => ({
      at: e.lastSeenAt,
      message: e.errorMessage,
      count: e.count,
      provider: e.provider,
      errorCode: e.errorCode,
    })),
    devSeededThreadCount: Number(devSeedN[0]?.c ?? 0),
    note:
      errRows.length > 0
        ? "Persisted rows below are fingerprint-deduplicated validation/ingest errors (not provider HTTP traces)."
        : "Ingest error persistence is on — repeated failures are fingerprinted. Use provider logs for raw HTTP/Graph details.",
  };
}
