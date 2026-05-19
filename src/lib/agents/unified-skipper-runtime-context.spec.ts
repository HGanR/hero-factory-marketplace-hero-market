import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildExecutiveIntentPlannerSystemPrompt } from "@/lib/agents/executive-admin-system-prompt";
import { buildNpcResponse, DEFAULT_PERSONALITY } from "@/lib/npc/engine";
import type { NPCProfile } from "@/lib/npc/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function src(rel: string) {
  return readFileSync(join(__dirname, rel), "utf8");
}

describe("resolveUnifiedAgentRuntimeContext wiring (static)", () => {
  it("AI Agency test chat uses the unified resolver", () => {
    const s = src("run-agent-test.ts");
    assert.ok(s.includes("resolveUnifiedAgentRuntimeContext"));
  });

  it("agent runtime diagnostics uses the unified resolver", () => {
    const s = src("agent-runtime-diagnostics.ts");
    assert.ok(s.includes("resolveUnifiedAgentRuntimeContext"));
  });

  it("admin executive SKIPPER diagnostics uses the unified resolver", () => {
    const s = src("../executive-agent/executive-skipper-runtime-diagnostics.ts");
    assert.ok(s.includes("resolveUnifiedAgentRuntimeContext"));
  });

  it("Troo World NPC chat uses unified SKIPPER cognitive resolver for executive_admin", () => {
    const s = src("../../app/api/troo-world/npc-chat/route.ts");
    assert.ok(s.includes("resolveUnifiedSkipperRuntimeContext"));
  });

  it("executive intent LLM system prompt is delegated to buildExecutiveIntentPlannerSystemPrompt", () => {
    const s = src("../executive-agent/executive-agent-llm.ts");
    assert.ok(s.includes("buildExecutiveIntentPlannerSystemPrompt"));
  });

  it("NPC LLM bridge supports unified persona base for authenticated NPC path", () => {
    const s = src("../npc/llm-bridge.ts");
    assert.ok(s.includes("buildExecutiveAdminNpcLlmPersonaSection"));
    assert.ok(s.includes("isSkipperExecutiveNpcProfile"));
    assert.ok(s.includes("unifiedPersonaBase"));
  });

  it("NPC engine imports shared executive rule fallbacks", () => {
    const s = src("../npc/engine.ts");
    assert.ok(s.includes("EXECUTIVE_ADMIN_NPC_RULE_FALLBACKS"));
    assert.ok(s.includes("isSkipperExecutiveNpcProfile"));
  });
});

describe("Executive admin conversational consistency", () => {
  it("intent planner system prompt contains executive workflow language", () => {
    const p = buildExecutiveIntentPlannerSystemPrompt().toLowerCase();
    assert.ok(p.includes("executive"));
    assert.ok(p.includes("analytics") || p.includes("crm"));
    assert.ok(p.includes("readtools") || p.includes("read tools"));
  });

  it("SKIPPER-named profile does not fall back to receptionist rule copy", () => {
    const profile: NPCProfile = {
      id: "custom-skipper-test",
      name: "SKIPPER",
      role: "secretary",
      avatarEmoji: "🤖",
      personality: DEFAULT_PERSONALITY,
      mood: "neutral",
    };
    const res = buildNpcResponse({
      message: "zzzzzz-no-knowledge-hit-zzzz",
      profile,
      knowledge: [],
    });
    assert.doesNotMatch(res.text, /virtual receptionist/i);
    assert.match(res.text, /executive|analytics|CRM|approval|orchestrat|operational|intelligence|briefing/i);
  });
});
