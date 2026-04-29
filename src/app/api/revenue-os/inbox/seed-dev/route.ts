import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialAccounts, socialAccountCapabilities } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { runEngagementIngest } from "@/lib/social/engagement/run-engagement-ingest";

const Body = z.object({
  clientId: z.string().min(1),
  socialAccountId: z.string().uuid(),
});

/**
 * POST /api/revenue-os/inbox/seed-dev
 * Development / explicit opt-in only — creates a sample thread for UI wiring.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.REVENUE_OS_INBOX_DEV_SEED !== "1") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const p = Body.safeParse(body);
  if (!p.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const { clientId, socialAccountId } = p.data;
  const db = await getDb();
  const ar = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.id, socialAccountId),
        eq(socialAccounts.userId, String(userId)),
        eq(socialAccounts.clientId, clientId)
      )
    )
    .limit(1);
  const acc = ar[0];
  if (!acc) {
    return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  }
  const capRow = await db
    .select()
    .from(socialAccountCapabilities)
    .where(eq(socialAccountCapabilities.socialAccountId, acc.id))
    .limit(1);
  const flagsOverride = (capRow[0]?.flagsJson as object | null) ?? null;
  try {
    const r = await runEngagementIngest(db, {
      raw: {
        externalThreadId: `dev-thread-${acc.platform}-1`,
        sourceType: "comment",
        campaignId: null,
        lastMessageAt: new Date().toISOString(),
        message: {
          externalMessageId: "dev-msg-1",
          direction: "inbound",
          authorDisplay: "Sample User",
          messageText: "Hi — I had a quick question about pricing. Can someone help?",
          createdAt: new Date().toISOString(),
          raw: { seed: true },
        },
        metadata: {
          from_social_studio: false,
          devSeed: true,
          linkedCampaignTitle: "— link campaign in metadata when available",
        },
      },
      ctx: { userId: String(userId), clientId, socialAccountId: acc.id, provider: acc.platform },
      flagsOverride,
      socialAccount: acc,
    });
    return NextResponse.json({ ok: true, ...r, dataSource: "dev_seed" as const });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const status = err.message.startsWith("VALIDATION:") ? 400 : 500;
    return NextResponse.json({ error: err.message, dataSource: "dev_seed" as const }, { status });
  }
}
