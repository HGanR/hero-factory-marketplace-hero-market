#!/usr/bin/env node
/**
 * Deploy-ready migration for troo_world_elements.
 * Creates table if missing (with varchar type), or expands type from enum to varchar(64).
 * Run: node scripts/deploy-troo-world-elements.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS \`troo_world_elements\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`worldId\` varchar(64) NOT NULL DEFAULT 'default',
  \`type\` varchar(64) NOT NULL,
  \`posX\` decimal(12,4) NOT NULL DEFAULT '0',
  \`posY\` decimal(12,4) NOT NULL DEFAULT '0',
  \`posZ\` decimal(12,4) NOT NULL DEFAULT '0',
  \`rotY\` decimal(12,4) NOT NULL DEFAULT '0',
  \`scale\` decimal(12,4) NOT NULL DEFAULT '1',
  \`colorHex\` int,
  \`color2Hex\` int,
  \`label\` varchar(128),
  \`isDefault\` boolean NOT NULL DEFAULT false,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`troo_world_elements_id\` PRIMARY KEY(\`id\`)
);
`;

const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS \`troo_elements_world_idx\` ON \`troo_world_elements\` (\`worldId\`);`;
const ALTER_TYPE = `ALTER TABLE \`troo_world_elements\` MODIFY COLUMN \`type\` varchar(64) NOT NULL;`;

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
    const [rows] = await conn.execute(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = 'troo_world_elements'",
      [parsed.pathname?.replace(/^\//, "") || "hero-market"]
    );
    const exists = Array.isArray(rows) && rows.length > 0;

    if (!exists) {
      await conn.execute(CREATE_TABLE);
      console.log("✓ Created troo_world_elements with varchar(64) type");
      try {
        await conn.execute(CREATE_INDEX);
        console.log("✓ Created index");
      } catch (e) {
        if (e?.errno !== 1061) console.log("⊘ Index may already exist");
      }
    } else {
      await conn.execute(ALTER_TYPE);
      console.log("✓ Expanded troo_world_elements.type to varchar(64)");
    }
  } catch (e) {
    const err = e;
    if (err?.sqlMessage?.includes("varchar") || err?.errno === 1064) {
      console.log("⊘ Column already varchar or migration not applicable");
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
