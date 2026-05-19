import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compressSkipperLearningSignals } from "@/lib/executive-agent/skipper-learning-compression";
import { formatActiveSkipperPromptOverlaysForPlanner } from "@/lib/executive-agent/skipper-learning-prompt-overlays";

describe("SKIPPER controlled learning loop", () => {
  it("compression yields suggestions, not direct base prompt mutation", () => {
    const out = compressSkipperLearningSignals({
      questionTurns: [
        {
          source: "chat",
          question: "Show analytics for today",
          answer: "Here is traffic.",
          plannerMetaJson: JSON.stringify({ readTools: ["getPlatformAnalyticsSummary"] }),
        },
        {
          source: "chat",
          question: "Show analytics for today",
          answer: "Traffic up.",
          plannerMetaJson: JSON.stringify({ readTools: ["getPlatformAnalyticsSummary"] }),
        },
      ],
      learningEvents: [{ eventType: "not_helpful", source: "chat", payloadJson: "{}" }],
    });
    assert.ok(Array.isArray(out.suggestedPromptImprovements));
    assert.ok(out.suggestedPromptImprovements.length > 0);
    assert.ok(!JSON.stringify(out).includes("EXECUTIVE_ADMIN_SYSTEM_PROMPT"));
  });

  it("active overlay formatter includes overlay body for planner stack", () => {
    const s = formatActiveSkipperPromptOverlaysForPlanner([{ title: "T", content: "Prefer analytics first." }]);
    assert.ok(s.includes("APPROVED PROMPT OVERLAYS"));
    assert.ok(s.includes("Prefer analytics first."));
  });

  it("rejected-only overlays would be excluded by caller (active list)", () => {
    const s = formatActiveSkipperPromptOverlaysForPlanner([]);
    assert.equal(s, "");
  });

  it("digest routine source does not invoke approval executors or read tools", () => {
    const p = join(__dirname, "skipper-learning-digest-routine.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
    assert.equal(src.includes("runReadTool"), false);
    assert.equal(src.includes("executive-action-executors"), false);
    assert.equal(src.includes("executive-agent-tools"), false);
  });

  it("capability suggestion API route does not import executors", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/learning/capabilities/[id]/route.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
    assert.equal(src.includes("executive-action-executors"), false);
  });

  it("orchestrator loads overlays only from store helper (active path)", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("listActiveSkipperPromptOverlaysForAdmin"));
    assert.ok(src.includes("formatActiveSkipperPromptOverlaysForPlanner"));
  });
});
