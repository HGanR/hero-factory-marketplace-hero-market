/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignReviewerAssignmentsPanel } from "./CampaignReviewerAssignmentsPanel";

describe("CampaignReviewerAssignmentsPanel", () => {
  it("renders nothing when cannot manage", () => {
    const h = renderToStaticMarkup(
      <CampaignReviewerAssignmentsPanel campaignId="c1" canManage={false} />
    );
    expect(h).toBe("");
  });

  it("renders nothing without campaign id", () => {
    const h = renderToStaticMarkup(
      <CampaignReviewerAssignmentsPanel campaignId={null} canManage={true} />
    );
    expect(h).toBe("");
  });

  it("renders shell when owner can manage (before client fetch)", () => {
    const h = renderToStaticMarkup(
      <CampaignReviewerAssignmentsPanel campaignId="camp-1" canManage={true} />
    );
    expect(h).toContain("campaign-reviewer-assignments-panel");
    expect(h).toContain("reviewer-add-section");
    expect(h.toLowerCase()).toContain("marketplace user id");
    expect(h).toContain("reviewers-empty");
    expect(h).toContain("Add reviewer");
  });

  it("renders plan gate message when reviewer assignments entitlement is off", () => {
    const h = renderToStaticMarkup(
      <CampaignReviewerAssignmentsPanel campaignId="camp-1" canManage={true} reviewerAssignmentsEnabled={false} />
    );
    expect(h).toContain('data-governance-gated="true"');
    expect(h).toContain("not available on the current plan");
    expect(h).not.toContain("reviewer-add-section");
  });
});
