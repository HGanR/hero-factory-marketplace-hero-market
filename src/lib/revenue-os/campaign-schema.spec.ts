import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCampaignResponse } from "@/lib/revenue-os/campaign-schema";

describe("parseCampaignResponse", () => {
  it("coerces numeric platform post slots without throwing on trim", () => {
    const out = parseCampaignResponse({
      industry: "SaaS",
      targetAudience: "Founders",
      offerStatement: "CRM",
      messagePillars: ["a", "b", "c"],
      shortFormHooks: Array(10).fill("hook"),
      longFormOutlines: [
        { title: "T1", sections: ["s"], cta: "Go" },
        { title: "T2", sections: ["s"], cta: "Go" },
        { title: "T3", sections: ["s"], cta: "Go" },
      ],
      objectionReplies: Array(5).fill("obj"),
      platformPosts: {
        instagram: {
          caption: 42 as unknown as string,
          hook: 99 as unknown as string,
          cta: 1 as unknown as string,
        },
      },
    });
    assert.equal(out.platformPosts.instagram.caption, "42");
    assert.equal(out.platformPosts.instagram.hook, "99");
    assert.equal(out.platformPosts.instagram.cta, "1");
  });
});

describe("slimWorkflowArtifacts campaign", () => {
  it("always normalizes platformPosts via parseCampaignResponse", async () => {
    const { slimWorkflowArtifacts } = await import("@/lib/revenue-os/bentley-workflow-artifacts-slim");
    const out = slimWorkflowArtifacts({
      campaign: {
        industry: "SaaS",
        targetAudience: "Founders",
        offerStatement: "CRM",
        messagePillars: ["a", "b", "c"],
        shortFormHooks: Array(10).fill("hook"),
        longFormOutlines: [
          { title: "T1", sections: ["s"], cta: "Go" },
          { title: "T2", sections: ["s"], cta: "Go" },
          { title: "T3", sections: ["s"], cta: "Go" },
        ],
        objectionReplies: Array(5).fill("obj"),
        platformPosts: {
          instagram: { caption: 42 as unknown as string, hook: "h", cta: "c" },
        },
      } as import("@/lib/revenue-os/campaign-schema").CampaignResponse,
    });
    assert.equal(out.campaign?.platformPosts?.instagram?.caption, "42");
  });
});
