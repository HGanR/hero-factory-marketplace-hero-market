import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test, before, beforeEach, after } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";
import { SQL, eq } from "drizzle-orm";

// Intentionally ignores DATABASE_URL and every application credential. Only the
// disposable localhost CI service, fixed database/user and explicit opt-in work.
assert.equal(process.env.SKIPPER_MYSQL_TEST_ONLY, "1", "Disposable test service opt-in required.");
const password = process.env.SKIPPER_MYSQL_TEST_PASSWORD;
assert.ok(password, "Disposable service password required.");
const port = Number(process.env.SKIPPER_MYSQL_TEST_PORT ?? "3306");
assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
const pool = mysql.createPool({
  host: "127.0.0.1", port, user: "skipper_test", password,
  database: "skipper_step0_ci", connectionLimit: 6, timezone: "Z",
});
const root = process.cwd();
const dir = mkdtempSync(join(root, ".step0-mysql-"));
const output = join(dir, "boundary.mjs");
const real = new Set([
  "approve-executive-action", "approval-gated-execution", "executive-agent-approvals-store",
  "executive-agent-audit", "executive-action-executors", "executive-action-payloads",
  "executive-agent-policy",
].map(n => resolve(root, "src/lib/executive-agent", n + ".ts")));
const route = resolve(root, "src/app/api/admin/executive-agent/approvals/[id]/approve/route.ts");
const sources = [...real, route].map(p => readFileSync(p, "utf8")).join("\n");
await build({
  stdin: {
    contents: `export { POST } from ${JSON.stringify(route)};
      export { executeExecutiveApprovedAction } from ${JSON.stringify(resolve(root, "src/lib/executive-agent/executive-action-executors.ts"))};
      export { insertExecutiveApproval, claimPendingExecutiveApproval } from ${JSON.stringify(resolve(root, "src/lib/executive-agent/executive-agent-approvals-store.ts"))};
      export { executiveAgentApprovals, executiveAgentAuditLogs, clients, clientNotes } from "@/lib/db/schema";`,
    resolveDir: root, loader: "ts",
  },
  outfile: output, bundle: true, platform: "node", format: "esm", packages: "external",
  plugins: [{
    name: "auth-and-unrelated-engine-doubles-only",
    setup(b) {
      b.onResolve({ filter: /^(server-only$|next\/server$|@\/)/ }, args => {
        const path = args.path.startsWith("@/") ? resolve(root, "src", args.path.slice(2) + ".ts") : null;
        if (path && (real.has(path) || path.startsWith(resolve(root, "src/lib/db/schema")))) return { path };
        return { path: args.path, namespace: "double" };
      });
      b.onLoad({ filter: /.*/, namespace: "double" }, args => {
        if (args.path === "server-only") return { contents: "" };
        if (args.path === "next/server") return { contents: "export const NextResponse = Response;" };
        const names = new Set();
        for (const match of sources.matchAll(/(?:import|export)\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
          if (match[2] !== args.path) continue;
          for (const raw of match[1].split(",")) {
            const name = raw.trim().split(/\s+/)[0];
            if (name && name !== "type") names.add(name);
          }
        }
        return {
          contents: [...names].map(name =>
            `export const ${name} = (...args) => globalThis.__mysqlApprovalTest[${JSON.stringify(name)}](...args);`
          ).join("\n"), loader: "js",
        };
      });
    },
  }],
});
const mod = await import(pathToFileURL(output).href);
let lockAttempt;
const db = drizzle(pool, {
  logger: { logQuery(query) { if (/for update/i.test(query)) lockAttempt?.(); } },
});
globalThis.__mysqlApprovalTest = {
  getDb: async () => db,
  // Test request identity only. The production JWT helper is not exercised.
  getExecutiveAdminUserId: async req => req.headers.has("x-test-admin")
    ? Number(req.headers.get("x-test-admin")) : null,
};
const tables = [mod.executiveAgentApprovals, mod.executiveAgentAuditLogs, mod.clients, mod.clientNotes];
const dialect = new MySqlDialect();
const identifier = name => "`" + name.replaceAll("`", "``") + "`";
function defaultSql(value) {
  if (value instanceof SQL) return dialect.sqlToQuery(value).sql;
  if (typeof value === "string") return "'" + value.replaceAll("'", "''") + "'";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  throw Error("Unsupported schema default; do not approximate a production column.");
}
before(async () => {
  const [[info]] = await pool.query("SELECT DATABASE() AS db, VERSION() AS version");
  assert.equal(info.db, "skipper_step0_ci");
  assert.match(info.version, /^8\./, "This verification requires MySQL 8.");
  const [existing] = await pool.query("SHOW TABLES");
  assert.equal(existing.length, 0, "Disposable database must start empty.");
  // Actual checked-in Drizzle column definitions, including enum/default/type.
  // These isolated fixtures are not a production migration or schema-drift audit.
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map(c => [
      identifier(c.name), c.getSQLType(), c.notNull ? "NOT NULL" : "",
      c.default === undefined ? "" : "DEFAULT " + defaultSql(c.default),
      c.primary ? "PRIMARY KEY" : "",
    ].filter(Boolean).join(" "));
    await pool.query("CREATE TABLE " + identifier(config.name) + " (" + columns.join(", ") + ") ENGINE=InnoDB");
  }
  const first = await pool.getConnection(), second = await pool.getConnection();
  try {
    const [[a]] = await first.query("SELECT CONNECTION_ID() AS id");
    const [[b]] = await second.query("SELECT CONNECTION_ID() AS id");
    assert.notEqual(a.id, b.id, "Independent physical connections required.");
  } finally { first.release(); second.release(); }
  console.log("Disposable MySQL " + info.version + "; actual Drizzle schemas and separate connections verified.");
});
beforeEach(async () => {
  for (const table of tables) await pool.query("TRUNCATE TABLE " + identifier(getTableConfig(table).name));
});
after(async () => {
  lockAttempt = undefined;
  delete globalThis.__mysqlApprovalTest;
  await pool.end();
  rmSync(dir, { recursive: true, force: true });
});
const clientId = "00000000-0000-4000-8000-000000000001";
let id;
async function seed() {
  id = randomUUID();
  await db.insert(mod.clients).values({
    id: clientId, userId: 7, firstName: "Disposable", lastName: "Fixture",
    email: "fixture@example.invalid", addressLine1: "Test", city: "Test",
    state: "Test", postalCode: "00000",
  });
  await mod.insertExecutiveApproval(db, {
    id, adminUserId: 7, proposedAction: "createTodo", targetType: "client", targetId: clientId,
    payloadJson: JSON.stringify({ clientId, note: "Canonical disposable test note" }),
  });
}
const row = async () => (await db.select().from(mod.executiveAgentApprovals).where(eq(mod.executiveAgentApprovals.id, id)))[0];
const notes = () => db.select().from(mod.clientNotes);
const audits = () => db.select().from(mod.executiveAgentAuditLogs);
function post(body = { humanConfirmed: true }, admin = 7) {
  const req = new Request("https://local.test/approve", {
    method: "POST", headers: { "x-test-admin": String(admin), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return mod.POST(req, { params: Promise.resolve({ id }) });
}
async function approveFixture() {
  assert.equal(await mod.claimPendingExecutiveApproval(db, id, 7), true);
  return row();
}
async function rejectInserts(name, table, operation) {
  await pool.query("ALTER TABLE " + identifier(table) + " ADD CONSTRAINT " + identifier(name) + " CHECK (1 = 0)");
  try { await operation(); } finally {
    await pool.query("ALTER TABLE " + identifier(table) + " DROP CHECK " + identifier(name));
  }
}

test("real createTodo commits its client note, audit and executed state", async () => {
  await seed();
  const response = await post();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal((await row()).status, "executed");
  assert.ok((await row()).executedAt instanceof Date);
  assert.equal((await notes()).length, 1);
  assert.match((await notes())[0].note, /Canonical disposable test note/);
  assert.equal((await audits())[0].actionType, "approval_execute");
});
test("foreign admin leaves the real approval unchanged and records refusal", async () => {
  await seed(); const before = await row();
  assert.equal((await post({ humanConfirmed: true }, 8)).status, 403);
  assert.deepEqual(await row(), before);
  const log = await audits();
  assert.equal(log.length, 1); assert.equal(log[0].adminUserId, 8);
  assert.equal(log[0].actionType, "approval_refused");
  assert.doesNotMatch(JSON.stringify(log), /Canonical disposable test note/);
  assert.equal((await notes()).length, 0);
});
for (const body of [{}, { humanConfirmed: false }, { humanConfirmed: "true" }, { humanConfirmed: 1 }]) {
  test("SQL stays pending on invalid confirmation " + JSON.stringify(body), async () => {
    await seed(); const before = await row();
    assert.equal((await post(body)).status, 400);
    assert.deepEqual(await row(), before);
    assert.equal((await audits())[0].actionType, "approval_refused");
    assert.equal((await notes()).length, 0);
  });
}
test("two real concurrent requests claim pending only once", async () => {
  await seed();
  const responses = await Promise.all([post(), post()]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await notes()).length, 1);
  assert.equal((await row()).status, "executed");
});
test("concurrent dispatches serialize on the stored row and ignore forged payload", async () => {
  await seed(); const stored = await approveFixture();
  const forged = { ...stored, payloadJson: JSON.stringify({ clientId, note: "FORGED" }) };
  const result = await Promise.all([1, 2].map(() => mod.executeExecutiveApprovedAction(db, { adminUserId: 7, approval: forged })));
  assert.equal(result.filter(r => r.ok).length, 1);
  const saved = await notes();
  assert.equal(saved.length, 1);
  assert.match(saved[0].note, /Canonical disposable test note/);
  assert.doesNotMatch(saved[0].note, /FORGED/);
  assert.equal((await audits()).filter(a => a.actionType === "execution_refused").length, 1);
});
test("SELECT FOR UPDATE actually waits for another physical connection", { timeout: 15000 }, async () => {
  await seed(); const stored = await approveFixture();
  const blocker = await pool.getConnection();
  let pending;
  try {
    await blocker.beginTransaction();
    await blocker.query("SELECT id FROM executive_agent_approvals WHERE id = ? FOR UPDATE", [id]);
    let signaled;
    const attempted = new Promise(resolve => { signaled = resolve; });
    lockAttempt = signaled;
    let settled = false;
    pending = mod.executeExecutiveApprovedAction(db, { adminUserId: 7, approval: stored })
      .finally(() => { settled = true; });
    await Promise.race([attempted, delay(5000).then(() => { throw Error("Lock query was never issued"); })]);
    await delay(150);
    assert.equal(settled, false, "Dispatcher must wait while the other connection holds the row lock.");
    await blocker.commit();
    assert.equal((await pending).ok, true);
    assert.equal((await notes()).length, 1);
  } finally {
    lockAttempt = undefined;
    await blocker.rollback(); blocker.release();
    if (pending) await pending.catch(() => {});
  }
});
test("synthetic ids and forged approved status cannot write through MySQL", async () => {
  await seed(); const stored = await row();
  for (const fake of [{ ...stored, id: "legacy-inline", status: "approved" }, { ...stored, status: "approved" }]) {
    assert.equal((await mod.executeExecutiveApprovedAction(db, { adminUserId: 7, approval: fake })).ok, false);
  }
  assert.equal((await notes()).length, 0);
  assert.equal((await row()).status, "pending");
  assert.equal((await audits()).length, 2);
});
test("database rejection of a note produces a real failed approval and audit", async () => {
  await seed();
  await rejectInserts("reject_notes", "client_notes", async () => {
    assert.equal((await (await post()).json()).ok, false);
    assert.equal((await row()).status, "failed");
    assert.equal((await notes()).length, 0);
    assert.equal((await audits())[0].approvalStatus, "failed");
  });
});
test("real refusal-audit failure cannot approve or create a note", async () => {
  await seed(); const before = await row();
  await rejectInserts("reject_audit", "executive_agent_audit_logs", async () => {
    await assert.rejects(post({}));
    assert.deepEqual(await row(), before);
    assert.equal((await notes()).length, 0);
  });
});
test("execution-audit failure rolls back the note and retains the claimed approved state", async () => {
  await seed();
  await rejectInserts("reject_execution_audit", "executive_agent_audit_logs", async () => {
    await assert.rejects(post());
    assert.equal((await row()).status, "approved");
    assert.equal((await notes()).length, 0);
    assert.equal((await audits()).length, 0);
  });
});
