import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.CI, "true", "Disposable CI database only");
assert.equal(process.env.SKIPPER_STEP2_SQL_TEST_ONLY, "1");
const engine = process.env.SKIPPER_STEP2_SQL_ENGINE;
assert.ok(["mysql", "tidb"].includes(engine));
let connection;
const deadline = Date.now() + 90_000;
while (!connection) {
  try { connection = await mysql.createConnection({ host: "127.0.0.1", port: 41306, user: "root", password: engine === "mysql" ? "disposable-ci-root" : "", connectTimeout: 2000 }); }
  catch { if (Date.now() > deadline) throw Error("Disposable database unavailable"); await delay(1000); }
}
try {
  const [[info]] = await connection.query("SELECT VERSION() AS version");
  assert.equal(info.version.includes("TiDB"), engine === "tidb");
  await connection.query("SET GLOBAL time_zone = '+00:00'");
  await connection.query("SET GLOBAL sql_mode = 'STRICT_ALL_TABLES'");
  if (engine === "tidb") await connection.query("SET GLOBAL tidb_txn_mode = 'pessimistic'");
  // No IF NOT EXISTS: an existing database is a refusal, never permission to reuse it.
  await connection.query("CREATE DATABASE skipper_step2_ci");
  await connection.query("CREATE USER 'skipper_step2_test'@'%' IDENTIFIED BY 'disposable-step2-only'");
  await connection.query("GRANT ALL PRIVILEGES ON skipper_step2_ci.* TO 'skipper_step2_test'@'%'");
  console.log("Created fresh isolated database on " + info.version);
} finally { await connection.end(); }
