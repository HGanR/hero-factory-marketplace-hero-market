import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { resolveExecutiveVoiceProvider } from "@/lib/executive-agent/executive-voice-provider";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive voice provider fallback", () => {
  it("falls back from openai_realtime to browser_stt when realtime URL is not configured", () => {
    const prev = process.env.EXECUTIVE_VOICE_OPENAI_REALTIME_URL;
    delete process.env.EXECUTIVE_VOICE_OPENAI_REALTIME_URL;
    try {
      assert.equal(resolveExecutiveVoiceProvider("openai_realtime"), "browser_stt");
    } finally {
      if (prev !== undefined) process.env.EXECUTIVE_VOICE_OPENAI_REALTIME_URL = prev;
      else delete process.env.EXECUTIVE_VOICE_OPENAI_REALTIME_URL;
    }
  });
});

describe("voice SQL migration (no raw audio)", () => {
  it("creates only text/json columns for sessions and turns", () => {
    const p = join(__dirname, "../../../drizzle/0123_executive_agent_voice.sql");
    const sql = readFileSync(p, "utf8");
    const sqlNoComments = sql.replace(/--[^\n]*/g, "\n");
    assert.equal(/\b(BLOB|MEDIUMBLOB|LONGBLOB)\b/i.test(sqlNoComments), false);
    assert.ok(sql.includes("executive_agent_voice_sessions"));
    assert.ok(sql.includes("executive_agent_voice_turns"));
    assert.ok(sql.includes("transcriptText"));
    assert.ok(sql.includes("plannerMetaJson"));
    assert.ok(sql.includes("proposedApprovalsCount"));
  });
});

describe("voice turn API route", () => {
  it("persists transcript via insertExecutiveVoiceTurn and runs orchestrator with voice source", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("insertExecutiveVoiceTurn"));
    assert.ok(src.includes('source: "voice"'));
    assert.ok(src.includes("runExecutiveOrchestrator"));
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
  });
});

describe("voice turn metadata", () => {
  it("stores plannerMeta and proposedApprovalsCount on each turn (source)", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("plannerMeta"));
    assert.ok(src.includes("proposedApprovalsCount"));
  });
});

describe("voice store insert shape", () => {
  it("writes transcript and JSON metadata columns only (no audio columns)", () => {
    const p = join(__dirname, "executive-agent-voice-store.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("transcriptText"));
    assert.ok(src.includes("plannerMetaJson"));
    assert.ok(src.includes("proposedApprovalsCount"));
    assert.equal(/\b(audioUrl|audioBlob|pcm|waveform)\b/i.test(src), false);
  });
});
