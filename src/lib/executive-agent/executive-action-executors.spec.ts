import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertSafeExecutiveCampaignSyncInput,
  AssignFollowUpPayloadSchema,
  CreateSiteBuilderTaskPayloadSchema,
  CreateSpecializedAgentPayloadSchema,
  CreateTodoPayloadSchema,
  TriggerBentleyAnalysisPayloadSchema,
  TriggerCampaignSyncPayloadSchema,
} from "@/lib/executive-agent/executive-action-payloads";
import { WRITE_ACTION_NAMES } from "@/lib/executive-agent/executive-agent-policy";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive-action-executors payloads", () => {
  it("rejects invalid createTodo payloads", () => {
    assert.equal(CreateTodoPayloadSchema.safeParse({ clientId: "not-uuid", note: "x" }).success, false);
    assert.equal(CreateTodoPayloadSchema.safeParse({ clientId: "00000000-0000-4000-8000-000000000001", note: "" }).success, false);
    assert.ok(
      CreateTodoPayloadSchema.safeParse({ clientId: "00000000-0000-4000-8000-000000000001", note: "hello" }).success,
    );
  });

  it("requires campaignId for analysis mode", () => {
    assert.equal(TriggerBentleyAnalysisPayloadSchema.safeParse({ mode: "analysis" }).success, false);
    assert.ok(
      TriggerBentleyAnalysisPayloadSchema.safeParse({
        mode: "analysis",
        campaignId: "00000000-0000-4000-8000-000000000002",
      }).success,
    );
  });

  it("requires industry and clientId for market_sweep", () => {
    assert.equal(
      TriggerBentleyAnalysisPayloadSchema.safeParse({
        mode: "market_sweep",
        industry: "Retail",
      }).success,
      false,
    );
    assert.ok(
      TriggerBentleyAnalysisPayloadSchema.safeParse({
        mode: "market_sweep",
        industry: "Retail",
        clientId: "00000000-0000-4000-8000-000000000003",
      }).success,
    );
  });

  it("validates triggerCampaignSync payload", () => {
    assert.equal(TriggerCampaignSyncPayloadSchema.safeParse({}).success, false);
    assert.ok(
      TriggerCampaignSyncPayloadSchema.safeParse({
        campaignId: "00000000-0000-4000-8000-000000000004",
        dryRun: true,
      }).success,
    );
  });

  it("validates assignFollowUp payload", () => {
    assert.equal(AssignFollowUpPayloadSchema.safeParse({ clientId: "x", title: "t" }).success, false);
    assert.ok(
      AssignFollowUpPayloadSchema.safeParse({
        clientId: "00000000-0000-4000-8000-000000000005",
        title: "Follow up",
        description: "Details",
        priority: "high",
      }).success,
    );
  });

  it("validates createSpecializedAgent payload", () => {
    assert.equal(CreateSpecializedAgentPayloadSchema.safeParse({ templateKey: "unknown" }).success, false);
    assert.ok(
      CreateSpecializedAgentPayloadSchema.safeParse({
        templateKey: "support",
        clientId: "00000000-0000-4000-8000-000000000006",
      }).success,
    );
  });

  it("validates createSiteBuilderTask payload", () => {
    assert.equal(
      CreateSiteBuilderTaskPayloadSchema.safeParse({
        clientId: "00000000-0000-4000-8000-000000000007",
        title: "T",
        instruction: "",
      }).success,
      false,
    );
    assert.ok(
      CreateSiteBuilderTaskPayloadSchema.safeParse({
        clientId: "00000000-0000-4000-8000-000000000007",
        title: "Home hero",
        instruction: "Replace headline",
        pageSlug: "/",
      }).success,
    );
  });
});

describe("executive campaign sync safety", () => {
  it("rejects scheduled post mode for executive path", () => {
    assert.throws(() =>
      assertSafeExecutiveCampaignSyncInput({
        userId: "1",
        campaignId: "00000000-0000-4000-8000-000000000001",
        scheduleStrategy: "immediate",
        postCreationMode: "scheduled",
      }),
    );
  });

  it("rejects content360 platform schedule flag", () => {
    assert.throws(() =>
      assertSafeExecutiveCampaignSyncInput({
        userId: "1",
        campaignId: "00000000-0000-4000-8000-000000000001",
        scheduleStrategy: "immediate",
        postCreationMode: "draft_unscheduled",
        content360PlatformSchedule: true,
      }),
    );
  });
});

describe("executor registry", () => {
  it("defines an executor for every write action name (source)", () => {
    const p = join(__dirname, "executive-action-executors.ts");
    const src = readFileSync(p, "utf8");
    const mapStart = src.indexOf("export const EXECUTIVE_ACTION_EXECUTORS");
    assert.ok(mapStart > 0);
    const mapSlice = src.slice(mapStart, mapStart + 4000);
    for (const name of WRITE_ACTION_NAMES) {
      assert.match(mapSlice, new RegExp(`\\b${name}\\s*:`), `missing executor key: ${name}`);
    }
  });
});

describe("triggerCampaignSync executor (source)", () => {
  it("uses draft_unscheduled and disables content360 platform schedule", () => {
    const p = join(__dirname, "executive-action-executors.ts");
    const src = readFileSync(p, "utf8");
    const fnStart = src.indexOf("async function runTriggerCampaignSync");
    const fnEnd = src.indexOf("async function runCreateSiteBuilderTask");
    assert.ok(fnStart > 0 && fnEnd > fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    assert.match(fnBody, /postCreationMode:\s*["']draft_unscheduled["']/);
    assert.match(fnBody, /content360PlatformSchedule:\s*false/);
    assert.match(fnBody, /assertSafeExecutiveCampaignSyncInput/);
  });
});

describe("createSpecializedAgent executor (source)", () => {
  it("maps missing table to not_configured without faking success", () => {
    const p = join(__dirname, "executive-action-executors.ts");
    const src = readFileSync(p, "utf8");
    const fnStart = src.indexOf("async function runCreateSpecializedAgent");
    const fnEnd = src.indexOf("async function runTriggerBentleyAnalysis");
    assert.ok(fnStart > 0 && fnEnd > fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    assert.match(fnBody, /status:\s*["']not_configured["']/);
    assert.match(fnBody, /Unknown table|doesn't exist|no such table/i);
  });
});

describe("executeExecutiveApprovedAction (source)", () => {
  it("fails unsupported actions before DB writes", () => {
    const p = join(__dirname, "executive-action-executors.ts");
    const src = readFileSync(p, "utf8");
    assert.match(src, /if\s*\(\s*!isWriteAction\(action\)\s*\)/);
    assert.match(src, /Unsupported or unknown action/);
  });
});

describe("triggerBentleyAnalysis does not import launch sync", () => {
  it("source file keeps Bentley analysis path free of syncBentleyCampaignPostsAndSchedule", () => {
    const p = join(__dirname, "executive-action-executors.ts");
    const src = readFileSync(p, "utf8");
    const fnStart = src.indexOf("async function runTriggerBentleyAnalysis");
    const fnEnd = src.indexOf("async function runTriggerCampaignSync");
    assert.ok(fnStart > 0 && fnEnd > fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    assert.equal(fnBody.includes("syncBentleyCampaignPostsAndSchedule"), false);
  });
});

describe("approval approve route", () => {
  it("delegates execution to executeExecutiveApprovedAction", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/approvals/[id]/approve/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("executeExecutiveApprovedAction"));
    assert.ok(!src.includes("executeApprovedTodoFromPayload"));
  });
});
