import type { DeploymentReadyPostDraft } from "@/lib/revenue-os/bentley-deployment-orchestrator";
import {
  BENTLEY_UTM_DRAFT_KEY,
  collectExistingBentleyDraftKeysFromPosts,
  selectDraftsMissingFromCampaign,
} from "@/lib/revenue-os/ensure-campaign-posts-from-bentley";

function draft(partial: Partial<DeploymentReadyPostDraft>): DeploymentReadyPostDraft {
  return {
    platform: "instagram",
    title: "t",
    body: "body text that is long enough for tests and deployment rules",
    status: "draft",
    source: "campaign_from_notes",
    draftKey: "k1",
    ...partial,
  };
}

describe("ensure-campaign-posts-from-bentley idempotency", () => {
  it("collectExistingBentleyDraftKeysFromPosts reads utmParams", () => {
    const keys = collectExistingBentleyDraftKeysFromPosts([
      { utmParams: { [BENTLEY_UTM_DRAFT_KEY]: "alpha" } },
      { utmParams: { other: "x" } },
    ]);
    expect(keys.has("alpha")).toBe(true);
    expect(keys.size).toBe(1);
  });

  it("selectDraftsMissingFromCampaign drops rows that already exist", () => {
    const drafts = [draft({ draftKey: "a" }), draft({ draftKey: "b", platform: "linkedin" })];
    const existing = new Set<string>(["a"]);
    const need = selectDraftsMissingFromCampaign(drafts, existing);
    expect(need.map((d) => d.draftKey)).toEqual(["b"]);
  });

  it("repeated selection with full key set yields no creates", () => {
    const drafts = [draft({ draftKey: "x" })];
    const k = collectExistingBentleyDraftKeysFromPosts([
      { utmParams: { [BENTLEY_UTM_DRAFT_KEY]: "x" } },
    ]);
    expect(selectDraftsMissingFromCampaign(drafts, k)).toHaveLength(0);
  });
});
