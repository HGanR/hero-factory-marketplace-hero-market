/**
 * @jest-environment jsdom
 *
 * Bridges real MySQL `syncBentleyCampaignPostsAndSchedule` with `runBentleyLaunchFinalizeAction` by
 * implementing `syncBentleyLaunchApi` with the same DB logic the HTTP route uses.
 *
 *   BENTLEY_LAUNCH_MYSQL_IT=1 DATABASE_URL=mysql://... npm test -- --testPathPattern=bentley-launch-finalize-mysql-bridge
 */
import crypto from "crypto";
import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { syncBentleyCampaignPostsAndSchedule } from "@/lib/revenue-os/bentley-sync-launch-server";
import * as PipelineActions from "@/lib/revenue-os/revenue-os-pipeline-actions";

jest.mock("@/lib/revenue-os/bentley-pipeline-stage-sync", () => ({
  reconcileBentleySnapshotFromWorkflow: jest.fn(),
}));

jest.mock("@/lib/revenue-os/revenue-os-pipeline-actions", () => ({
  ...jest.requireActual<typeof import("@/lib/revenue-os/revenue-os-pipeline-actions")>(
    "@/lib/revenue-os/revenue-os-pipeline-actions"
  ),
  syncBentleyLaunchApi: jest.fn(),
}));

const runBridge =
  process.env.BENTLEY_LAUNCH_MYSQL_IT === "1" && Boolean(process.env.DATABASE_URL?.trim());

(runBridge ? describe : describe.skip)("Bentley finalize + MySQL sync bridge", () => {
  const mockSync = jest.mocked(PipelineActions.syncBentleyLaunchApi);
  let db: Awaited<ReturnType<typeof getDb>>;
  const campaignId = crypto.randomUUID();
  const userId = process.env.BENTLEY_IT_USER_ID?.trim() || "999999";

  beforeAll(async () => {
    db = await getDb();
    await db.insert(schema.campaigns).values({
      id: campaignId,
      userId: String(userId),
      clientId: "bentley_mysql_finalize_bridge",
      name: "Finalize bridge IT",
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
        postingPlatforms: ["instagram"],
        syncedAt: new Date().toISOString(),
      },
    });
  });

  afterAll(async () => {
    await db.delete(schema.campaignPosts).where(eq(schema.campaignPosts.campaignId, campaignId));
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSync.mockImplementation(async (input) => {
      const r = await syncBentleyCampaignPostsAndSchedule(db, {
        userId: String(userId),
        campaignId: input.campaignId,
        scheduleStrategy: input.scheduleStrategy,
        staggerMinutes: input.staggerMinutes,
      });
      return {
        ok: true,
        created: r.created,
        skipped: r.skipped,
        rescheduled: r.rescheduled,
        postIds: r.postIds,
        requireApproval: r.requireApproval,
      };
    });
  });

  it("finalize completes when MySQL sync returns post ids", async () => {
    const { resetWorkflowState, saveWorkflowState, defaultWorkflowState, loadWorkflowState } =
      await import("@/lib/revenue-os/bentley-workflow");
    const { runBentleyLaunchFinalizeAction } = await import("@/lib/revenue-os/bentley-action-runner");

    resetWorkflowState();
    sessionStorage.clear();
    saveWorkflowState({
      ...defaultWorkflowState(),
      artifacts: { ...defaultWorkflowState().artifacts, bentleyDbCampaignId: campaignId },
      updatedAt: Date.now(),
    });

    const r = await runBentleyLaunchFinalizeAction({
      userId,
      clientId: "c1",
      getSnapshot: () =>
        ({
          industryKey: "x",
          contentIndustry: "X",
          targetAudience: "Y",
          traffic: 1,
          conversionRate: 1,
          aov: 1,
          businessName: "B",
          coreOffer: "O",
          transformation: "T",
          platforms: ["TikTok"],
          postingPlatforms: ["tiktok"],
          tone: "P",
          contentType: "Full Post",
          imageStyle: "cinematic",
          campaignNotes: "x".repeat(140),
        }) as never,
      applyPatch: jest.fn(),
    });

    expect(r.ok).toBe(true);
    expect(loadWorkflowState().completed.launch_ready).toBe(true);
  });

  it("finalize fails when sync yields zero post ids", async () => {
    mockSync.mockResolvedValueOnce({
      ok: true,
      created: 0,
      skipped: 0,
      rescheduled: 0,
      postIds: [],
      requireApproval: false,
    });

    const { resetWorkflowState, saveWorkflowState, defaultWorkflowState, loadWorkflowState } =
      await import("@/lib/revenue-os/bentley-workflow");
    const { runBentleyLaunchFinalizeAction } = await import("@/lib/revenue-os/bentley-action-runner");

    resetWorkflowState();
    sessionStorage.clear();
    saveWorkflowState({
      ...defaultWorkflowState(),
      artifacts: { ...defaultWorkflowState().artifacts, bentleyDbCampaignId: campaignId },
      updatedAt: Date.now(),
    });

    const r = await runBentleyLaunchFinalizeAction({
      userId,
      getSnapshot: () => ({}) as never,
      applyPatch: jest.fn(),
    });

    expect(r.ok).toBe(false);
    expect(loadWorkflowState().completed.launch_ready).toBeFalsy();
  });
});
