import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

export async function ensureOasisMarketTables(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_worlds (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      slug VARCHAR(200) NOT NULL UNIQUE,
      summary TEXT NULL,
      description TEXT NULL,
      engine ENUM('unity','unreal','webgl','custom') NOT NULL DEFAULT 'unity',
      modelUri TEXT NULL,
      previewImageUri TEXT NULL,
      tags TEXT NULL,
      isPublished BOOLEAN NOT NULL DEFAULT false,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX oasis_worlds_created_by_idx (createdByUserId),
      INDEX oasis_worlds_published_idx (isPublished)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_asset_packs (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      slug VARCHAR(200) NOT NULL UNIQUE,
      summary TEXT NULL,
      description TEXT NULL,
      engine ENUM('unity','unreal','universal') NOT NULL DEFAULT 'universal',
      previewImageUri TEXT NULL,
      packManifestUri TEXT NULL,
      includedElementIds TEXT NULL,
      tags TEXT NULL,
      isPublished BOOLEAN NOT NULL DEFAULT false,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX oasis_asset_packs_created_by_idx (createdByUserId),
      INDEX oasis_asset_packs_published_idx (isPublished)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_market_listings (
      id VARCHAR(64) PRIMARY KEY,
      itemType ENUM('world','object','pack') NOT NULL,
      itemRefId VARCHAR(64) NOT NULL,
      title VARCHAR(180) NOT NULL,
      subtitle VARCHAR(255) NULL,
      description TEXT NULL,
      previewImageUri TEXT NULL,
      engine ENUM('unity','unreal','webgl','custom','universal') NOT NULL DEFAULT 'universal',
      price DECIMAL(18,6) NOT NULL DEFAULT 0,
      currency ENUM('TROO','TROO_POO','XRP','SOL','POL','BTC','ETH','BNB','USDC') NOT NULL DEFAULT 'TROO',
      isPublished BOOLEAN NOT NULL DEFAULT false,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX oasis_market_listings_item_idx (itemType, itemRefId),
      INDEX oasis_market_listings_published_idx (isPublished),
      INDEX oasis_market_listings_created_by_idx (createdByUserId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_market_purchases (
      id VARCHAR(64) PRIMARY KEY,
      userId INT NOT NULL,
      itemType ENUM('world','object','pack') NOT NULL,
      itemRefId VARCHAR(64) NOT NULL,
      listingId VARCHAR(64) NULL,
      txHash VARCHAR(140) NULL,
      amount DECIMAL(18,6) NOT NULL DEFAULT 0,
      currency ENUM('TROO','TROO_POO','XRP','SOL','POL','BTC','ETH','BNB','USDC') NOT NULL DEFAULT 'TROO',
      metadata TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX oasis_market_purchases_user_idx (userId),
      INDEX oasis_market_purchases_item_idx (itemType, itemRefId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_market_licenses (
      id VARCHAR(64) PRIMARY KEY,
      userId INT NOT NULL,
      itemType ENUM('world','object','pack') NOT NULL,
      itemRefId VARCHAR(64) NOT NULL,
      purchaseId VARCHAR(64) NULL,
      status ENUM('active','revoked') NOT NULL DEFAULT 'active',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY oasis_market_licenses_user_item_uidx (userId, itemType, itemRefId),
      INDEX oasis_market_licenses_user_idx (userId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_world_versions (
      id VARCHAR(64) PRIMARY KEY,
      worldId VARCHAR(64) NOT NULL,
      sceneGraph TEXT NOT NULL,
      seed INT NOT NULL DEFAULT 0,
      readinessHash VARCHAR(64) NULL,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX oasis_world_versions_world_idx (worldId),
      INDEX oasis_world_versions_created_at_idx (createdAt)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_world_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      worldId VARCHAR(64) NOT NULL,
      eventType VARCHAR(64) NOT NULL,
      payload TEXT NULL,
      createdByUserId INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX oasis_world_events_world_idx (worldId),
      INDEX oasis_world_events_created_at_idx (createdAt)
    )
  `);
}

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function parseJsonArray<T = string>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
