import { buildCreatePostBody, buildPatchPostCopyBody } from "./campaign-post-payload";

describe("first-campaign draft create vs update payloads", () => {
  it("buildCreatePostBody is for POST /campaigns/:id/posts (new server post)", () => {
    const body = buildCreatePostBody({
      platform: "linkedin",
      caption: "Hello world",
      hashtags: "#a #b",
    });
    expect(body).toEqual({
      platform: "linkedin",
      caption: "Hello world",
      hashtags: "#a #b",
    });
  });

  it("buildCreatePostBody omits empty hashtags", () => {
    const body = buildCreatePostBody({
      platform: "instagram",
      caption: "x",
      hashtags: "   ",
    });
    expect(body).toEqual({ platform: "instagram", caption: "x" });
    expect("hashtags" in body).toBe(false);
  });

  it("buildPatchPostCopyBody is for PATCH /campaigns/posts/:id (update existing draft)", () => {
    const body = buildPatchPostCopyBody({
      caption: "Updated",
      hashtags: "#x",
    });
    expect(body).toEqual({ caption: "Updated", hashtags: "#x" });
    expect("platform" in body).toBe(false);
  });

  it("PATCH body only includes provided keys (partial update)", () => {
    expect(buildPatchPostCopyBody({ caption: "only caption" })).toEqual({ caption: "only caption" });
  });
});
