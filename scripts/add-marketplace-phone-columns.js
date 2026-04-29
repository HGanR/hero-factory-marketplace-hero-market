#!/usr/bin/env node
/**
 * Adds phone and smsConsent columns to marketplace_users.
 * Run: node scripts/add-marketplace-phone-columns.js
 * Loads .env.local or .env automatically.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const mysql = require("mysql2/promise");

async function main() {
  const url = (process.env.DATABASE_URL || "").trim().replace(/^["']|["']$/g, "");
  if (!url || !url.includes("hero-market")) {
    console.error("DATABASE_URL must point to hero-market. Example:");
    console.error('  DATABASE_URL="mysql://user:pass@host:4000/hero-market" node scripts/add-marketplace-phone-columns.js');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    ...parseUrl(url),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const dbName = new URL(url.split("?")[0]).pathname?.replace(/^\//, "") || "hero-market";
    // Check if columns exist
    const [rows] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'marketplace_users' AND COLUMN_NAME IN ('phone','smsConsent')",
      [dbName]
    );
    const existing = new Set(rows.map((r) => r.COLUMN_NAME));

    if (!existing.has("phone")) {
      await conn.execute("ALTER TABLE marketplace_users ADD COLUMN phone varchar(24)");
      console.log("Added column: phone");
    } else {
      console.log("Column phone already exists");
    }

    if (!existing.has("smsConsent")) {
      await conn.execute("ALTER TABLE marketplace_users ADD COLUMN smsConsent boolean NOT NULL DEFAULT false");
      console.log("Added column: smsConsent");
    } else {
      console.log("Column smsConsent already exists");
    }

    console.log("Done. Admin login should work now.");
  } finally {
    await conn.end();
  }
}

function parseUrl(u) {
  const parsed = new URL(u.split("?")[0]);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 4000,
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database: (parsed.pathname || "").replace(/^\//, "") || "hero-market",
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
