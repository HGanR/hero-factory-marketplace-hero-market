import { describe, it, expect } from "@jest/globals";
import type { campaignReviewerAssignments } from "@/lib/db/schema";
import {
  duplicateReviewerAssignmentResponse,
  invalidReviewerAssignmentResponse,
  mapAssignmentRowToApiItem,
  parseReviewerAssignmentPatchBody,
  parseReviewerAssignmentPostBody,
  timestampFieldToIso,
} from "@/lib/revenue-os/campaign-reviewer-assignment-api";

function row(
  over: Partial<typeof campaignReviewerAssignments.$inferSelect>
): typeof campaignReviewerAssignments.$inferSelect {
  return {
    id: "asg-1",
    campaignId: "camp-1",
    userId: "9",
    role: "approver",
    createdAt: new Date("2026-01-02T10:00:00.000Z"),
    updatedAt: new Date("2026-01-03T11:00:00.000Z"),
    ...over,
  };
}

describe("parseReviewerAssignmentPostBody", () => {
  it("accepts valid userId and role", () => {
    const p = parseReviewerAssignmentPostBody({ userId: 5, role: "editor" });
    expect(p).toEqual({ ok: true, userId: 5, role: "editor" });
  });

  it("accepts numeric string userId", () => {
    const p = parseReviewerAssignmentPostBody({ userId: "12", role: "approver" });
    expect(p).toEqual({ ok: true, userId: 12, role: "approver" });
  });

  it("rejects empty userId", () => {
    expect(parseReviewerAssignmentPostBody({ userId: "", role: "editor" }).ok).toBe(false);
    expect(parseReviewerAssignmentPostBody({ userId: "  ", role: "editor" }).ok).toBe(false);
  });

  it("rejects missing userId", () => {
    const p = parseReviewerAssignmentPostBody({ role: "editor" });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toContain("userId");
  });

  it("rejects empty role", () => {
    const p = parseReviewerAssignmentPostBody({ userId: 1, role: "  " });
    expect(p.ok).toBe(false);
  });

  it("rejects owner role", () => {
    const p = parseReviewerAssignmentPostBody({ userId: 1, role: "owner" });
    expect(p.ok).toBe(false);
  });

  it("rejects invalid role token", () => {
    const p = parseReviewerAssignmentPostBody({ userId: 1, role: "not-a-role" });
    expect(p.ok).toBe(false);
  });
});

describe("parseReviewerAssignmentPatchBody", () => {
  it("parses role", () => {
    expect(parseReviewerAssignmentPatchBody({ role: "reviewer" })).toEqual({
      ok: true,
      role: "reviewer",
    });
  });

  it("rejects empty role", () => {
    expect(parseReviewerAssignmentPatchBody({ role: "" }).ok).toBe(false);
  });
});

describe("mapAssignmentRowToApiItem", () => {
  it("maps row with campaignId and normalized role", () => {
    const m = mapAssignmentRowToApiItem(row({ role: "publisher" }), "camp-x");
    expect(m.id).toBe("asg-1");
    expect(m.campaignId).toBe("camp-x");
    expect(m.userId).toBe(9);
    expect(m.role).toBe("approver");
    expect(m.createdAt).toBe("2026-01-02T10:00:00.000Z");
    expect(m.updatedAt).toBe("2026-01-03T11:00:00.000Z");
  });
});

describe("timestampFieldToIso", () => {
  it("handles Date", () => {
    expect(timestampFieldToIso(new Date("2026-04-01T00:00:00.000Z"))).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("error payload helpers", () => {
  it("invalid shape", () => {
    expect(invalidReviewerAssignmentResponse("bad")).toEqual({
      error: "INVALID_REVIEWER_ASSIGNMENT",
      message: "bad",
    });
  });

  it("duplicate shape", () => {
    expect(duplicateReviewerAssignmentResponse().error).toBe("DUPLICATE_REVIEWER_ASSIGNMENT");
  });
});
