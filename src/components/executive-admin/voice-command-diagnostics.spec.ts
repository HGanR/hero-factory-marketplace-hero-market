import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  connectedSystemsFromRuntimePayload,
  deriveExecutiveVoiceState,
  firstSelectedReadToolFromInsights,
  orchestrationLevelDisplayFromPayload,
  runtimeTypeDisplayFromPayload,
} from "./voice-diagnostics-utils";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("voice-diagnostics-utils", () => {
  it("deriveExecutiveVoiceState prioritizes unsupported and mic error", () => {
    assert.equal(
      deriveExecutiveVoiceState({
        voiceUnsupported: true,
        micError: null,
        busyVoiceTurn: false,
        simSpeaking: false,
        voiceMode: true,
        liveListening: true,
        dictationBusy: false,
      }),
      "unsupported",
    );
    assert.equal(
      deriveExecutiveVoiceState({
        voiceUnsupported: false,
        micError: "denied",
        busyVoiceTurn: true,
        simSpeaking: false,
        voiceMode: true,
        liveListening: true,
        dictationBusy: false,
      }),
      "error",
    );
    assert.equal(
      deriveExecutiveVoiceState({
        voiceUnsupported: false,
        micError: null,
        busyVoiceTurn: true,
        simSpeaking: false,
        voiceMode: true,
        liveListening: true,
        dictationBusy: false,
      }),
      "processing",
    );
  });

  it("firstSelectedReadToolFromInsights picks first get* read tool title", () => {
    assert.equal(
      firstSelectedReadToolFromInsights([
        { title: "getPlatformAnalyticsSummary" },
        { title: "getInboxEngagementSummary" },
      ]),
      "getPlatformAnalyticsSummary",
    );
    assert.equal(firstSelectedReadToolFromInsights([{ title: "noise" }]), null);
  });

  it("runtime diagnostics payload maps runtime type executive_admin", () => {
    assert.equal(
      runtimeTypeDisplayFromPayload({
        skipperRuntimeType: "executive_admin",
      }),
      "executive_admin",
    );
    assert.equal(
      runtimeTypeDisplayFromPayload({
        skipperUnifiedRuntime: { orchestrationLevel: "full", diagnostics: {} },
      }),
      "executive_admin",
    );
  });

  it("orchestration level maps npc to npc-safe", () => {
    assert.equal(
      orchestrationLevelDisplayFromPayload({
        skipperUnifiedRuntime: { orchestrationLevel: "npc" },
      }),
      "npc-safe",
    );
  });

  it("connected systems badges omit secret-like strings", () => {
    const badges = connectedSystemsFromRuntimePayload({
      analyticsToolAvailable: true,
      memoryAvailable: true,
      approvalsAvailable: true,
      routinesAvailable: true,
      skipperVoiceId: "v1",
      skipperUnifiedRuntime: {
        diagnostics: {
          connectedDataSources: ["crm_clients", "bentley_campaign", "agent_conversation_summary"],
        },
      },
    });
    assert.ok(badges.includes("Analytics"));
    assert.ok(badges.includes("Voice"));
    assert.equal(badges.some((b) => /sk-|secret|apikey/i.test(b)), false);
  });
});

describe("Executive operations voice diagnostics placement (static)", () => {
  it("renders VoiceCommandDiagnosticsPanel in operations sidebar with STT test hooks", () => {
    const sidebar = readFileSync(join(__dirname, "ExecutiveOperationsSidebar.tsx"), "utf8");
    assert.ok(sidebar.includes("<VoiceCommandDiagnosticsPanel"));
    assert.ok(sidebar.includes("voicePendingAnalytics={voicePendingAnalytics}"));
    assert.ok(sidebar.includes("onTestSttHealth={onTestSttHealth}"));

    const dashboard = readFileSync(join(__dirname, "ExecutiveAgentDashboard.tsx"), "utf8");
    assert.ok(dashboard.includes("refreshExecutiveVoiceSttDiagnostics"));
    assert.ok(dashboard.includes("/api/admin/executive-agent/voice/preflight"));
  });
});

describe("VoiceCommandDiagnosticsPanel (static)", () => {
  it("panel title, STT rows, and copy action exist", () => {
    const p = join(__dirname, "VoiceCommandDiagnosticsPanel.tsx");
    const s = readFileSync(p, "utf8");
    assert.ok(s.includes("Voice diagnostics HUD"));
    assert.ok(s.includes("Copy diagnostics JSON"));
    assert.ok(s.includes("SECRET_KEY"));
    assert.ok(s.includes("Effective STT"));
    assert.ok(s.includes("Effective TTS"));
    assert.ok(s.includes("OpenAI STT"));
    assert.ok(s.includes("sttHttpStatus"));
    assert.ok(s.includes("Voice session context"));
    assert.ok(s.includes("voiceSttInputMode"));
    assert.ok(s.includes("Test STT health"));
    assert.ok(s.includes("Test STT clip"));
  });
});
