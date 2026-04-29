#!/usr/bin/env node
/**
 * Run a Drizzle SQL migration file without the mysql CLI.
 * Usage: node scripts/run-migration.mjs [migration-file]
 * Example: npm run db:migrate
 *          node scripts/run-migration.mjs drizzle/0006_troo_world_elements_expand_types.sql
 *
 * Requires: DATABASE_URL in .env or .env.local
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";

const migrationFile = process.argv[2] || "drizzle/0006_troo_world_elements_expand_types.sql";
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env or .env.local");
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

async function main() {
  const sql = readFileSync(migrationFile, "utf8");
  const conn = await createConnection(config);
  try {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const stmt of statements) {
      if (stmt) {
        await conn.query(stmt);
        console.log("OK:", stmt.slice(0, 60) + (stmt.length > 60 ? "..." : ""));
      }
    }
    console.log("Migration completed successfully.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
