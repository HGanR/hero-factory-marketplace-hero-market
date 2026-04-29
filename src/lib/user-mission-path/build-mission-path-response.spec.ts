import { buildUserMissionPathResponse } from "./build-mission-path-response";
import type { MissionPathPrerequisites } from "./mission-path-types";

const none: MissionPathPrerequisites = {
  hasEntity: false,
  hasWebsite: false,
  hasAgentOnSite: false,
  hasLaunchedCampaign: false,
  hasFirstRealLead: false,
};

describe("buildUserMissionPathResponse", () => {
  it("returns first continue step as entity when nothing is done", () => {
    const r = buildUserMissionPathResponse(none);
    expect(r.doneCount).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.continueStepId).toBe("entity");
    expect(r.continue?.stepId).toBe("entity");
    expect(r.continue?.href).toBe("/entity-maps");
    expect(r.allComplete).toBe(false);
  });

  it("continues to website when entity is done", () => {
    const r = buildUserMissionPathResponse({ ...none, hasEntity: true });
    expect(r.doneCount).toBe(1);
    expect(r.continueStepId).toBe("website");
    expect(r.continue?.href).toBe("/site-builder");
  });

  it("continues to agent with prerequisites through website", () => {
    const r = buildUserMissionPathResponse({
      ...none,
      hasEntity: true,
      hasWebsite: true,
    });
    expect(r.continueStepId).toBe("agent");
  });

  it("marks all complete and null continue cta", () => {
    const r = buildUserMissionPathResponse({
      hasEntity: true,
      hasWebsite: true,
      hasAgentOnSite: true,
      hasLaunchedCampaign: true,
      hasFirstRealLead: true,
    });
    expect(r.allComplete).toBe(true);
    expect(r.doneCount).toBe(5);
    expect(r.percent).toBe(100);
    expect(r.continueStepId).toBe("complete");
    expect(r.continue).toBeNull();
  });
});
