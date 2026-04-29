/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from "@jest/globals";
import {
  collectCampaignIdsForPublishApprovalSlaBatchScan,
  executePublishApprovalSlaScanForCampaign,
  runPublishApprovalSlaScanAllCampaigns,
} from "@/lib/revenue-os/publish-approval-sla-scan-batch";
import { BENTLEY_UTM_APPROVAL_STATUS, BENTLEY_UTM_APPROVAL_STEP_STARTED_AT } from "@/lib/revenue-os/publish-approval-utm";

function mockDbForOneCampaign() {
  const campRow = {
    id: "c1",
    name: "N",
    clientId: "cl",
    userId: "1",
    publishApprovalChainJson: null,
  };
  return {
    select: jest
      .fn()
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([campRow]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: "p1", utmParams: {} }]),
        }),
      }),
  };
}

describe("collectCampaignIdsForPublishApprovalSlaBatchScan", () => {
  it("keeps only campaigns with effective pending_approval", () => {
    const { campaignIdsToScan, campaignsSkipped } = collectCampaignIdsForPublishApprovalSlaBatchScan(
      [
        { campaignId: "c1", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "approved" } },
        { campaignId: "c2", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" } },
        { campaignId: "c3", utmParams: {} },
      ],
      true,
      50
    );
    expect(campaignIdsToScan).toEqual(["c2", "c3"]);
    expect(campaignsSkipped).toBe(0);
  });

  it("treats implicit pending only when worker gate is on", () => {
    const { campaignIdsToScan } = collectCampaignIdsForPublishApprovalSlaBatchScan(
      [{ campaignId: "c1", utmParams: {} }],
      false,
      50
    );
    expect(campaignIdsToScan).toHaveLength(0);
  });

  it("reports campaignsSkipped when over maxCampaigns cap", () => {
    const rows = ["a", "b", "c"].map((id) => ({
      campaignId: id,
      utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" },
    }));
    const { campaignIdsToScan, campaignsSkipped } = collectCampaignIdsForPublishApprovalSlaBatchScan(
      rows,
      true,
      2
    );
    expect(campaignIdsToScan).toEqual(["a", "b"]);
    expect(campaignsSkipped).toBe(1);
  });

  it("dedupes same campaign id in probe order", () => {
    const { campaignIdsToScan } = collectCampaignIdsForPublishApprovalSlaBatchScan(
      [
        { campaignId: "x", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" } },
        { campaignId: "x", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" } },
      ],
      true,
      10
    );
    expect(campaignIdsToScan).toEqual(["x"]);
  });
});

describe("executePublishApprovalSlaScanForCampaign", () => {
  it("returns ok false when db throws", async () => {
    const db = {
      select: jest.fn(() => {
        throw new Error("db down");
      }),
    };
    const r = await executePublishApprovalSlaScanForCampaign(db as never, {
      campaignId: "c1",
      workerRequiresApproval: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "error" });
    expect((r as { detailMessage?: string }).detailMessage).toBe("db down");
  });

  it("returns ok false when campaign row missing", async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const r = await executePublishApprovalSlaScanForCampaign(db as never, {
      campaignId: "c1",
      workerRequiresApproval: true,
    });
    expect(r).toEqual({ ok: false, reason: "campaign_missing" });
  });

  it("invokes injected runCampaignScan and returns counts", async () => {
    const runCampaignScan = jest.fn().mockResolvedValue({ checked: 3, remindersSent: 1 });
    const db = mockDbForOneCampaign();
    const r = await executePublishApprovalSlaScanForCampaign(db as never, {
      campaignId: "c1",
      workerRequiresApproval: true,
      runCampaignScan,
    });
    expect(r).toEqual({ ok: true, checked: 3, remindersSent: 1 });
    expect(runCampaignScan).toHaveBeenCalledTimes(1);
  });
});

describe("runPublishApprovalSlaScanAllCampaigns", () => {
  it("returns approvalGateDisabled when worker gate is off", async () => {
    const s = await runPublishApprovalSlaScanAllCampaigns({} as never, { workerRequiresApproval: false });
    expect(s.approvalGateDisabled).toBe(true);
    expect(s.campaignsScanned).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.boundedErrors).toEqual([]);
  });

  it("aggregates summary from injected probe + per-campaign scan", async () => {
    const runCampaignScan = jest.fn().mockResolvedValue({ checked: 2, remindersSent: 1 });
    const db = mockDbForOneCampaign();
    const s = await runPublishApprovalSlaScanAllCampaigns(db as never, {
      workerRequiresApproval: true,
      maxCampaigns: 10,
      deps: {
        loadProbeRows: async () => [
          { campaignId: "c1", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" } },
        ],
        runCampaignScan,
      },
    });
    expect(s.campaignsScanned).toBe(1);
    expect(s.postsChecked).toBe(2);
    expect(s.remindersCreated).toBe(1);
    expect(s.campaignsSkipped).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.approvalGateDisabled).toBe(false);
    expect(s.boundedErrors).toEqual([]);
  });

  it("continues batch when one campaign execution fails", async () => {
    const runCampaignScan = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ checked: 1, remindersSent: 0 });
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([
                { id: "c1", name: "A", clientId: "", userId: "1", publishApprovalChainJson: null },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              {
                id: "p1",
                utmParams: {
                  [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
                  [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2020-01-01T00:00:00.000Z",
                },
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([
                { id: "c2", name: "B", clientId: "", userId: "1", publishApprovalChainJson: null },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: "p2", utmParams: {} }]),
          }),
        }),
    };

    const s = await runPublishApprovalSlaScanAllCampaigns(db as never, {
      workerRequiresApproval: true,
      maxCampaigns: 10,
      deps: {
        loadProbeRows: async () => [
          { campaignId: "c1", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" } },
          { campaignId: "c2", utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" } },
        ],
        runCampaignScan,
      },
    });

    expect(s.errors).toBe(1);
    expect(s.campaignsScanned).toBe(1);
    expect(runCampaignScan).toHaveBeenCalledTimes(2);
    expect(s.boundedErrors.some((e) => e.campaignId === "c1")).toBe(true);
  });
});
