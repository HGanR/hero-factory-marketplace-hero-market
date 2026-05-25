import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDueScheduledPublishes } from "@/lib/social/run-due-scheduled-publishes";
import type { CampaignPostPublishContext } from "@/lib/social/campaign-post-publish";
import { isScheduledPostDue } from "@/lib/social/scheduled-publish-executor";

function ctxStub(postId: string): CampaignPostPublishContext {
  return {
    post: {
      id: postId,
      campaignId: "c1",
      caption: "hi",
      hashtags: null,
      linkUrl: null,
      utmParams: null,
    } as CampaignPostPublishContext["post"],
    campaign: { userId: "u1", clientId: "" } as CampaignPostPublishContext["campaign"],
    platformKey: "linkedin",
    accountRow: {} as CampaignPostPublishContext["accountRow"],
    accessToken: "t",
    refreshToken: null,
  };
}

function drizzleLikeSelectChain(
  limitResult: () => Promise<unknown[]>,
  freshRow: () => Promise<unknown[]>
) {
  return {
    from() {
      return {
        innerJoin() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit: limitResult,
                  };
                },
              };
            },
          };
        },
        where() {
          return {
            limit: freshRow,
          };
        },
      };
    },
  };
}

function createMockDbForSuccessSinglePost(
  post: Record<string, unknown>,
  opts?: { campaignAutopilotPublish?: boolean }
) {
  const store = { ...post };
  const campaignAutopilotPublish = opts?.campaignAutopilotPublish ?? true;

  const db = {
    select() {
      return drizzleLikeSelectChain(
        async () => {
          if (
            isScheduledPostDue(
              {
                id: String(store.id),
                status: String(store.status),
                scheduledAt: store.scheduledAt as Date | null,
                scheduledPublishMeta: store.scheduledPublishMeta,
              },
              new Date("2026-06-01T12:00:00.000Z")
            )
          ) {
            return [{ post: store, campaignAutopilotPublish }];
          }
          return [];
        },
        async () => [store]
      );
    },
    update() {
      return {
        set: (vals: Record<string, unknown>) => ({
          where: async () => {
            Object.assign(store, vals);
            return [{ affectedRows: 1 }];
          },
        }),
      };
    },
    insert() {
      return {
        values: async () => {},
      };
    },
  };
  return {
    db,
    get store() {
      return store;
    },
  };
}

describe("runDueScheduledPublishes", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("publishes a due SCHEDULED post (success path)", async () => {
    const { db, store } = createMockDbForSuccessSinglePost({
      id: "p1",
      campaignId: "c1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
      scheduledPublishMeta: null,
      platform: "linkedin",
    });

    const summary = await runDueScheduledPublishes({
      now,
      limit: 5,
      db,
      deps: {
        loadContext: async (_d, id) => (id === "p1" ? ctxStub("p1") : null),
        executePublish: async () => ({ platformPostId: "ext-1" }),
      },
    });

    assert.equal(summary.published, 1);
    assert.equal(summary.failed, 0);
    assert.equal(summary.skippedAwaitingApproval, 0);
    assert.equal(store.status, "POSTED");
  });

  it("schedules retry on transient failure", async () => {
    const { db, store } = createMockDbForSuccessSinglePost({
      id: "p2",
      campaignId: "c1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
      scheduledPublishMeta: null,
      platform: "linkedin",
    });

    const summary = await runDueScheduledPublishes({
      now,
      limit: 5,
      db,
      deps: {
        loadContext: async (_d, id) => (id === "p2" ? ctxStub("p2") : null),
        executePublish: async () => {
          throw new Error("HTTP 503");
        },
      },
    });

    assert.equal(summary.retried, 1);
    assert.equal(summary.skippedAwaitingApproval, 0);
    assert.equal(store.status, "RETRY_SCHEDULED");
    assert.ok((store.scheduledPublishMeta as { nextPublishAttemptAt?: string })?.nextPublishAttemptAt);
  });

  it("marks FAILED for permanent errors", async () => {
    const { db, store } = createMockDbForSuccessSinglePost({
      id: "p3",
      campaignId: "c1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
      scheduledPublishMeta: null,
      platform: "linkedin",
    });

    const summary = await runDueScheduledPublishes({
      now,
      limit: 5,
      db,
      deps: {
        loadContext: async (_d, id) => (id === "p3" ? ctxStub("p3") : null),
        executePublish: async () => {
          throw new Error("ACCOUNT_NOT_CONNECTED");
        },
      },
    });

    assert.equal(summary.failed, 1);
    assert.equal(summary.skippedAwaitingApproval, 0);
    assert.equal(store.status, "FAILED");
  });

  it("skips when claim loses race (0 affected rows)", async () => {
    const post = {
      id: "p4",
      campaignId: "c1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
      scheduledPublishMeta: null,
      platform: "linkedin",
    };
    const db = {
      select() {
        return drizzleLikeSelectChain(async () => [{ post, campaignAutopilotPublish: true }], async () => [post]);
      },
      update() {
        return {
          set: () => ({
            where: async () => [{ affectedRows: 0 }],
          }),
        };
      },
      insert() {
        return { values: async () => {} };
      },
    };

    const summary = await runDueScheduledPublishes({
      now,
      limit: 5,
      db,
      deps: {
        loadContext: async () => ctxStub("p4"),
        executePublish: async () => ({ platformPostId: "x" }),
      },
    });

    assert.equal(summary.skipped, 1);
    assert.equal(summary.published, 0);
    assert.equal(summary.skippedAwaitingApproval, 0);
  });

  it("skips due post when approval gate is on and post is pending approval", async () => {
    const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    try {
      const { db, store } = createMockDbForSuccessSinglePost(
        {
          id: "p-appr",
          campaignId: "c1",
          status: "SCHEDULED",
          scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
          scheduledPublishMeta: null,
          platform: "linkedin",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
        { campaignAutopilotPublish: false }
      );

      const summary = await runDueScheduledPublishes({
        now,
        limit: 5,
        db,
        deps: {
          loadContext: async () => ctxStub("p-appr"),
          executePublish: async () => ({ platformPostId: "ext-1" }),
        },
      });

      assert.equal(summary.published, 0);
      assert.equal(summary.skippedAwaitingApproval, 1);
      assert.equal(store.status, "SCHEDULED");
    } finally {
      if (prev === undefined) delete process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
      else process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
    }
  });

  it("publishes when approval gate is on and post is approved", async () => {
    const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    try {
      const { db, store } = createMockDbForSuccessSinglePost({
        id: "p-ok",
        campaignId: "c1",
        status: "SCHEDULED",
        scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
        scheduledPublishMeta: null,
        platform: "linkedin",
        utmParams: { bentley_approval_status: "approved" },
      });

      const summary = await runDueScheduledPublishes({
        now,
        limit: 5,
        db,
        deps: {
          loadContext: async (_d, id) => (id === "p-ok" ? ctxStub("p-ok") : null),
          executePublish: async () => ({ platformPostId: "ext-1" }),
        },
      });

      assert.equal(summary.published, 1);
      assert.equal(summary.skippedAwaitingApproval, 0);
      assert.equal(store.status, "POSTED");
    } finally {
      if (prev === undefined) delete process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
      else process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
    }
  });

  it("skips rejected post when approval gate is on", async () => {
    const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    try {
      const { db, store } = createMockDbForSuccessSinglePost({
        id: "p-rej",
        campaignId: "c1",
        status: "SCHEDULED",
        scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
        scheduledPublishMeta: null,
        platform: "linkedin",
        utmParams: { bentley_approval_status: "rejected" },
      });

      const summary = await runDueScheduledPublishes({
        now,
        limit: 5,
        db,
        deps: {
          loadContext: async () => ctxStub("p-rej"),
          executePublish: async () => ({ platformPostId: "ext-1" }),
        },
      });

      assert.equal(summary.published, 0);
      assert.equal(summary.skippedAwaitingApproval, 1);
      assert.equal(store.status, "SCHEDULED");
    } finally {
      if (prev === undefined) delete process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
      else process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
    }
  });

  it("runs Content360 branch when publishRoute is content360", async () => {
    let c360Calls = 0;
    const row = {
      post: {
        id: "pc360",
        campaignId: "c1",
        status: "SCHEDULED",
        scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
        scheduledPublishMeta: { publishRoute: "content360", providerPublishJobId: "job-1" },
        platform: "instagram",
        utmParams: null,
      },
      campaignAutopilotPublish: true,
    };
    const db = {
      select() {
        return drizzleLikeSelectChain(async () => [row], async () => [row.post]);
      },
      update() {
        return {
          set: () => ({
            where: async () => [{ affectedRows: 1 }],
          }),
        };
      },
      insert() {
        return { values: async () => {} };
      },
    };

    const summary = await runDueScheduledPublishes({
      now: new Date("2026-06-01T12:00:00.000Z"),
      limit: 5,
      db,
      deps: {
        loadContext: async () => null,
        executePublish: async () => ({ platformPostId: "x" }),
        processContent360DuePost: async () => {
          c360Calls += 1;
          return "published";
        },
      },
    });

    assert.equal(summary.content360Attempted, 1);
    assert.equal(summary.content360Published, 1);
    assert.equal(c360Calls, 1);
    assert.equal(summary.published, 0);
  });
});
