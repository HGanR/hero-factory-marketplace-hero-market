import { createHash, randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { socialEngagementIngestErrors } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function buildEngagementIngestErrorFingerprint(args: {
  provider: string;
  clientId: string;
  errorCode: string;
  socialAccountId: string | null;
}): string {
  return createHash("sha256")
    .update([String(args.provider), String(args.clientId), String(args.errorCode), args.socialAccountId ?? ""].join("\u0001"))
    .digest("hex");
}

/**
 * Idempotent: repeated same fingerprint bumps count and refreshes last_seen + message.
 */
export async function recordEngagementIngestError(
  db: Db,
  args: {
    userId: string;
    clientId: string;
    provider: string;
    socialAccountId: string | null;
    errorCode: string;
    errorMessage: string;
    contextJson?: unknown;
  }
): Promise<void> {
  const fp = buildEngagementIngestErrorFingerprint({
    provider: args.provider,
    clientId: args.clientId,
    errorCode: args.errorCode,
    socialAccountId: args.socialAccountId,
  });
  const msg = args.errorMessage.slice(0, 8000);
  const id = randomUUID();
  await db
    .insert(socialEngagementIngestErrors)
    .values({
      id,
      userId: String(args.userId),
      fingerprint: fp,
      provider: args.provider.slice(0, 32),
      socialAccountId: args.socialAccountId,
      clientId: String(args.clientId),
      errorCode: args.errorCode.slice(0, 64),
      errorMessage: msg,
      contextJson: args.contextJson ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        count: sql`${socialEngagementIngestErrors.count} + 1`,
        lastSeenAt: new Date(),
        errorMessage: msg,
        contextJson: args.contextJson ?? null,
        provider: args.provider.slice(0, 32),
        socialAccountId: args.socialAccountId,
      },
    });
}

export type IngestErrorRow = {
  lastSeenAt: string;
  errorMessage: string;
  count: number;
  provider: string;
  errorCode: string;
};

export async function loadRecentEngagementIngestErrors(
  db: Db,
  args: { userId: string; clientId: string; limit: number }
): Promise<IngestErrorRow[]> {
  const lim = Math.min(40, Math.max(1, args.limit));
  const rows = await db
    .select({
      lastSeenAt: socialEngagementIngestErrors.lastSeenAt,
      errorMessage: socialEngagementIngestErrors.errorMessage,
      count: socialEngagementIngestErrors.count,
      provider: socialEngagementIngestErrors.provider,
      errorCode: socialEngagementIngestErrors.errorCode,
    })
    .from(socialEngagementIngestErrors)
    .where(
      and(eq(socialEngagementIngestErrors.userId, String(args.userId)), eq(socialEngagementIngestErrors.clientId, String(args.clientId)))
    )
    .orderBy(desc(socialEngagementIngestErrors.lastSeenAt))
    .limit(lim);
  return rows.map((r) => ({
    lastSeenAt: r.lastSeenAt ? (r.lastSeenAt instanceof Date ? r.lastSeenAt.toISOString() : String(r.lastSeenAt)) : "",
    errorMessage: String(r.errorMessage ?? ""),
    count: Number(r.count ?? 1),
    provider: String(r.provider),
    errorCode: String(r.errorCode),
  }));
}
