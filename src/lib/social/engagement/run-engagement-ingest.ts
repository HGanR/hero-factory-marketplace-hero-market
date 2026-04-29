import { socialAccounts } from "@/lib/db/schema";
import { recordEngagementIngestError } from "@/lib/social/engagement/engagement-ingest-errors";
import { normalizeEngagementEvent, type NormalizedEngagementIngest } from "@/lib/social/engagement/normalize-engagement-event";
import { upsertSocialEngagementFromIngest } from "@/lib/social/engagement/upsert-social-engagement";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
type AccountRow = typeof socialAccounts.$inferSelect;

/**
 * Single entry: normalize, upsert, record fingerprinted errors to DB (Part 7) and rethrow.
 */
export async function runEngagementIngest(
  db: Db,
  args: {
    raw: unknown;
    ctx: { userId: string; clientId: string; socialAccountId: string; provider: string };
    flagsOverride: unknown;
    socialAccount: AccountRow | null;
  }
): Promise<{ threadId: string; isNew: boolean }> {
  try {
    if (!String(args.ctx.provider ?? "").trim()) {
      throw new Error("VALIDATION: provider required in ingest context");
    }
    const evt: NormalizedEngagementIngest = normalizeEngagementEvent(args.raw, args.ctx);
    return await upsertSocialEngagementFromIngest(db, evt, { flagsOverride: args.flagsOverride, socialAccount: args.socialAccount });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const code = err.message.startsWith("VALIDATION:") ? "VALIDATION" : "INGEST";
    try {
      await recordEngagementIngestError(db, {
        userId: String(args.ctx.userId),
        clientId: String(args.ctx.clientId),
        provider: String(args.ctx.provider || "unknown").slice(0, 32),
        socialAccountId: args.ctx.socialAccountId,
        errorCode: code,
        errorMessage: err.message,
        contextJson: { step: "runEngagementIngest" },
      });
    } catch {
      // best-effort only
    }
    throw e;
  }
}
