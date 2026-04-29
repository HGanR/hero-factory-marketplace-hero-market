/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { listEngagementThreadsForClient } from "./upsert-social-engagement";

jest.mock("./inbox-batched-list", () => ({
  batchInboxListEnrichment: jest.fn().mockResolvedValue({
    previewBy: new Map([["b1d3e5f7-1111-2222-3333-444455556666", "hello"]]),
    countBy: new Map([["b1d3e5f7-1111-2222-3333-444455556666", 3]]),
    campaignNameBy: new Map([["b1d3e5f7-1111-2222-3333-444455556666", "C1"]]),
    labelSlugsBy: new Map([["b1d3e5f7-1111-2222-3333-444455556666", ["l1"]]]),
    lastAssignBy: new Map([["b1d3e5f7-1111-2222-3333-444455556666", { role: "owner", has: true }]]),
  }),
}));

import { batchInboxListEnrichment } from "./inbox-batched-list";

const threadId = "b1d3e5f7-1111-2222-3333-444455556666";

describe("listEngagementThreadsForClient (shape with badges / enrichment)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("merges thread rows with batch enrichment for preview, labels, assignments", async () => {
    const t = {
      id: threadId,
      userId: "u1",
      clientId: "c1",
      socialAccountId: "acc-1",
      provider: "meta",
      externalThreadId: "ext-1",
      sourceType: "comment",
      status: "new",
      requiresManual: false,
      lastMessageAt: new Date("2024-01-15T00:00:00.000Z"),
      metadataJson: null,
      campaignId: null,
      intent: "question" as const,
      sentiment: null,
      urgency: "low" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([t]),
            }),
          }),
        }),
      }),
    };
    const rows = await listEngagementThreadsForClient(db, { userId: "u1", clientId: "c1", limit: 5 });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.preview).toBe("hello");
    expect(row.messageCount).toBe(3);
    expect(row.campaignName).toBe("C1");
    expect(row.labelSlugs).toEqual(["l1"]);
    expect(row.hasOpenAssignment).toBe(true);
    expect(row.lastAssignedRole).toBe("owner");
    expect(jest.mocked(batchInboxListEnrichment)).toHaveBeenCalled();
  });
});

describe("loadEngagementThreadDetail", () => {
  it("is exported and callable (detail integration covered in reply + Graph metadata tests)", async () => {
    const { loadEngagementThreadDetail } = await import("./upsert-social-engagement");
    expect(typeof loadEngagementThreadDetail).toBe("function");
  });
});
