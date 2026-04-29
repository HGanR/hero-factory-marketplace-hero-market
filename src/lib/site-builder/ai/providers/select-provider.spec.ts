import { describe, expect, it, afterEach } from "@jest/globals";
import { selectSiteBuilderLlmInvoke } from "@/lib/site-builder/ai/providers/select-provider";

describe("selectSiteBuilderLlmInvoke", () => {
  const prevEndpoint = process.env.NPC_LLM_ENDPOINT;
  const prevOpenai = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.NPC_LLM_ENDPOINT = prevEndpoint;
    process.env.OPENAI_API_KEY = prevOpenai;
  });

  it("null settings + no env → deterministic", () => {
    delete process.env.NPC_LLM_ENDPOINT;
    const r = selectSiteBuilderLlmInvoke(null);
    expect(r.invoke).toBeNull();
    expect(r.source).toBe("deterministic");
  });

  it("null settings + env → managed", () => {
    process.env.NPC_LLM_ENDPOINT = "https://api.example.com/v1/chat/completions";
    const r = selectSiteBuilderLlmInvoke(null);
    expect(r.invoke).not.toBeNull();
    expect(r.source).toBe("managed");
  });

  it("null settings + OPENAI_API_KEY only (no NPC_LLM_ENDPOINT) → managed", () => {
    delete process.env.NPC_LLM_ENDPOINT;
    process.env.OPENAI_API_KEY = "sk-test-openai";
    const r = selectSiteBuilderLlmInvoke(null);
    expect(r.invoke).not.toBeNull();
    expect(r.source).toBe("managed");
  });

  it("off → deterministic with forceDeterministic", () => {
    process.env.NPC_LLM_ENDPOINT = "https://api.example.com/v1/chat/completions";
    const r = selectSiteBuilderLlmInvoke({
      llmMode: "off",
      endpoint: null,
      model: null,
      apiKeyEnc: null,
      fallbackToPlatform: false,
    });
    expect(r.invoke).toBeNull();
    expect(r.forceDeterministic).toBe(true);
  });

  it("byok misconfigured without fallback throws on invoke", async () => {
    delete process.env.NPC_LLM_ENDPOINT;
    const r = selectSiteBuilderLlmInvoke({
      llmMode: "byok",
      endpoint: "",
      model: "gpt-4o-mini",
      apiKeyEnc: "",
      fallbackToPlatform: false,
    });
    expect(r.source).toBe("byok");
    expect(r.invoke).not.toBeNull();
    await expect(r.invoke!([{ role: "user", content: "hi" }])).rejects.toThrow(/BYOK/);
  });

  it("byok misconfigured with fallback uses managed when env set", () => {
    process.env.NPC_LLM_ENDPOINT = "https://api.example.com/v1/chat/completions";
    const r = selectSiteBuilderLlmInvoke({
      llmMode: "byok",
      endpoint: "",
      model: null,
      apiKeyEnc: "",
      fallbackToPlatform: true,
    });
    expect(r.source).toBe("managed");
    expect(r.invoke).not.toBeNull();
  });
});
