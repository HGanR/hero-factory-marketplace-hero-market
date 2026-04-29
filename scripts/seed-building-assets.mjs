#!/usr/bin/env node
/**
 * seed-building-assets.mjs
 * Seeds Troo World buildings into world_library_assets.
 * Users can purchase these to place in their worlds.
 *
 * Run: node scripts/seed-building-assets.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const BUILDINGS = [
  { slug: "nexus-tower", name: "Nexus Tower", modelUrl: "/models/nexus-tower/modern_building.glb", tokenPrice: 5000 },
  { slug: "meridian-tower", name: "Meridian Tower", modelUrl: "/models/meridian-tower/meridian_tower.glb", tokenPrice: 5000 },
  { slug: "apex-tower", name: "Apex Tower", modelUrl: "procedural:apex", tokenPrice: 5000 },
  { slug: "harborview-tower", name: "Harborview Tower", modelUrl: "procedural:harborview", tokenPrice: 5000 },
];

async function main() {
  const baseUrl = DATABASE_URL.trim().replace(/^["']|["']$/g, "").split("?")[0];
  const parsed = new URL(baseUrl);
  const config = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname?.replace(/^\//, "") || "hero-market",
    ssl: { rejectUnauthorized: false },
  };

  const conn = await mysql.createConnection(config);

  try {
    console.log("📌 Seeding building assets into world_library_assets...\n");

    for (const b of BUILDINGS) {
      await conn.execute(
        `INSERT INTO world_library_assets (
          id, slug, name, category, description, status, version, modelUrl,
          tokenPrice, isPlatformOnly, isActive, createdAt, updatedAt
        ) VALUES (?, ?, ?, 'building', ?, 'published', 1, ?, ?, FALSE, TRUE, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          category = 'building',
          modelUrl = VALUES(modelUrl),
          tokenPrice = VALUES(tokenPrice),
          updatedAt = NOW()`,
        [
          b.slug,
          b.slug,
          b.name,
          `Corporate building for Troo World. Place in your world to host meeting nodes and AI agents.`,
          b.modelUrl,
          b.tokenPrice,
        ]
      );
      console.log(`   ✓ ${b.name} (${b.slug}) — ${b.tokenPrice} TROO`);
    }

    console.log("\n   Done. Buildings available in Asset Library.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
