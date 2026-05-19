import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive voice transcribe route (source)", () => {
  it("routes OpenAI and self-hosted STT and does not call approval executor", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/transcribe/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("selfHostedSttTranscribe"));
    assert.ok(src.includes("openaiSttTranscribe"));
    assert.ok(src.includes("pickExecutiveVoiceTranscribeBackendWithHint"));
    assert.ok(src.includes("STT_NOT_CONFIGURED"));
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
    assert.equal(src.includes("runExecutiveOrchestrator"), false);
  });
});

describe("ExecutiveAgentDashboard STT path (source)", () => {
  it("uses resolveExecutiveSttProvider and self-hosted transcribe API", () => {
    const p = join(__dirname, "../../components/executive-admin/ExecutiveAgentDashboard.tsx");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("resolveExecutiveSttProvider"));
    assert.ok(src.includes("/api/admin/executive-agent/voice/transcribe"));
    assert.ok(src.includes("MediaRecorder"));
    assert.ok(src.includes("runSelfHostedSttClip"));
    assert.ok(src.includes("self-hosted-stt-health"));
    assert.ok(src.includes("/api/admin/executive-agent/voice/preflight"));
  });
});

describe("VoiceCommandDiagnosticsPanel STT fields (source)", () => {
  it("lists STT provider and HTTP status rows", () => {
    const p = join(__dirname, "../../components/executive-admin/VoiceCommandDiagnosticsPanel.tsx");
    const s = readFileSync(p, "utf8");
    assert.ok(s.includes("STT provider"));
    assert.ok(s.includes("sttProvider"));
    assert.ok(s.includes("STT HTTP status"));
  });
});

describe("voice/turn route (source)", () => {
  it("does not import transcribe route", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("voice/transcribe"), false);
  });
});
