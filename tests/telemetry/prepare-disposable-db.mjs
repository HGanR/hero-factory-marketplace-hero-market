import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.CI, "true", "This bootstrap is for an isolated CI container only.");
assert.equal(process.env.SKIPPER_TELEMETRY_SQL_TEST_ONLY, "1");
const engine = process.env.SKIPPER_TELEMETRY_SQL_ENGINE;
assert.ok(["mysql", "tidb"].includes(engine));
const deadline = Date.now() + 90000;
let connection;
while (!connection) {
  try {
    connection = await mysql.createConnection({
      host: "127.0.0.1", port: 41306, user: "root",
      password: engine === "mysql" ? "disposable-ci-root" : "", connectTimeout: 2000,
    });
  } catch {
    if (Date.now() > deadline) throw Error("Disposable database did not become ready.");
    await delay(1000);
  }
}
try {
  const [[info]] = await connection.query("SELECT VERSION() AS version");
  assert.equal(info.version.includes("TiDB"), engine === "tidb");
  await connection.query("SET GLOBAL time_zone = '+00:00'");
  await connection.query("CREATE DATABASE skipper_step1_ci");
  await connection.query("CREATE USER 'skipper_test'@'%' IDENTIFIED BY 'disposable-ci-only'");
  await connection.query("GRANT ALL PRIVILEGES ON skipper_step1_ci.* TO 'skipper_test'@'%'");
  console.log("Prepared empty disposable test database on " + info.version);
} finally { await connection.end(); }
