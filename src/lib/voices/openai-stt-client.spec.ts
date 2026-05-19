import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("openai-stt-client (source)", () => {
  it("uses OpenAI transcriptions endpoint and never embeds API key literals", () => {
    const p = join(__dirname, "openai-stt-client.ts");
    const s = readFileSync(p, "utf8");
    assert.ok(s.includes("api.openai.com/v1/audio/transcriptions"));
    assert.ok(s.includes("OPENAI_API_KEY"));
    assert.ok(s.includes("gpt-4o-mini-transcribe"));
    assert.ok(s.includes("OPENAI_STT_MODEL"));
    assert.equal(/sk-[a-zA-Z0-9]{10,}/.test(s), false);
  });
});
