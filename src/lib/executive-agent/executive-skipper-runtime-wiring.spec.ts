import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { resolveAgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import {
  applyAgentRuntimePromptLayers,
  buildAuthoritativeExecutiveAdminPromptStack,
  EXECUTIVE_ADMIN_SYSTEM_PROMPT,
} from "@/lib/agents/executive-admin-system-prompt";
import { ROLE_FALLBACKS } from "@/lib/npc/engine";
import { rankSkipperAgentsForExecutivePreference, type SkipperAgentCandidateRow } from "@/lib/voices/executive-skipper-output-voice";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("SKIPPER runtime identity", () => {
  it("resolves SKIPPER name to executive_admin when agentRuntimeType unset", () => {
    assert.equal(resolveAgentRuntimeType({ agentRuntimeType: null, name: "SKIPPER" }), "executive_admin");
  });

  it("executive_admin NPC fallbacks never use virtual receptionist copy", () => {
    const lines = ROLE_FALLBACKS.executive_admin.join("\n");
    assert.match(lines, /executive|orchestrat|analytics|CRM|approval/i);
    assert.doesNotMatch(lines, /virtual receptionist/i);
  });

  it("executive system prompt references workflows analytics CRM and agent intelligence", () => {
    const p = EXECUTIVE_ADMIN_SYSTEM_PROMPT.toLowerCase();
    assert.ok(p.includes("analytics"), "mentions analytics");
    assert.ok(p.includes("crm"), "mentions CRM");
    assert.ok(p.includes("agent intelligence") || p.includes("cross-agent"), "mentions agent intelligence / cross-agent");
    assert.ok(p.includes("executive administration") || p.includes("executive"), "mentions executive role");
    assert.ok(p.includes("virtual receptionist") && p.includes("must not"), "explicitly forbids receptionist persona");
  });

  it("authoritative executive prompt stack for What do you do? steers away from receptionist booking tropes", () => {
    const { systemPrompt } = buildAuthoritativeExecutiveAdminPromptStack({
      ownerInstructions: "Be concise.",
      knowledgeContextSuffix: "",
      kbEntryCount: 0,
    });
    const lower = systemPrompt.toLowerCase();
    assert.ok(
      lower.includes("analytics") &&
        lower.includes("crm") &&
        (lower.includes("bentley") || lower.includes("campaign")),
      "executive workflow vocabulary",
    );
    assert.ok(lower.includes("cross-agent") || lower.includes("agent intelligence"), "cross-agent intelligence");
    assert.doesNotMatch(systemPrompt, /I am your virtual receptionist/i);
    assert.doesNotMatch(systemPrompt, /leave a callback request/i);
    assert.doesNotMatch(systemPrompt, /book a consultation/i);
  });

  it("applyAgentRuntimePromptLayers puts executive core before owner instructions for executive_admin", () => {
    const out = applyAgentRuntimePromptLayers({
      runtimeType: "executive_admin",
      baseSystemPrompt: "OWNER_ONLY_MARKER",
      kbEntryCount: 0,
      knowledgeContextSuffix: "",
    });
    const ie = out.indexOf("Executive Administration");
    const io = out.indexOf("OWNER_ONLY_MARKER");
    assert.ok(ie >= 0 && io >= 0 && ie < io, "executive stack should precede owner/deployment block");
  });

  it("prefers executive_admin SKIPPER row over general when ranking candidates", () => {
    const t = Date.now();
    const rows: SkipperAgentCandidateRow[] = [
      {
        id: "general-skipper",
        name: "SKIPPER Clone",
        agentRuntimeType: "general",
        voiceId: "v1",
        voiceProvider: "self_hosted_tts",
        toolsJson: "{}",
        updatedAt: new Date(t + 60_000),
      },
      {
        id: "exec-skipper",
        name: "SKIPPER",
        agentRuntimeType: "executive_admin",
        voiceId: "v2",
        voiceProvider: "self_hosted_tts",
        toolsJson: "{}",
        updatedAt: new Date(t),
      },
    ];
    const ranked = rankSkipperAgentsForExecutivePreference(rows);
    assert.equal(ranked[0].id, "exec-skipper");
  });
});

describe("SKIPPER self-hosted voice wiring (source)", () => {
  it("output profile route resolves voice via getSkipperOutputVoiceForUser", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/output-profile/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("getSkipperOutputVoiceForUser"));
    assert.ok(src.includes("getPreferredSkipperAgentRowForUser"));
    assert.ok(src.includes("preferredSkipperRuntimeType"));
    assert.ok(src.includes("source:"));
  });

  it("speak route delegates TTS to synthesizePreviewAudio (self_hosted, elevenlabs, openai enum)", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/speak/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("synthesizePreviewAudio"));
    assert.ok(src.includes("VOICE_PROVIDER_SELF_HOSTED_TTS"));
    assert.ok(src.includes("VOICE_PROVIDER_OPENAI"));
    const idxSelf = src.indexOf("VOICE_PROVIDER_SELF_HOSTED_TTS");
    const idxSyn = src.indexOf("synthesizePreviewAudio");
    assert.ok(idxSyn > idxSelf || src.indexOf("synthesizePreviewAudio") > 0);
    assert.equal(src.includes("api.elevenlabs.io"), false, "speak route must not call ElevenLabs inline");
    assert.equal(src.includes("@/lib/voices/elevenlabs"), false);
  });

  it("synthesizePreviewAudio uses self-hosted client before ElevenLabs HTTP path", async () => {
    const p = join(__dirname, "../voices/voice-provider.ts");
    const src = readFileSync(p, "utf8");
    const selfBlock = src.indexOf("input.provider === VOICE_PROVIDER_SELF_HOSTED_TTS");
    const elevenBlock = src.indexOf("api.elevenlabs.io");
    assert.ok(selfBlock >= 0);
    assert.ok(elevenBlock >= 0);
    assert.ok(selfBlock < elevenBlock, "self-hosted branch must precede ElevenLabs fetch");
  });

  it("Executive dashboard falls back to browser speech when self_hosted health is not ready", () => {
    const p = join(__dirname, "../../components/executive-admin/ExecutiveAgentDashboard.tsx");
    const src = readFileSync(p, "utf8");
    assert.ok(
      src.includes("self_hosted_tts") &&
        src.includes("executiveSelfHostedVoiceReady") &&
        src.includes("SpeechSynthesisUtterance")
    );
    assert.ok(
      src.includes("Self-hosted voice engine unavailable") && src.includes("browser voice"),
      "visible fallback banner copy",
    );
  });

  it("voice turn route uses orchestrator with source voice and does not execute approvals inline", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("runExecutiveOrchestrator"));
    assert.ok(src.includes('source: "voice"'));
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
  });
});

describe("Executive SKIPPER runtime diagnostics module", () => {
  it("does not embed API key env names in returned field names", () => {
    const p = join(__dirname, "executive-skipper-runtime-diagnostics.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("ELEVENLABS_API_KEY"), false);
    assert.equal(src.includes("SELF_HOSTED_TTS_API_KEY"), false);
    assert.equal(src.includes("xi-api-key"), false);
  });

  it("exposes capability notes, approvals/routines flags, and fieldSources for admin UI", () => {
    const p = join(__dirname, "executive-skipper-runtime-diagnostics.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("capabilityNotes"));
    assert.ok(src.includes("approvalsAvailable"));
    assert.ok(src.includes("routinesAvailable"));
    assert.ok(src.includes("ExecutiveSkipperFieldSources"));
    assert.ok(src.includes("promptOverlaysStatus"));
    assert.ok(src.includes("probeSkipperPromptOverlaysTableStatus"));
  });
});
