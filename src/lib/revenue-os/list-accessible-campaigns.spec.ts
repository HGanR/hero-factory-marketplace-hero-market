import { describe, it, expect } from "@jest/globals";
import type { CampaignRow } from "@/lib/db/schema";
import {
  mapMergedCampaignToListApiItem,
  mergeOwnedAndAssignedCampaignRows,
} from "@/lib/revenue-os/list-accessible-campaigns";

function camp(p: Partial<CampaignRow> & { id: string }): CampaignRow {
  return {
    userId: "1",
    clientId: "",
    name: "n",
    objective: null,
    status: "DRAFT",
    startAt: null,
    endAt: null,
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    ...p,
  };
}

describe("mergeOwnedAndAssignedCampaignRows", () => {
  it("includes owned campaigns with owner metadata", () => {
    const m = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [camp({ id: "a", name: "Mine" })],
      assignedRows: [],
    });
    expect(m).toHaveLength(1);
    expect(m[0].accessSource).toBe("owner");
    expect(m[0].viewerCampaignReviewerRole).toBe("owner");
    expect(m[0].campaign.id).toBe("a");
  });

  it("includes assigned-only campaigns", () => {
    const m = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [],
      assignedRows: [{ campaign: camp({ id: "s", name: "Shared" }), assignmentRole: "reviewer" }],
    });
    expect(m).toHaveLength(1);
    expect(m[0].accessSource).toBe("assignment");
    expect(m[0].viewerCampaignReviewerRole).toBe("reviewer");
  });

  it("dedupes when owner is also assigned — owner wins", () => {
    const c = camp({ id: "x", name: "Both" });
    const m = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [c],
      assignedRows: [{ campaign: c, assignmentRole: "approver" }],
    });
    expect(m).toHaveLength(1);
    expect(m[0].accessSource).toBe("owner");
    expect(m[0].viewerCampaignReviewerRole).toBe("owner");
  });

  it("sorts by createdAt descending", () => {
    const older = camp({ id: "old", createdAt: new Date("2025-01-01T00:00:00.000Z") });
    const newer = camp({ id: "new", createdAt: new Date("2026-06-01T00:00:00.000Z") });
    const m = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [older, newer],
      assignedRows: [],
    });
    expect(m.map((x) => x.campaign.id)).toEqual(["new", "old"]);
  });

  it("normalizes assignment role", () => {
    const m = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [],
      assignedRows: [{ campaign: camp({ id: "p" }), assignmentRole: "publisher" }],
    });
    expect(m[0].viewerCampaignReviewerRole).toBe("approver");
  });
});

describe("mapMergedCampaignToListApiItem", () => {
  it("includes viewer metadata and accessSource for owner", () => {
    const merged = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [camp({ id: "o" })],
      assignedRows: [],
    })[0];
    const j = mapMergedCampaignToListApiItem(merged, { adminSession: false });
    expect(j.id).toBe("o");
    expect(j.accessSource).toBe("owner");
    expect(j.viewerCampaignReviewerRole).toBe("owner");
    expect(j.viewerMayFinalizePublishApproval).toBe(true);
  });

  it("reviewer assignment cannot finalize unless admin session", () => {
    const merged = mergeOwnedAndAssignedCampaignRows({
      ownedRows: [],
      assignedRows: [{ campaign: camp({ id: "r" }), assignmentRole: "reviewer" }],
    })[0];
    expect(mapMergedCampaignToListApiItem(merged, { adminSession: false }).viewerMayFinalizePublishApproval).toBe(
      false
    );
    expect(mapMergedCampaignToListApiItem(merged, { adminSession: true }).viewerMayFinalizePublishApproval).toBe(
      true
    );
  });
});
