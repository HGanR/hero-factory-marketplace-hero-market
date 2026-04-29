#!/usr/bin/env node
/**
 * Show columns for a table (same DB config as run-all-migrations.mjs).
 * Usage: node scripts/db-show-columns.mjs oasis_npcs buildingId floor
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createConnection } from "mysql2/promise";

const table = process.argv[2] || "oasis_npcs";
const cols = process.argv.slice(3);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const baseUrl = url.trim().replace(/^["']|["']$/g, "").split("?")[0];
const parsed = new URL(baseUrl);
const config = {
  host: parsed.hostname,
  port: parsed.port ? parseInt(parsed.port, 10) : 4000,
  user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
  password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  database: parsed.pathname?.replace(/^\//, "") || "hero-market",
  ssl: { rejectUnauthorized: false },
};

const safeTable = /^[a-zA-Z0-9_]+$/.test(table) ? table : "oasis_npcs";
const conn = await createConnection(config);
try {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${safeTable}\``);
  const list = Array.isArray(rows) ? rows : [];
  const filtered =
    cols.length > 0 ? list.filter((r) => cols.includes(r.Field)) : list;
  console.table(filtered);
} finally {
  await conn.end();
}
