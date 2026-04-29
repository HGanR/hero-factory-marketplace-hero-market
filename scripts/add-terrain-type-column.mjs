#!/usr/bin/env node
/**
 * add-terrain-type-column.mjs
 * Adds the terrainType column to the troo_worlds table.
 * 
 * Run: node scripts/add-terrain-type-column.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  console.log("🔧 Adding terrainType column to troo_worlds table...\n");

  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  });

  try {
    // Check if column already exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'troo_worlds' AND COLUMN_NAME = 'terrainType'`
    );

    if (columns.length > 0) {
      console.log("✓ Column 'terrainType' already exists. No changes needed.");
    } else {
      // Add the column
      await connection.execute(
        `ALTER TABLE troo_worlds 
         ADD COLUMN terrainType ENUM('urban-flat', 'green-hills', 'desert', 'snow', 'water-city') 
         NOT NULL DEFAULT 'urban-flat' 
         AFTER slug`
      );
      console.log("✓ Column 'terrainType' added successfully!");
    }

  } catch (err) {
    console.error("❌ Error:", err);
    throw err;
  } finally {
    await connection.end();
  }

  console.log("\n✅ Migration complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
