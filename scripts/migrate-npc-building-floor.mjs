#!/usr/bin/env node
/**
 * Run only the oasis_npcs buildingId + floor migration.
 * Use when drizzle-kit migrate fails (e.g. tables already exist from prior setup).
 *
 * Usage: node scripts/migrate-npc-building-floor.mjs
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
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname?.replace(/^\//, "") || "hero-market",
    ssl: { rejectUnauthorized: false },
  });

  const alters = [
    "ALTER TABLE `oasis_npcs` ADD COLUMN `buildingId` varchar(64) NULL",
    "ALTER TABLE `oasis_npcs` ADD COLUMN `floor` int NULL",
  ];

  for (const sql of alters) {
    try {
      await conn.execute(sql);
      const col = sql.includes("buildingId") ? "buildingId" : "floor";
      console.log("✓", col);
    } catch (e) {
      const err = e;
      if (err?.errno === 1060 || err?.sqlMessage?.includes("Duplicate column")) {
        const col = sql.includes("buildingId") ? "buildingId" : "floor";
        console.log("⊘ Column already exists:", col);
      } else {
        console.error("Error:", err);
        process.exit(1);
      }
    }
  }

  await conn.end();
  console.log("\nDone. oasis_npcs now has buildingId and floor.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
