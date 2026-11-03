import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import ts from "typescript";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { SQL } from "drizzle-orm";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";

assert.equal(process.env.SKIPPER_STEP2_SQL_TEST_ONLY, "1");
const engine = process.env.SKIPPER_STEP2_SQL_ENGINE;
assert.ok(["mysql", "tidb"].includes(engine));
// Intentionally accepts no host, URL, username or database configuration.
// Never reads application DATABASE_URL, JWT/admin credentials or provider keys.
const connectionOptions = { host: "127.0.0.1", port: 41306, user: "skipper_step2_test", password: "disposable-step2-only", database: "skipper_step2_ci", timezone: "Z", connectionLimit: 8 };
const pool = mysql.createPool(connectionOptions);
const root = process.cwd(), dir = mkdtempSync(join(root, ".step2-sql-"));
const stableId = key => createHash("sha256").update("skipper-revenue-v1:" + key).digest("hex").slice(0, 32);
const now = new Date("2026-11-03T12:00:00.000Z");
const initial = { forwardCursor: null, catchUpCursor: null, lastRunAt: null };
const cursor = (at, id = "") => Buffer.from(JSON.stringify({ c: at, i: id })).toString("base64url");
const stateId = admin => stableId(`state:${admin}`);
const receiptId = (admin, id) => stableId(`event:${admin}:${id}`);
const reviewId = (admin, kind, id) => stableId(`review:${admin}:${kind}:${id}`);

// Extract the original two exported read functions, without rewriting their bodies.
// This avoids loading unrelated provider/CRM engines from the broad tools module.
const toolsPath = resolve(root, "src/lib/executive-agent/executive-agent-tools.ts");
const source = ts.createSourceFile(toolsPath, readFileSync(toolsPath, "utf8"), ts.ScriptTarget.Latest, true);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && ["getPendingAccounts", "getApprovedAccounts"].includes(node.name?.text));
assert.equal(functions.length, 2);
await build({
  stdin: { contents: `export { runRevenueLoop } from './src/lib/executive-agent/revenue-loop.ts'; export * as schema from '@/lib/db/schema';`, resolveDir: root, loader: "ts" },
  outfile: join(dir, "loop.mjs"), bundle: true, platform: "node", format: "esm", packages: "external", treeShaking: true,
  plugins: [{ name: "real-loop-real-sql", setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "fixture" }));
    b.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true, sideEffects: false }));
    b.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: "getDb", namespace: "fixture" }));
    b.onResolve({ filter: /^\.\/executive-agent-tools$/ }, () => ({ path: "actual-read-functions", namespace: "fixture" }));
    b.onResolve({ filter: /^@\// }, a => ({ path: resolve(root, "src", a.path.slice(2) + ".ts") }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => {
      if (a.path === "server-only") return { contents: "" };
      if (a.path === "getDb") return { contents: "export const getDb = async () => globalThis.__step2SqlDb;" };
      return { contents: `import {and,count,eq,gte} from 'drizzle-orm';import {marketplaceUsers} from '@/lib/db/schema';\n` + functions.map(node => node.getText(source)).join("\n"), loader: "ts", resolveDir: root };
    });
  } }],
});
const mod = await import(pathToFileURL(join(dir, "loop.mjs")));
const db = drizzle(pool);
globalThis.__step2SqlDb = db;
const tables = ["marketplaceUsers", "entityOnboardings", "platformActivity", "executiveAgentMemoryItems", "executiveAgentApprovals", "executiveAgentAuditLogs"].map(name => mod.schema[name]);
assert.ok(tables.every(Boolean));
const quote = name => "`" + name.replaceAll("`", "``") + "`";
const dialect = new MySqlDialect();
const columnDdl = c => {
  let defaults = "";
  if (c.default !== undefined) defaults = "DEFAULT " + (c.default instanceof SQL ? dialect.sqlToQuery(c.default).sql : pool.escape(c.default));
  return [quote(c.name), c.getSQLType(), c.notNull ? "NOT NULL" : "", defaults, c.autoIncrement ? "AUTO_INCREMENT" : "", c.primary ? "PRIMARY KEY" : c.isUnique ? "UNIQUE" : "", c.hasOnUpdateNow ? "ON UPDATE CURRENT_TIMESTAMP" : ""].filter(Boolean).join(" ");
};
before(async () => {
  const [[info]] = await pool.query("SELECT DATABASE() AS db, VERSION() AS version, @@session.time_zone AS tz");
  assert.equal(info.db, "skipper_step2_ci"); assert.equal(info.tz, "+00:00");
  assert.equal(info.version.includes("TiDB"), engine === "tidb");
  const [existing] = await pool.query("SHOW TABLES"); assert.equal(existing.length, 0, "Must start empty");
  console.log("Real database: " + info.version + "; actual coordinator, gate-independent pending inserts, audit writer, telemetry query, extracted original read-tool bodies and actual Drizzle table definitions; no SQL transport double.");
});
beforeEach(async () => {
  globalThis.__step2SqlDb = db;
  for (const table of tables) {
    const config = getTableConfig(table);
    await pool.query("DROP TABLE IF EXISTS " + quote(config.name));
    await pool.query("CREATE TABLE " + quote(config.name) + " (" + config.columns.map(columnDdl).join(", ") + ") ENGINE=InnoDB");
  }
});
after(async () => { delete globalThis.__step2SqlDb; await pool.end(); rmSync(dir, { recursive: true, force: true }); });
async function seedAccount(id = 101, approved = false, active = false) {
  await db.insert(mod.schema.marketplaceUsers).values({ id, username: `fixture-${id}`, email: `fixture-${id}@example.invalid`, isApproved: approved, isActive: active });
}
async function seedEvent(id = "event-1", at = "2026-11-03T11:59:00.000Z", eventType = "new_account") {
  await db.insert(mod.schema.platformActivity).values({ id, userId: 101, eventType, sourceModule: "Marketplace", payload: { accountId: 101 }, createdAt: new Date(at) });
}
async function seedState(admin = 7, state = initial) {
  await db.insert(mod.schema.executiveAgentMemoryItems).values({ id: stateId(admin), adminUserId: admin, memoryType: "system_note", source: "system", subjectType: "revenue_loop_state", title: "Fixture checkpoint", summary: JSON.stringify(state), archivedAt: now });
}
async function rows(table) { const [result] = await pool.query("SELECT * FROM " + quote(table)); return result; }
async function checkpoint(admin = 7) { return (await rows("executive_agent_memory_items")).find(row => row.id === stateId(admin)); }
async function receipts() { return (await rows("executive_agent_memory_items")).filter(row => row.subjectType === "revenue_event_receipt"); }
async function snapshots() { return (await rows("executive_agent_memory_items")).filter(row => row.subjectType === "revenue_loop_briefing"); }

test("real run inserts pending reviews, receipts, checkpoint and honest snapshot without source writes", async () => {
  await seedAccount(); await seedAccount(102, true, true); await seedEvent();
  const before = await rows("marketplace_users");
  const result = await mod.runRevenueLoop(7, now);
  assert.equal(result.proposed, 1); assert.equal(result.newEvents, 1);
  assert.deepEqual(result.metrics, { source: "database", pendingAccounts: 1, approvedActiveAccounts: 1 });
  assert.equal(result.billing.verifiedCollectedRevenue, null);
  assert.equal(result.billing.membershipChargingVerified, false);
  const approvals = await rows("executive_agent_approvals");
  assert.equal(approvals.length, 1); assert.equal(approvals[0].status, "pending"); assert.equal(approvals[0].executedAt, null);
  assert.equal(approvals[0].proposedAction, "recordRevenueOpportunityReview");
  const payload = JSON.parse(approvals[0].payloadJson); assert.equal(payload.mode, "write_request"); assert.equal(payload.billingVerified, false);
  assert.equal((await receipts()).length, 1); assert.equal((await snapshots()).length, 1);
  assert.equal(JSON.parse((await checkpoint()).summary).lastRunAt, now.toISOString());
  assert.deepEqual(await rows("marketplace_users"), before);
  assert.deepEqual((await rows("executive_agent_audit_logs")).map(row => row.actionType).sort(), ["read", "write_request"]);
});

test("second same-day invocation skips without duplicate persistence", async () => {
  await seedAccount(); await seedEvent(); await mod.runRevenueLoop(7, now);
  const before = (await rows("executive_agent_memory_items")).map(({ updatedAt, ...row }) => row);
  const result = await mod.runRevenueLoop(7, now);
  assert.equal(result.skipped, true); assert.equal(result.reason, "daily_cadence");
  assert.equal((await rows("executive_agent_approvals")).length, 1);
  assert.equal((await rows("executive_agent_audit_logs")).length, 2);
  assert.deepEqual((await rows("executive_agent_memory_items")).map(({ updatedAt, ...row }) => row), before);
});

test("overlapping invocations serialize and propose once", async () => {
  await seedAccount(); await seedEvent(); await seedState();
  const results = await Promise.all([mod.runRevenueLoop(7, now), mod.runRevenueLoop(7, now)]);
  assert.equal(results.filter(r => r.skipped).length, 1);
  assert.equal(results.filter(r => !r.skipped && r.proposed === 1).length, 1);
  assert.equal((await rows("executive_agent_approvals")).length, 1);
  assert.equal((await receipts()).length, 1); assert.equal((await snapshots()).length, 1);
});

test("an independent physical connection's checkpoint lock blocks the actual loop", async () => {
  await seedState(); await seedAccount();
  const holder = await pool.getConnection();
  await holder.beginTransaction();
  const [[holderInfo]] = await holder.query("SELECT CONNECTION_ID() AS id");
  await holder.query("SELECT id FROM executive_agent_memory_items WHERE id=? FOR UPDATE", [stateId(7)]);
  let settled = false;
  const pending = mod.runRevenueLoop(7, now).finally(() => { settled = true; });
  pending.catch(() => {}); // Await below after releasing the independent lock, even on assertion failure.
  // This observes the real server's other connection waiting on the state upsert/lock.
  let waiting;
  try {
    const deadline = Date.now() + 8_000;
    while (!waiting && Date.now() < deadline) {
      const [processes] = await holder.query("SELECT ID AS connectionId, INFO AS sqlText FROM INFORMATION_SCHEMA.PROCESSLIST WHERE DB='skipper_step2_ci'");
      waiting = processes.find(row => Number(row.connectionId) !== Number(holderInfo.id) && /executive_agent_memory_items/i.test(row.sqlText || ""));
      if (!waiting) await delay(50);
    }
    assert.ok(waiting, "Server must show a different connection executing the blocked state query");
    assert.equal(settled, false);
  } finally { await holder.commit(); holder.release(); await pending.catch(() => {}); }
  const result = await pending; assert.equal(result.skipped, false); assert.equal(result.proposed, 1);
});

test("final audit failure rolls back pending approvals, receipts, snapshot and saved cursor", async () => {
  await seedState(); await seedAccount(); await seedEvent();
  // First proposal audit fits; final read_and_reconcile audit fails after saveState and snapshot.
  const length = "revenue_loop.propose".length;
  const audit = getTableConfig(mod.schema.executiveAgentAuditLogs);
  await pool.query("DROP TABLE executive_agent_audit_logs");
  await pool.query("CREATE TABLE executive_agent_audit_logs (" + audit.columns.map(c => c.name === "toolName" ? columnDdl(c).replace(c.getSQLType(), `varchar(${length})`) : columnDdl(c)).join(", ") + ") ENGINE=InnoDB");
  await assert.rejects(() => mod.runRevenueLoop(7, now));
  assert.equal((await rows("executive_agent_approvals")).length, 0);
  assert.equal((await receipts()).length, 0); assert.equal((await snapshots()).length, 0);
  assert.equal((await rows("executive_agent_audit_logs")).length, 0);
  assert.deepEqual(JSON.parse((await checkpoint()).summary), initial);
  // Repair only the disposable constraint; a retry must recover without duplicates.
  await pool.query("DROP TABLE executive_agent_audit_logs");
  await pool.query("CREATE TABLE executive_agent_audit_logs (" + audit.columns.map(columnDdl).join(", ") + ") ENGINE=InnoDB");
  const recovered = await mod.runRevenueLoop(7, now);
  assert.equal(recovered.proposed, 1); assert.equal(recovered.newEvents, 1);
});

test("fresh connection pool retains durable deduplication and does not reopen rejected reviews", async () => {
  await seedAccount(); await seedEvent(); await mod.runRevenueLoop(7, now);
  await pool.query("UPDATE executive_agent_approvals SET status='rejected'");
  const secondPool = mysql.createPool(connectionOptions);
  try {
    globalThis.__step2SqlDb = drizzle(secondPool);
    const result = await mod.runRevenueLoop(7, new Date(now.getTime() + 86_400_000));
    assert.equal(result.newEvents, 0); assert.equal(result.proposed, 0);
    assert.equal((await receipts()).length, 1);
    const approvals = await rows("executive_agent_approvals"); assert.equal(approvals.length, 1); assert.equal(approvals[0].status, "rejected");
  } finally { globalThis.__step2SqlDb = db; await secondPool.end(); }
});

test("independent catch-up finds an older event behind the forward cursor", async () => {
  await seedEvent("late-A", "2026-11-03T11:58:00.000Z"); await seedEvent("seen-B");
  const forward = cursor("2026-11-03T11:59:00.000Z", "seen-B");
  await seedState(7, { forwardCursor: forward, catchUpCursor: cursor("2026-11-03T11:57:00.000Z"), lastRunAt: null });
  await db.insert(mod.schema.executiveAgentMemoryItems).values({ id: receiptId(7, "seen-B"), adminUserId: 7, memoryType: "system_note", source: "system", subjectType: "revenue_event_receipt", subjectId: "seen-B", title: "Fixture receipt", summary: "Observed", archivedAt: now });
  const result = await mod.runRevenueLoop(7, now);
  assert.equal(result.newEvents, 1); assert.equal((await receipts()).length, 2);
  const state = JSON.parse((await checkpoint()).summary); assert.equal(state.forwardCursor, forward);
  assert.deepEqual(JSON.parse(Buffer.from(state.catchUpCursor, "base64url")), { c: "2026-11-03T11:59:30.000Z", i: "" });
});

test("real pagination drains a 250-event same-timestamp group and dedupes the catch-up replay", async () => {
  const events = Array.from({ length: 250 }, (_, n) => ({ id: `event-${String(n).padStart(5, "0")}`, userId: 101, eventType: "new_account", sourceModule: "Marketplace", payload: {}, createdAt: new Date("2026-11-03T11:59:00.000Z") }));
  await db.insert(mod.schema.platformActivity).values(events);
  const result = await mod.runRevenueLoop(7, now);
  assert.equal(result.newEvents, 250); assert.equal((await receipts()).length, 250);
  assert.deepEqual(JSON.parse(Buffer.from(JSON.parse((await checkpoint()).summary).forwardCursor, "base64url")), { c: "2026-11-03T11:59:00.000Z", i: "event-00249" });
});

test("source reconciliation finds current opportunities even when the feed is empty", async () => {
  await seedAccount();
  await db.insert(mod.schema.entityOnboardings).values({ id: 201, userId: 101, companyName: "Fixture Company", entityType: "llc", jurisdiction: "fixture", taxIdLast4: "0000", serviceTier: "fixture-unpriced", onboardingStatus: "submitted" });
  await db.insert(mod.schema.entityOnboardings).values({ id: 202, userId: 101, companyName: "Revoked", entityType: "llc", jurisdiction: "fixture", taxIdLast4: "0000", serviceTier: "fixture-unpriced", onboardingStatus: "submitted", isRevoked: true });
  const result = await mod.runRevenueLoop(7, now);
  assert.equal(result.newEvents, 0); assert.equal(result.proposed, 2);
  const approvals = await rows("executive_agent_approvals");
  assert.ok(approvals.some(r => r.id === reviewId(7, "completed_intake", "201")));
  assert.ok(!approvals.some(r => r.targetId === "202"));
  for (const approval of approvals) { const payload = JSON.parse(approval.payloadJson); assert.equal(payload.service, "membership"); assert.equal(payload.billingVerified, false); }
});

test("reconciliation above the 1000-row budget fails without committing cursor or partial reviews", async () => {
  const accounts = Array.from({ length: 1001 }, (_, n) => ({ id: n + 1, username: `fixture-${n}`, email: `fixture-${n}@example.invalid` }));
  await db.insert(mod.schema.marketplaceUsers).values(accounts); await seedState(); await seedEvent();
  await assert.rejects(() => mod.runRevenueLoop(7, now), /Reconciliation budget exceeded/);
  assert.deepEqual(JSON.parse((await checkpoint()).summary), initial);
  assert.equal((await rows("executive_agent_approvals")).length, 0); assert.equal((await receipts()).length, 0);
});

test("corrupt checkpoint fails closed without replacing it or proposing", async () => {
  await seedState(); await seedAccount();
  await pool.query("UPDATE executive_agent_memory_items SET summary='not-json' WHERE id=?", [stateId(7)]);
  await assert.rejects(() => mod.runRevenueLoop(7, now));
  assert.equal((await checkpoint()).summary, "not-json"); assert.equal((await rows("executive_agent_approvals")).length, 0);
});

test("one admin's terminal proposal and checkpoint do not suppress another admin's queue", async () => {
  await seedAccount(); await mod.runRevenueLoop(7, now);
  await pool.query("UPDATE executive_agent_approvals SET status='rejected' WHERE adminUserId=7");
  const result = await mod.runRevenueLoop(8, now);
  assert.equal(result.proposed, 1);
  const approvals = await rows("executive_agent_approvals");assert.equal(approvals.length, 2);
  assert.equal(approvals.find(r => r.adminUserId === 7).status, "rejected");assert.equal(approvals.find(r => r.adminUserId === 8).status, "pending");
  assert.ok(await checkpoint(7)); assert.ok(await checkpoint(8));
});

test("exact source-row budget completes as pending reviews without revenue collection", { timeout: 120_000 }, async () => {
  await db.insert(mod.schema.marketplaceUsers).values(Array.from({ length: 1000 }, (_, n) => ({ id: n + 1, username: `fixture-${n}`, email: `fixture-${n}@example.invalid` })));
  const start = performance.now(); const result = await mod.runRevenueLoop(7, now);
  console.log("1000-source-row loopback fixture duration ms: " + Math.round(performance.now() - start) + "; not a production latency/SLA measurement");
  assert.equal(result.proposed, 1000); assert.equal(result.billing.verifiedCollectedRevenue, null);
  const approvals = await rows("executive_agent_approvals"); assert.equal(approvals.length, 1000); assert.ok(approvals.every(r => r.status === "pending" && r.executedAt === null));
  assert.equal((await rows("executive_agent_audit_logs")).length, 1001);
});
