/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { buildBentleyPostImagePrompt, generateBentleyPostImage } from "@/lib/revenue-os/bentley-post-image";

describe("buildBentleyPostImagePrompt", () => {
  it("includes tone, image style, and caption concept", () => {
    const p = buildBentleyPostImagePrompt("Launch today\n\nSave time", "Witty", "neon noir");
    expect(p).toContain("Witty");
    expect(p).toContain("neon noir");
    expect(p).toContain("Launch today");
  });
});

describe("generateBentleyPostImage", () => {
  const origKey = process.env.OPENAI_API_KEY;
  const fetchMock = jest.fn();

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = origKey;
    jest.restoreAllMocks();
  });

  it("uses OpenAI URL when API returns ok", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: "https://cdn.openai.com/small.png" }] }),
    });

    const r = await generateBentleyPostImage("A hero product shot", { unitKey: "k1" });
    expect(r?.provider).toBe("dall-e-3");
    expect(r?.storageUrl).toContain("openai.com");
  });

  it("falls back to picsum when OpenAI is unavailable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "bad" } }),
    });

    const r = await generateBentleyPostImage("Coffee brand flat lay", { unitKey: "uk-9" });
    expect(r?.provider).toBe("picsum_placeholder");
    expect(r?.storageUrl).toMatch(/^https:\/\/picsum\.photos\/seed\//);
  });
});
