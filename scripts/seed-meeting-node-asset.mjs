#!/usr/bin/env node
/**
 * seed-meeting-node-asset.mjs
 * Seeds the Corporate Meeting Node v1 into world_library_assets.
 * Users can purchase this asset to place meeting nodes in buildings.
 *
 * Run: node scripts/seed-meeting-node-asset.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const ASSET = {
  id: "corporate-meeting-node-v1",
  slug: "corporate-meeting-node-v1",
  name: "Corporate Meeting Node v1",
  category: "meeting_node",
  description: "Meeting room node for corporate buildings. Place in Nexus, Meridian, Apex, or Harborview towers. Supports web meetings with LiveKit.",
  modelUrl: "procedural:corporate_meeting_node_v1",
  tokenPrice: 7500,
  metadataJson: JSON.stringify({
    compatibleBuildingCategories: ["nexus-tower", "meridian-tower", "apex-tower", "harborview-tower"],
    minCapacity: 2,
    maxCapacity: 50,
    supportedModes: ["web", "webxr", "vr"],
  }),
};

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
    console.log("📌 Seeding Corporate Meeting Node v1 into world_library_assets...");

    await conn.execute(
      `INSERT INTO world_library_assets (
        id, slug, name, category, description, status, version, modelUrl,
        tokenPrice, isPlatformOnly, isActive, metadataJson, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'published', 1, ?, ?, FALSE, TRUE, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        description = VALUES(description),
        status = VALUES(status),
        modelUrl = VALUES(modelUrl),
        tokenPrice = VALUES(tokenPrice),
        metadataJson = VALUES(metadataJson),
        updatedAt = NOW()`,
      [
        ASSET.id,
        ASSET.slug,
        ASSET.name,
        ASSET.category,
        ASSET.description,
        ASSET.modelUrl,
        ASSET.tokenPrice,
        ASSET.metadataJson,
      ]
    );

    console.log("   ✓ Corporate Meeting Node v1 seeded (category: meeting_node, price: 7500 TROO)");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
