import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { defaultExecutiveReadScopes, type ExecutiveAgentScope } from "@/lib/executive-agent/executive-agent-policy";
import {
  buildDeterministicExecutiveIntentPlan,
  filterLlmProposedWrites,
  filterLlmReadToolsForPolicy,
  mergeExecutiveIntentPlans,
  parseExecutiveIntentPlanFromLlmContent,
} from "@/lib/executive-agent/executive-agent-intent-plan-pure";
import { redactSecretsFromExecutivePrompt } from "@/lib/executive-agent/executive-agent-prompt-redact";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fullGranted = new Set<ExecutiveAgentScope>(defaultExecutiveReadScopes());

describe("executive prompt redact", () => {
  it("redacts OpenAI-style sk- tokens from text sent toward LLM context", () => {
    const raw = "Use key sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 for API";
    const out = redactSecretsFromExecutivePrompt(raw);
    assert.match(out, /\[REDACTED_TOKEN\]/);
    assert.equal(out.includes("sk-proj-abc"), false);
  });

  it("redacts Bearer tokens", () => {
    const out = redactSecretsFromExecutivePrompt("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");
    assert.ok(out.includes("[REDACTED]"));
    assert.equal(out.includes("eyJhbGci"), false);
  });
});

describe("executive intent planner cannot bypass read policy", () => {
  it("drops Bentley read tools when read:bentley is not granted", () => {
    const crmOnly = new Set<ExecutiveAgentScope>(["read:crm"]);
    assert.deepEqual(
      filterLlmReadToolsForPolicy(["getBentleyCampaignOutputs", "getPendingAccounts", "nopeNotATool"], crmOnly),
      ["getPendingAccounts"],
    );
  });

  it("ignores invalid read tool names", () => {
    const r = filterLlmReadToolsForPolicy(["getPendingAccounts", "rm_-rf_slash", "getApprovedAccounts"], fullGranted);
    assert.ok(r.includes("getPendingAccounts"));
    assert.ok(r.includes("getApprovedAccounts"));
    assert.equal(r.some((x) => x === ("rm_-rf_slash" as typeof x)), false);
  });
});

describe("executive intent planner writes", () => {
  it("filters proposed writes to policy-known actions only", () => {
    const r = filterLlmProposedWrites([
      { action: "deleteEverything", payload: {} },
      { action: "createTodo", payload: { note: "x", clientId: "00000000-0000-4000-8000-000000000001" } },
    ]);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.action, "createTodo");
  });
});

describe("executive intent JSON parse", () => {
  it("rejects objects with chainOfThought (strict schema)", () => {
    const bad = JSON.stringify({
      readTools: [],
      proposedActions: [],
      answerStyle: "concise",
      confidence: 0.5,
      reasoningSummary: "ok",
      chainOfThought: "private",
    });
    assert.equal(parseExecutiveIntentPlanFromLlmContent(bad, fullGranted), null);
  });

  it("returns normalized plans without hidden reasoning fields", () => {
    const good = JSON.stringify({
      readTools: ["getPendingAccounts"],
      proposedActions: [],
      answerStyle: "concise",
      confidence: 0.6,
      reasoningSummary: "Check pending queue.",
    });
    const p = parseExecutiveIntentPlanFromLlmContent(good, fullGranted);
    assert.ok(p);
    const keys = Object.keys(p);
    assert.equal(keys.includes("chainOfThought"), false);
    assert.equal(keys.includes("privateReasoning"), false);
  });
});

describe("deterministic fallback semantics", () => {
  it("merge with null LLM plan preserves deterministic read set", () => {
    const det = buildDeterministicExecutiveIntentPlan({
      prompt: "pending accounts",
      requestedTool: null,
      dashboardMode: "OVERVIEW",
      selectedAgents: null,
      selectedClientId: null,
      granted: fullGranted,
    });
    const merged = mergeExecutiveIntentPlans(det, null);
    assert.deepEqual(merged.readTools, det.readTools);
    assert.deepEqual(merged.proposedActions, det.proposedActions);
  });
});

describe("orchestrator chat path", () => {
  it("queues writes only via insertExecutiveApproval, not executors", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    const runBlockStart = src.indexOf("export async function runExecutiveOrchestrator");
    const runBlockEnd = src.indexOf("export async function executeApprovedTodoFromPayload");
    assert.ok(runBlockStart > 0 && runBlockEnd > runBlockStart);
    const runBody = src.slice(runBlockStart, runBlockEnd);
    assert.ok(runBody.includes("insertExecutiveApproval"));
    assert.equal(runBody.includes("executeExecutiveApprovedAction"), false);
  });
});

describe("intent planner LLM user message", () => {
  it("redacts secrets before building the LLM user JSON (source)", () => {
    const p = join(__dirname, "executive-agent-intent-planner.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("redactSecretsFromExecutivePrompt(input.prompt)"));
    assert.ok(src.includes("buildExecutiveLlmUserMessage"));
  });
});

describe("missing LLM key path (source)", () => {
  it("returns deterministic reasoning when provider is not configured", () => {
    const p = join(__dirname, "executive-agent-intent-planner.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes('reasoningMode: "deterministic"'));
    assert.ok(src.includes("isExecutiveLlmProviderConfigured"));
  });
});

describe("LLM system prompt hardening", () => {
  it("states admin-only, approvals, and no-publish rules", () => {
    const llm = readFileSync(join(__dirname, "executive-agent-llm.ts"), "utf8");
    assert.ok(llm.includes("buildExecutiveIntentPlannerSystemPrompt"));
    const p = join(__dirname, "../agents/executive-admin-system-prompt.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(/admin-only|intent planner.*executive_admin/i.test(src));
    assert.ok(src.includes("approval"));
    assert.ok(/publish|schedul/i.test(src));
  });
});
