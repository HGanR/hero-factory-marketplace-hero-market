/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignGovernanceStatusBlock } from "./CampaignGovernanceStatusBlock";

describe("CampaignGovernanceStatusBlock", () => {
  it("renders summary fields and warning codes", () => {
    const h = renderToStaticMarkup(
      <CampaignGovernanceStatusBlock
        summary={{
          approvalRequiredLabel: "On",
          chainLabel: "2-step chain",
          reportDeliveryLabel: "weekly · json · owner and admins",
          reviewerCountsLine: "Owner (implicit) · approver 1 · editor 0 · reviewer 0",
        }}
        warnings={[{ code: "CHAIN_STEP_NO_ASSIGNEE", message: "Test warning" }]}
      />
    );
    expect(h).toContain('data-testid="campaign-governance-status-block"');
    expect(h).toContain('data-testid="governance-summary-approval"');
    expect(h).toContain("On");
    expect(h).toContain('data-testid="governance-summary-chain"');
    expect(h).toContain("2-step chain");
    expect(h).toContain('data-testid="governance-warning-CHAIN_STEP_NO_ASSIGNEE"');
    expect(h).toContain("Test warning");
  });
});
