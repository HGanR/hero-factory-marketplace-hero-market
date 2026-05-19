import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive-agent-orchestrator safety (source)", () => {
  it("orchestrator awaits formatExecutiveDeskContext before planning intent (read context path)", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    const deskIdx = src.indexOf("const deskContext = await formatExecutiveDeskContext");
    const planIdx = src.indexOf("await planExecutiveIntent({");
    assert.ok(deskIdx > 0 && planIdx > deskIdx);
  });

  it("write proposals call insertExecutiveApproval only when not dryRun", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("if (!input.dryRun)"));
    assert.ok(src.includes("await insertExecutiveApproval(db,"));
    assert.ok(src.includes("dryRunWriteDetected"));
  });

  it("runExecutiveOrchestrator body does not invoke executeExecutiveApprovedAction", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    const runBlockStart = src.indexOf("export async function runExecutiveOrchestrator");
    const runBlockEnd = src.indexOf("export async function executeApprovedTodoFromPayload");
    assert.ok(runBlockStart > 0 && runBlockEnd > runBlockStart);
    const runBody = src.slice(runBlockStart, runBlockEnd);
    assert.equal(runBody.includes("executeExecutiveApprovedAction"), false);
  });

  it("proposedApprovalsCount uses deterministic dryRun vs queued branch", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("input.dryRun ? proposedWrites.length : requiresApproval.length"));
  });
});
