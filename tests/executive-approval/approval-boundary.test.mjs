import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test, after } from "node:test";
import { build } from "esbuild";

// Run the actual route, gate, SQL-store functions, audit writer, shared dispatcher
// and createTodo executor. Only auth, SQL transport/schema and unrelated engines
// are doubled. This never connects to a live database or provider.
const root = process.cwd();
const real = new Set([
  "approve-executive-action", "approval-gated-execution", "executive-agent-approvals-store",
  "executive-agent-audit", "executive-action-executors", "executive-action-payloads",
  "executive-agent-policy",
].map(n => resolve(root, "src/lib/executive-agent", n + ".ts")));
const route = resolve(root, "src/app/api/admin/executive-agent/approvals/[id]/approve/route.ts");
const sources = [...real, route].map(p => readFileSync(p, "utf8")).join("\n");
const dir = mkdtempSync(join(root, ".step0-boundary-"));
after(() => { rmSync(dir, { recursive: true, force: true }); delete globalThis.__approvalTest; });
const output = join(dir, "boundary.mjs");
await build({
  stdin: {
    contents: `export { POST } from ${JSON.stringify(route)};
      export { executeExecutiveApprovedAction } from ${JSON.stringify(resolve(root, "src/lib/executive-agent/executive-action-executors.ts"))};`,
    resolveDir: root, loader: "ts",
  },
  outfile: output, bundle: true, platform: "node", format: "esm",
  packages: "external",
  plugins: [{
    name: "isolated-boundary-dependencies",
    setup(b) {
      b.onResolve({ filter: /^(server-only$|next\/server$|drizzle-orm$|@\/)/ }, args => {
        const path = args.path.startsWith("@/") ? resolve(root, "src", args.path.slice(2) + ".ts") : null;
        if (path && real.has(path)) return { path };
        return { path: args.path, namespace: "double" };
      });
      b.onLoad({ filter: /.*/, namespace: "double" }, args => {
        if (args.path === "server-only") return { contents: "" };
        if (args.path === "next/server") return { contents: "export const NextResponse = Response;" };
        if (args.path === "@/lib/db/schema") return {
          contents: ["executiveAgentApprovals", "executiveAgentAuditLogs", "aiAgents", "campaigns", "clients", "clientNotes"]
            .map(n => `export const ${n} = ${JSON.stringify({ tableName: n, id: "id", adminUserId: "adminUserId", status: "status", userId: "userId", createdAt: "createdAt" })};`).join("\n"),
        };
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
            `export const ${name} = (...args) => globalThis.__approvalTest.deps[${JSON.stringify(name)}](...args);`
          ).join("\n"),
          loader: "js",
        };
      });
    },
  }],
});
const mod = await import(pathToFileURL(output).href);
const clientId = "00000000-0000-4000-8000-000000000001";
const approval = (status = "pending") => ({
  id: "persisted-approval", adminUserId: 7, proposedAction: "createTodo",
  targetType: "client", targetId: clientId,
  payloadJson: JSON.stringify({ clientId, note: "canonical reviewed note" }),
  status, createdAt: new Date(), executedAt: null,
});

function fixture(row = approval()) {
  const rows = {
    executiveAgentApprovals: row ? [structuredClone(row)] : [],
    clients: [{ id: clientId, userId: 7 }], clientNotes: [], executiveAgentAuditLogs: [],
  };
  const state = { rows, admin: 7, auditFails: false, noteFails: false, history: [], locks: 0 };
  let queue = Promise.resolve();
  const matches = (r, predicate) => !predicate || (
    predicate.all ? predicate.all.every(p => matches(r, p)) : r[predicate.key] === predicate.value
  );
  const tableName = token => token.tableName;
  const db = {
    select() {
      let table, predicate;
      const query = {
        from(t) { table = tableName(t); return query; },
        where(p) { predicate = p; return query; },
        limit() { return query; },
        for(mode) { assert.equal(mode, "update"); state.locks++; return query; },
        then(ok, fail) { return Promise.resolve(rows[table].filter(r => matches(r, predicate)).map(r => ({ ...r }))).then(ok, fail); },
      };
      return query;
    },
    update(token) {
      const table = tableName(token);
      return { set(values) { return { async where(predicate) {
        const selected = rows[table].filter(r => matches(r, predicate));
        for (const r of selected) { Object.assign(r, values); state.history.push(r.status); }
        return [{ affectedRows: selected.length }];
      } }; } };
    },
    insert(token) {
      const table = tableName(token);
      return { async values(value) {
        if (table === "executiveAgentAuditLogs" && state.auditFails) throw Error("audit unavailable");
        if (table === "clientNotes" && state.noteFails) throw Error("note write failed");
        rows[table].push(structuredClone(value));
      } };
    },
    async transaction(fn) {
      const previous = queue;
      let release;
      queue = new Promise(r => { release = r; });
      await previous;
      try { return await fn(db); } finally { release(); }
    },
  };
  state.db = db;
  state.deps = {
    getExecutiveAdminUserId: async () => state.admin, getDb: async () => db,
    eq: (key, value) => ({ key, value }), and: (...all) => ({ all }),
    NextResponse: Response,
  };
  globalThis.__approvalTest = state;
  return state;
}

function request(value = { humanConfirmed: true }) {
  return new Request("https://local.test/approve", { method: "POST", body: JSON.stringify(value) });
}
const post = req => mod.POST(req, { params: Promise.resolve({ id: "persisted-approval" }) });

test("owning admin plus explicit true executes persisted createTodo and terminal status", async () => {
  const f = fixture();
  const response = await post(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.deepEqual(f.history, ["approved", "executed"]);
  assert.equal(f.rows.clientNotes.length, 1);
  assert.match(f.rows.clientNotes[0].note, /canonical reviewed note/);
  assert.equal(f.locks, 1);
});

for (const [name, body] of [
  ["missing", {}], ["false", { humanConfirmed: false }],
  ["string", { humanConfirmed: "true" }], ["number", { humanConfirmed: 1 }],
  ["object", { humanConfirmed: {} }], ["array", [true]], ["null", null],
]) test("refuses " + name + " confirmation before mutation and audits", async () => {
  const f = fixture();
  const before = structuredClone(f.rows.executiveAgentApprovals);
  const response = await post(request(body));
  assert.equal(response.status, 400);
  assert.deepEqual(f.rows.executiveAgentApprovals, before);
  assert.equal(f.rows.clientNotes.length, 0);
  assert.deepEqual(f.history, []);
  assert.equal(f.rows.executiveAgentAuditLogs[0].actionType, "approval_refused");
});

test("malformed JSON is refused and audited", async () => {
  const f = fixture();
  assert.equal((await post(new Request("https://local.test", { method: "POST", body: "{" }))).status, 400);
  assert.equal(f.rows.executiveAgentAuditLogs.length, 1);
  assert.deepEqual(f.history, []);
});

test("foreign admin is refused with no foreign payload in response or audit", async () => {
  const f = fixture(); f.admin = 8;
  const response = await post(request());
  assert.equal(response.status, 403);
  assert.doesNotMatch(JSON.stringify(await response.json()) + JSON.stringify(f.rows.executiveAgentAuditLogs), /canonical reviewed note/);
  assert.equal(f.rows.executiveAgentAuditLogs[0].adminUserId, 8);
  assert.deepEqual(f.history, []);
});

for (const status of ["approved", "executed", "failed", "rejected"]) {
  test("refuses non-pending " + status + " without changing it", async () => {
    const f = fixture(approval(status));
    assert.equal((await post(request())).status, 409);
    assert.equal(f.rows.executiveAgentApprovals[0].status, status);
    assert.equal(f.rows.executiveAgentAuditLogs.length, 1);
    assert.deepEqual(f.history, []);
  });
}

test("unauthenticated requests stop before persistence", async () => {
  const f = fixture(); f.admin = null;
  assert.equal((await post(request())).status, 401);
  assert.deepEqual(f.history, []); assert.equal(f.rows.executiveAgentAuditLogs.length, 0);
});

test("refusal audit failure cannot fall through to execution", async () => {
  const f = fixture(); f.auditFails = true;
  await assert.rejects(post(request({})), /audit unavailable/);
  assert.deepEqual(f.history, []); assert.equal(f.rows.clientNotes.length, 0);
});

test("failed business write finishes the approval as failed", async () => {
  const f = fixture(); f.noteFails = true;
  assert.equal((await (await post(request())).json()).ok, false);
  assert.deepEqual(f.history, ["approved", "failed"]);
});

test("concurrent human approvals claim pending once", async () => {
  const f = fixture();
  const responses = await Promise.all([post(request()), post(request())]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(f.rows.clientNotes.length, 1);
  assert.deepEqual(f.history, ["approved", "executed"]);
});

test("legacy-inline and equivalent forged ids cannot execute a write", async () => {
  for (const id of ["legacy-inline", "synthetic-equivalent"]) {
    const f = fixture(null);
    const result = await mod.executeExecutiveApprovedAction(f.db, {
      adminUserId: 7, approval: { ...approval("approved"), id },
    });
    assert.equal(result.ok, false);
    assert.equal(f.rows.clientNotes.length, 0);
    assert.equal(f.rows.executiveAgentApprovals.length, 0);
    assert.equal(f.rows.executiveAgentAuditLogs[0].actionType, "execution_refused");
  }
});

test("forged approved status cannot bypass persisted pending or owner", async () => {
  for (const [status, owner] of [["pending", 7], ["approved", 8], ["executed", 7]]) {
    const f = fixture(approval(status));
    assert.equal((await mod.executeExecutiveApprovedAction(f.db, {
      adminUserId: owner, approval: approval("approved"),
    })).ok, false);
    assert.equal(f.rows.clientNotes.length, 0); assert.deepEqual(f.history, []);
  }
});

test("dispatcher uses canonical persisted payload and serializes replay", async () => {
  const f = fixture(approval("approved"));
  const forged = { ...approval("approved"), payloadJson: JSON.stringify({ clientId, note: "forged note" }) };
  const results = await Promise.all([1, 2].map(() => mod.executeExecutiveApprovedAction(f.db, {
    adminUserId: 7, approval: forged,
  })));
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(f.rows.clientNotes.length, 1);
  assert.match(f.rows.clientNotes[0].note, /canonical reviewed note/);
  assert.doesNotMatch(f.rows.clientNotes[0].note, /forged note/);
});
