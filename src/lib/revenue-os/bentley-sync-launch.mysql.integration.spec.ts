/**
 * @jest-environment node
 *
 * Optional real MySQL coverage for Bentley sync-launch. Enable when a DB is available:
 *
 *   BENTLEY_LAUNCH_MYSQL_IT=1 DATABASE_URL=mysql://... npm test -- --testPathPattern=bentley-sync-launch.mysql
 *
 * Uses a random campaign id and deletes rows in afterAll.
 *
 * `runBentleyLaunchFinalizeAction` + empty `postIds` / success paths are covered in
 * `bentley-action-runner-launch-finalize.integration.spec.ts` (jsdom + mocked `syncBentleyLaunchApi`).
 * This file asserts the actual Drizzle + `syncBentleyCampaignPostsAndSchedule` stack against MySQL.
 */
import crypto from "crypto";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { syncBentleyCampaignPostsAndSchedule } from "@/lib/revenue-os/bentley-sync-launch-server";

const runMysqlIt =
  process.env.BENTLEY_LAUNCH_MYSQL_IT === "1" && Boolean(process.env.DATABASE_URL?.trim());

(runMysqlIt ? describe : describe.skip)("Bentley sync-launch (MySQL integration)", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  const campaignId = crypto.randomUUID();
  const userId = process.env.BENTLEY_IT_USER_ID?.trim() || "999999";

  beforeAll(async () => {
    db = await getDb();
  });

  afterAll(async () => {
    await db.delete(schema.campaignPosts).where(eq(schema.campaignPosts.campaignId, campaignId));
    await db.delete(schema.campaignAssets).where(eq(schema.campaignAssets.campaignId, campaignId));
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
  });

  it("creates campaign_posts with non-empty postIds and second sync does not duplicate", async () => {
    await db.insert(schema.campaigns).values({
      id: campaignId,
      userId: String(userId),
      clientId: "bentley_mysql_it",
      name: "MySQL IT",
      bentleyGenerationJson: {
        campaign: {
          offerStatement: "Offer",
          shortFormHooks: ["Hook"],
          industry: "I",
          targetAudience: "T",
          messagePillars: [],
          longFormOutlines: [],
          objectionReplies: [],
        },
        platforms: ["Instagram"],
        postingPlatforms: ["instagram", "linkedin"],
        syncedAt: new Date().toISOString(),
      },
    });

    const first = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: String(userId),
      campaignId,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });

    expect(first.postIds.length).toBeGreaterThan(0);
    expect(first.created).toBeGreaterThanOrEqual(1);

    const second = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: String(userId),
      campaignId,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });

    expect(second.created).toBe(0);
    expect(second.skipped).toBe(first.postIds.length);
    expect(second.postIds.length).toBe(first.postIds.length);

    const rows = await db
      .select()
      .from(schema.campaignPosts)
      .where(eq(schema.campaignPosts.campaignId, campaignId));
    expect(rows.length).toBe(first.postIds.length);
  });
});
