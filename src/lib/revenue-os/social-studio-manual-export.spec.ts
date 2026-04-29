import { buildSocialStudioManualExportPayload } from "@/lib/revenue-os/social-studio-manual-export";

describe("buildSocialStudioManualExportPayload", () => {
  it("includes template, mode narrative, and image flags", () => {
    const p = buildSocialStudioManualExportPayload({
      runId: "r1",
      campaignId: "c1",
      clientId: "cl",
      topic: "T",
      imageTemplate: "fb_square",
      imageAspect: "square",
      hostPublishReady: false,
      publishMode: { mode: "manual_export", lines: ["No OAuth"] },
      captions: { linkedin: { caption: "x", hashtags: "" } },
      storageUrl: "data:...",
      hasSvg: true,
    });
    expect(p.version).toBe(1);
    expect(p.imageTemplate).toBe("fb_square");
    expect(p.image.hasDataUrl).toBe(true);
    expect(p.postingInstructions.length).toBeGreaterThan(0);
  });
});
