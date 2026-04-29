import { describe, it, expect } from "@jest/globals";
import {
  mapLegacyActorRoleToReviewerRole,
  normalizeReviewerRole,
  parseAssignableCampaignReviewerRoleFromRequest,
  userCanActOnApprovalChainStep,
  userCanFinalizePublishApproval,
} from "@/lib/revenue-os/campaign-reviewer-role";

describe("normalizeReviewerRole", () => {
  it("maps canonical and aliases", () => {
    expect(normalizeReviewerRole("owner")).toBe("owner");
    expect(normalizeReviewerRole("EDITOR")).toBe("editor");
    expect(normalizeReviewerRole("publisher")).toBe("approver");
    expect(normalizeReviewerRole("operator")).toBe("editor");
    expect(normalizeReviewerRole("admin")).toBe("approver");
  });

  it("unknown is restrictive", () => {
    expect(normalizeReviewerRole("")).toBe("reviewer");
    expect(normalizeReviewerRole("nope")).toBe("reviewer");
  });
});

describe("userCanFinalizePublishApproval", () => {
  it("allows owner editor approver", () => {
    expect(userCanFinalizePublishApproval("owner")).toBe(true);
    expect(userCanFinalizePublishApproval("editor")).toBe(true);
    expect(userCanFinalizePublishApproval("approver")).toBe(true);
  });

  it("denies reviewer unless admin session", () => {
    expect(userCanFinalizePublishApproval("reviewer")).toBe(false);
    expect(userCanFinalizePublishApproval("reviewer", { adminSession: true })).toBe(true);
  });
});

describe("parseAssignableCampaignReviewerRoleFromRequest", () => {
  it("accepts canonical assignable roles", () => {
    expect(parseAssignableCampaignReviewerRoleFromRequest("editor")).toBe("editor");
    expect(parseAssignableCampaignReviewerRoleFromRequest("REVIEWER")).toBe("reviewer");
    expect(parseAssignableCampaignReviewerRoleFromRequest("approver")).toBe("approver");
  });

  it("maps common aliases", () => {
    expect(parseAssignableCampaignReviewerRoleFromRequest("publisher")).toBe("approver");
    expect(parseAssignableCampaignReviewerRoleFromRequest("operator")).toBe("editor");
  });

  it("rejects owner and garbage", () => {
    expect(parseAssignableCampaignReviewerRoleFromRequest("owner")).toBeNull();
    expect(parseAssignableCampaignReviewerRoleFromRequest("")).toBeNull();
    expect(parseAssignableCampaignReviewerRoleFromRequest("nope")).toBeNull();
  });
});

describe("userCanActOnApprovalChainStep", () => {
  it("requires exact role match", () => {
    expect(userCanActOnApprovalChainStep("editor", "editor")).toBe(true);
    expect(userCanActOnApprovalChainStep("approver", "editor")).toBe(false);
    expect(userCanActOnApprovalChainStep("owner", "owner")).toBe(true);
    expect(userCanActOnApprovalChainStep("owner", "editor")).toBe(false);
  });

  it("denies reviewer and allows admin bypass", () => {
    expect(userCanActOnApprovalChainStep("reviewer", "editor")).toBe(false);
    expect(userCanActOnApprovalChainStep("reviewer", "editor", { adminSession: true })).toBe(true);
  });
});

describe("mapLegacyActorRoleToReviewerRole", () => {
  it("maps known governance roles", () => {
    expect(mapLegacyActorRoleToReviewerRole("owner")).toBe("owner");
    expect(mapLegacyActorRoleToReviewerRole("operator")).toBe("editor");
    expect(mapLegacyActorRoleToReviewerRole("publisher")).toBe("approver");
    expect(mapLegacyActorRoleToReviewerRole("admin")).toBe("approver");
    expect(mapLegacyActorRoleToReviewerRole("reviewer")).toBe("reviewer");
  });
});
