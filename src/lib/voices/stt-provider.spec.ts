import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveExecutiveSttProvider } from "@/lib/voices/stt-provider";

describe("resolveExecutiveSttProvider", () => {
  it("selects OpenAI when EXECUTIVE_VOICE_STT_PROVIDER=openai and key available", () => {
    assert.equal(
      resolveExecutiveSttProvider({
        inputMode: "auto",
        selfHostedSttReady: true,
        openaiTranscriptionAvailable: true,
        executiveVoiceSttProviderEnv: "openai",
        isFirefox: false,
      }),
      "openai",
    );
  });

  it("Firefox + OpenAI key chooses OpenAI in auto when browser SR unavailable", () => {
    assert.equal(
      resolveExecutiveSttProvider({
        inputMode: "auto",
        selfHostedSttReady: false,
        openaiTranscriptionAvailable: true,
        executiveVoiceSttProviderEnv: null,
        isFirefox: true,
      }),
      "openai",
    );
  });

  it("openai_stt mode requires transcription availability", () => {
    assert.equal(
      resolveExecutiveSttProvider({
        inputMode: "openai_stt",
        selfHostedSttReady: false,
        openaiTranscriptionAvailable: false,
        executiveVoiceSttProviderEnv: null,
        isFirefox: false,
      }),
      "none",
    );
    assert.equal(
      resolveExecutiveSttProvider({
        inputMode: "openai_stt",
        selfHostedSttReady: false,
        openaiTranscriptionAvailable: true,
        executiveVoiceSttProviderEnv: null,
        isFirefox: false,
      }),
      "openai",
    );
  });

  it("auto prefers self-hosted over browser when env is not openai-first", () => {
    assert.equal(
      resolveExecutiveSttProvider({
        inputMode: "auto",
        selfHostedSttReady: true,
        openaiTranscriptionAvailable: true,
        executiveVoiceSttProviderEnv: null,
        isFirefox: false,
      }),
      "self_hosted_stt",
    );
  });
});
