/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignGovernanceOperatorHelp } from "./CampaignGovernanceOperatorHelp";

describe("CampaignGovernanceOperatorHelp", () => {
  it("renders contextual help sections", () => {
    const h = renderToStaticMarkup(<CampaignGovernanceOperatorHelp />);
    expect(h).toContain("campaign-governance-operator-help");
    expect(h).toContain("governance-help-reviewers");
    expect(h).toContain("governance-help-chains");
    expect(h).toContain("governance-help-reports");
    expect(h).toContain("governance-help-sla");
  });

  it("renders plan upgrade note when showPlanUpgradeNote", () => {
    const h = renderToStaticMarkup(<CampaignGovernanceOperatorHelp showPlanUpgradeNote />);
    expect(h).toContain("governance-help-plan-gate");
  });
});
