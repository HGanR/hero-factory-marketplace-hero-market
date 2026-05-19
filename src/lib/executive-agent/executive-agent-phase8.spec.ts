import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { computeNextExecutiveRoutineRunAt } from "@/lib/executive-agent/executive-routine-schedule";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive phase 8 — cron auth", () => {
  it("cron routines route requires internal cron secret", () => {
    const p = join(__dirname, "../../app/api/cron/executive-agent/routines/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("isAuthorizedInternalCronRequest"));
    assert.ok(src.includes("Unauthorized"));
    assert.ok(/export async function POST\(req/.test(src));
    assert.ok(src.includes("isAuthorizedInternalCronRequest(req)"));
  });

  it("rejects cron when no secret header and env unset", () => {
    const prevA = process.env.SCHEDULED_PUBLISH_WORKER_SECRET;
    const prevB = process.env.CRON_SECRET;
    delete process.env.SCHEDULED_PUBLISH_WORKER_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const ok = isAuthorizedInternalCronRequest({
        headers: { get: () => null },
      });
      assert.equal(ok, false);
    } finally {
      if (prevA !== undefined) process.env.SCHEDULED_PUBLISH_WORKER_SECRET = prevA;
      else delete process.env.SCHEDULED_PUBLISH_WORKER_SECRET;
      if (prevB !== undefined) process.env.CRON_SECRET = prevB;
      else delete process.env.CRON_SECRET;
    }
  });
});

describe("executive phase 8 — routine runner safety", () => {
  it("routine runner does not import approval executors", () => {
    const p = join(__dirname, "executive-routine-runner.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
    assert.equal(src.includes("executive-action-executors"), false);
  });

  it("daily briefing branch persists briefing only (not approval queue)", () => {
    const p = join(__dirname, "executive-routine-runner.ts");
    const src = readFileSync(p, "utf8");
    const start = src.indexOf('case "daily_briefing"');
    const end = src.indexOf('case "stale_client_scan"', start);
    assert.ok(start >= 0 && end > start);
    const block = src.slice(start, end);
    assert.ok(block.includes("upsertExecutiveBriefingForAdminDate"));
    assert.equal(block.includes("insertExecutiveApproval"), false);
  });

  it("stale client scan queues createTodo approvals (not executors)", () => {
    const p = join(__dirname, "executive-routine-runner.ts");
    const src = readFileSync(p, "utf8");
    const start = src.indexOf('case "stale_client_scan"');
    const end = src.indexOf('case "pending_account_scan"', start);
    assert.ok(start >= 0 && end > start);
    const block = src.slice(start, end);
    assert.ok(block.includes("insertExecutiveApproval"));
    assert.equal(block.includes("upsertExecutiveBriefingForAdminDate"), false);
    assert.equal(block.includes("executeExecutiveApprovedAction"), false);
  });
});

describe("executive phase 8 — scheduling", () => {
  it("computes next run in the future for each cadence", () => {
    const base = new Date("2026-03-01T12:00:00Z");
    const h = computeNextExecutiveRoutineRunAt("hourly", base);
    const d = computeNextExecutiveRoutineRunAt("daily", base);
    const w = computeNextExecutiveRoutineRunAt("weekly", base);
    assert.ok(h.getTime() > base.getTime());
    assert.ok(d.getTime() > base.getTime());
    assert.ok(w.getTime() > base.getTime());
    assert.equal(h.getTime() - base.getTime(), 60 * 60 * 1000);
  });

  it("due routine query requires enabled and nextRunAt <= now (source)", () => {
    const p = join(__dirname, "executive-routine-store.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("listDueExecutiveRoutinesForCron"));
    assert.ok(src.includes("enabled"));
    assert.ok(src.includes("nextRunAt"));
  });

  it("disabled routines are excluded from due query (enabled = true)", () => {
    const p = join(__dirname, "executive-routine-store.ts");
    const src = readFileSync(p, "utf8");
    const start = src.indexOf("export async function listDueExecutiveRoutinesForCron");
    assert.ok(start >= 0);
    const slice = src.slice(start, start + 600);
    assert.ok(slice.includes("enabled"));
    assert.ok(slice.includes("true"));
  });

  it("cron runner loads due rows then runs each (source)", () => {
    const p = join(__dirname, "executive-routine-runner.ts");
    const src = readFileSync(p, "utf8");
    const start = src.indexOf("export async function runDueExecutiveRoutinesForCron");
    assert.ok(start >= 0);
    const slice = src.slice(start, start + 500);
    assert.ok(slice.includes("listDueExecutiveRoutinesForCron"));
    assert.ok(slice.includes("runExecutiveRoutineRow"));
    assert.ok(slice.includes('"cron"'));
  });

  it("cron-triggered run skips when routine row is disabled (defense in depth)", () => {
    const p = join(__dirname, "executive-routine-runner.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes('triggeredBy === "cron" && !row.enabled'));
    assert.ok(src.includes('"disabled"'));
  });
});
