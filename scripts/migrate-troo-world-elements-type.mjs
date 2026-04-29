#!/usr/bin/env node
/**
 * Expands troo_world_elements.type from enum to varchar(64) for full object library.
 * Run when mysql CLI is not installed: node scripts/migrate-troo-world-elements-type.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const clean = url.trim().replace(/^["']|["']$/g, "").split("?")[0];
  const parsed = new URL(clean);
  const conn = await mysql.createConnection({
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 4000,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname?.replace(/^\//, "") || "hero-market",
    ssl: { rejectUnauthorized: true },
  });

  try {
    await conn.execute("ALTER TABLE `troo_world_elements` MODIFY COLUMN `type` varchar(64) NOT NULL");
    console.log("✓ troo_world_elements.type expanded to varchar(64)");
  } catch (e) {
    const err = e;
    if (err?.sqlMessage?.includes("varchar") || err?.errno === 1064) {
      console.log("⊘ Column may already be varchar or migration not applicable:", err?.sqlMessage || err?.message);
    } else if (err?.sqlMessage?.includes("doesn't exist") || err?.errno === 1146) {
      console.log("⊘ Table troo_world_elements does not exist. Run earlier migrations first (e.g. drizzle/0003, 0004).");
    } else {
      console.error("Error:", err?.message || err);
      process.exit(1);
    }
  }

  await conn.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
