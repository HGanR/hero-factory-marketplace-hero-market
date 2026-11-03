import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test, before, beforeEach, after } from "node:test";
import { build } from "esbuild";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";
import { SQL } from "drizzle-orm";

// Never use application DATABASE_URL, cookies, JWT secrets or remote hosts.
assert.equal(process.env.SKIPPER_TELEMETRY_SQL_TEST_ONLY, "1");
const engine = process.env.SKIPPER_TELEMETRY_SQL_ENGINE;
assert.ok(["mysql", "tidb"].includes(engine));
const password = process.env.SKIPPER_TELEMETRY_SQL_PASSWORD;
assert.ok(password);
const pool = mysql.createPool({
  host: "127.0.0.1", port: 41306, user: "skipper_test", password,
  database: "skipper_step1_ci", connectionLimit: 5, timezone: "Z",
});
const root = process.cwd();
const dir = mkdtempSync(join(root, ".telemetry-sql-"));
const output = join(dir, "query.mjs");
const handler = resolve(root, "src/app/api/admin/executive-agent/telemetry/feed/telemetry-feed-route-handler.ts");
await build({
  stdin: {
    contents: `export { listTelemetryEventsFromDb, encodeTelemetryFeedCursor, decodeTelemetryFeedCursor, dedupeTelemetryEventsById } from ${JSON.stringify(handler)};
      export { platformActivity } from "@/lib/db/schema";`,
    resolveDir: root, loader: "ts",
  },
  outfile: output, bundle: true, platform: "node", format: "esm",
  packages: "external", treeShaking: true,
  plugins: [{
    name: "actual-project-query-and-schema",
    setup(b) {
      // NextResponse belongs to the unused HTTP wrapper, not this SQL test.
      b.onResolve({ filter: /^next\/server$/ }, () => ({
        path: "next/server.js", external: true, sideEffects: false,
      }));
      b.onResolve({ filter: /^@\// }, args => ({
        path: resolve(root, "src", args.path.slice(2) + ".ts"),
      }));
    },
  }],
});
const mod = await import(pathToFileURL(output).href);
const db = drizzle(pool);
const dialect = new MySqlDialect();
const quote = name => "`" + name.replaceAll("`", "``") + "`";
before(async () => {
  const [[info]] = await pool.query("SELECT DATABASE() AS db, VERSION() AS version, @@session.time_zone AS sessionTimezone");
  assert.equal(info.db, "skipper_step1_ci");
  assert.equal(info.sessionTimezone, "+00:00");
  assert.equal(info.version.includes("TiDB"), engine === "tidb");
  const [existing] = await pool.query("SHOW TABLES");
  assert.equal(existing.length, 0, "Disposable fixture database must start empty.");
  const config = getTableConfig(mod.platformActivity);
  const columns = config.columns.map(c => {
    let defaultClause = "";
    if (c.default !== undefined) {
      assert.ok(c.default instanceof SQL, "Unexpected schema default; do not approximate it.");
      defaultClause = "DEFAULT " + dialect.sqlToQuery(c.default).sql;
    }
    return [quote(c.name), c.getSQLType(), c.notNull ? "NOT NULL" : "", defaultClause, c.primary ? "PRIMARY KEY" : ""]
      .filter(Boolean).join(" ");
  });
  await pool.query("CREATE TABLE " + quote(config.name) + " (" + columns.join(", ") + ") ENGINE=InnoDB");
  console.log("Real SQL engine: " + info.version + "; actual merged Drizzle schema; no SQL transport mock.");
});
beforeEach(async () => { await pool.query("TRUNCATE TABLE platform_activity"); });
after(async () => { await pool.end(); rmSync(dir, { recursive: true, force: true }); });

const at = seconds => new Date(Date.parse("2026-11-03T12:00:00.000Z") + seconds * 1000);
const ident = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const event = (n, seconds, eventType = "new_account") => ({
  id: ident(n), userId: 7, eventType, sourceModule: "Disposable fixture",
  payload: { accountId: n }, trustId: null, createdAt: at(seconds),
});
const insert = rows => db.insert(mod.platformActivity).values(rows);
const query = (cursor = null, limit = 50, seconds = 100) =>
  mod.listTelemetryEventsFromDb(db, cursor, limit, at(seconds));
const resume = page => mod.decodeTelemetryFeedCursor(page.nextCursor);

test("real query reads payload and UTC timestamp, and preserves final/empty resume cursors", async () => {
  await insert([event(1, 0)]);
  const page = await query();
  assert.deepEqual(page.events.map(e => e.id), [ident(1)]);
  assert.deepEqual(page.events[0].payload, { accountId: 1 });
  assert.equal(page.events[0].createdAt, at(0).toISOString());
  assert.equal(typeof page.nextCursor, "string");
  const empty = await query(resume(page));
  assert.deepEqual(empty.events, []);
  assert.equal(empty.nextCursor, page.nextCursor);
});
test("150 equal-timestamp rows drain through real SQL in three pages plus empty", async () => {
  await insert(Array.from({ length: 150 }, (_, i) => event(150 - i, 0)));
  const ids = [];
  let cursor = null, pages = 0;
  for (;;) {
    const page = await query(cursor, 50); pages++;
    if (!page.events.length) {
      if (cursor) assert.deepEqual(resume(page), cursor);
      break;
    }
    ids.push(...page.events.map(e => e.id));
    const next = resume(page);
    assert.notDeepEqual(next, cursor);
    cursor = next;
    assert.ok(pages <= 4, "Pagination must advance.");
  }
  assert.equal(pages, 4); assert.equal(ids.length, 150); assert.equal(new Set(ids).size, 150);
  assert.equal(ids[0], ident(1)); assert.equal(ids.at(-1), ident(150));
});
test("real WHERE clause excludes unrelated event types and events above the watermark", async () => {
  await insert([event(1, 0), event(2, 10, "onboarding_completed"), event(3, 20, "asset_purchased"),
    event(4, 95), event(5, 0, "unrelated_fixture")]);
  const page = await query();
  assert.deepEqual(page.events.map(e => e.id), [ident(1), ident(2), ident(3)]);
  const later = await query(resume(page), 50, 150);
  assert.deepEqual(later.events.map(e => e.id), [ident(4)]);
});
test("closed timestamp group includes lower UUIDs inserted after higher UUIDs", async () => {
  await insert([event(9, 0)]); await insert([event(1, 0)]);
  const first = await query(null, 1), second = await query(resume(first), 1);
  assert.deepEqual([...first.events, ...second.events].map(e => e.id), [ident(1), ident(9)]);
});
test("real uncommitted older row is invisible, later commits, and is recovered by checkpoint replay", async () => {
  const tx = await pool.getConnection();
  try {
    await tx.beginTransaction();
    await tx.query("INSERT INTO platform_activity (id, userId, eventType, sourceModule, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [ident(1), 7, "new_account", "Disposable fixture", JSON.stringify({ accountId: 1 }), at(0)]);
    await insert([event(2, 10)]);
    const forward = await query(null, 50, 40);
    assert.deepEqual(forward.events.map(e => e.id), [ident(2)], "Uncommitted A must be invisible on another connection.");
    await tx.commit();
    assert.deepEqual((await query(resume(forward), 50, 70)).events, [], "Forward polling remains best-effort.");
    const recovered = [];
    let checkpoint = { c: at(-1).toISOString(), i: "" };
    for (let n = 0; n < 4; n++) {
      const page = await query(checkpoint, 1, 70);
      if (!page.events.length) break;
      recovered.push(...page.events);
      checkpoint = resume(page);
    }
    assert.deepEqual(recovered.map(e => e.id), [ident(1), ident(2)]);
    assert.deepEqual(mod.dedupeTelemetryEventsById(recovered, new Set([ident(2)])).map(e => e.id), [ident(1)]);
  } finally { await tx.rollback(); tx.release(); }
});
test("empty initial feed keeps null without inventing progress", async () => {
  const page = await query(); assert.deepEqual(page.events, []); assert.equal(page.nextCursor, null);
});
test("newly eligible row appears after time advances from an empty poll", async () => {
  await insert([event(1, 90)]);
  assert.deepEqual((await query(null, 50, 100)).events, []);
  assert.deepEqual((await query(null, 50, 121)).events.map(e => e.id), [ident(1)]);
});
test("query remains read-only: replay changes neither source rows nor their timestamps", async () => {
  await insert([event(1, 0), event(2, 10)]);
  const [beforeRows] = await pool.query("SELECT * FROM platform_activity ORDER BY id");
  await query(); await query();
  const [afterRows] = await pool.query("SELECT * FROM platform_activity ORDER BY id");
  assert.deepEqual(afterRows, beforeRows);
});
