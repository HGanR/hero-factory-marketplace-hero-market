import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildExecutiveAdminNpcLlmPersonaSection, buildExecutiveIntentPlannerSystemPrompt } from "@/lib/agents/executive-admin-system-prompt";

const __dirname = dirname(fileURLToPath(import.meta.url));

function src(rel: string) {
  return readFileSync(join(__dirname, rel), "utf8");
}

describe("Unified SKIPPER cognitive runtime (static + executive prompt stack)", () => {
  it("declares unified runtime version for diagnostics contract", () => {
    const s = src("skipper-unified-runtime.ts");
    const m = s.match(/export const UNIFIED_SKIPPER_RUNTIME_VERSION = "([^"]+)"/);
    assert.ok(m, "version export present");
    assert.match(m![1]!, /^\d{4}\./);
  });

  it("isSkipperExecutiveAgent delegates to resolveAgentRuntimeType for agent rows", () => {
    const s = src("skipper-unified-runtime.ts");
    assert.ok(s.includes("export function isSkipperExecutiveAgent"));
    assert.ok(s.includes("resolveAgentRuntimeType"));
    assert.ok(s.includes("isSkipperExecutiveNpcProfile"));
  });

  it("getUnifiedSkipperCapabilities gates approvalsQueue to full orchestration only", () => {
    const s = src("skipper-unified-runtime.ts");
    assert.ok(s.includes("approvalsQueue: full"));
  });

  it("buildUnifiedSkipperSystemPrompt appends widget safety only for widget level", () => {
    const s = src("skipper-unified-runtime.ts");
    assert.ok(s.includes("withWidgetPublicSafety"));
    assert.ok(s.includes("orchestrationLevel === \"widget\""));
    assert.ok(s.includes("WIDGET_SKIPPER_PUBLIC_SAFETY_ADDENDUM"));
  });

  it("What-do-you-do stack references executive workflows, analytics, CRM, and agent intelligence", () => {
    const planner = buildExecutiveIntentPlannerSystemPrompt().toLowerCase();
    assert.ok(planner.includes("analytics"));
    assert.ok(planner.includes("crm"));
    assert.ok(planner.includes("agent") || planner.includes("cross-agent"));
    const npcPersona = buildExecutiveAdminNpcLlmPersonaSection("SKIPPER").toLowerCase();
    assert.ok(npcPersona.includes("executive"));
    assert.ok(npcPersona.includes("analytics"));
    assert.ok(npcPersona.includes("crm"));
    assert.ok(npcPersona.includes("not a front-desk receptionist"));
    assert.ok(!npcPersona.includes("thank you for calling"));
  });

  it("SKIPPER entry points wire resolveUnifiedSkipperRuntimeContext or full orchestrator", () => {
    assert.ok(src("run-agent-test.ts").includes("resolveUnifiedSkipperRuntimeContext"));
    assert.ok(src("../../app/api/troo-world/npc-chat/route.ts").includes("resolveUnifiedSkipperRuntimeContext"));
    assert.ok(src("../../app/api/widget/[widgetKey]/message/route.ts").includes("resolveUnifiedSkipperRuntimeContext"));
    assert.ok(src("../executive-agent/executive-skipper-runtime-diagnostics.ts").includes("resolveUnifiedSkipperRuntimeContext"));
    assert.ok(src("agent-runtime-diagnostics.ts").includes("resolveUnifiedSkipperRuntimeContext"));
    const npcRoute = src("../../app/api/npc/chat/route.ts");
    assert.ok(npcRoute.includes("resolveUnifiedSkipperRuntimeContext"));
    assert.ok(npcRoute.includes("unifiedPersonaBase"));
    assert.ok(src("../../app/api/admin/executive-agent/chat/route.ts").includes("runExecutiveOrchestrator"));
    assert.ok(src("agent-runtime-diagnostics.ts").includes("skipperUnifiedRuntime"));
  });

  it("admin diagnostics skipperUnifiedRuntime omits full cognitive system prompt field", () => {
    const s = src("../executive-agent/executive-skipper-runtime-diagnostics.ts");
    assert.ok(s.includes("skipperUnifiedRuntime"));
    assert.ok(!s.includes("cognitive.systemPrompt"));
  });

  it("admin full orchestration path resolves voice via executive SKIPPER output profile", () => {
    const s = src("skipper-unified-runtime.ts");
    assert.ok(s.includes("getSkipperOutputVoiceForUser"));
  });

  it("skipper-unified-runtime source avoids embedding env secret identifiers in module body", () => {
    const s = src("skipper-unified-runtime.ts");
    assert.doesNotMatch(s, /OPENAI_API_KEY/);
    assert.doesNotMatch(s, /llmApiKeyEnc/);
  });
});
