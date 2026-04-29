import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureMerchTables(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_projects (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      lane ENUM('CREATE', 'STUDIO') NOT NULL DEFAULT 'CREATE',
      name VARCHAR(191) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_projects_user_idx (userId),
      INDEX merch_projects_lane_idx (lane)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_versions (
      id VARCHAR(36) PRIMARY KEY,
      projectId VARCHAR(36) NOT NULL,
      kind ENUM('GENERATE', 'INPAINT', 'VARIANT') NOT NULL DEFAULT 'GENERATE',
      prompt TEXT NULL,
      negativePrompt TEXT NULL,
      seed INT NULL,
      modelVersion VARCHAR(120) NULL,
      paramsJson JSON NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_versions_project_idx (projectId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_renders (
      id VARCHAR(36) PRIMARY KEY,
      versionId VARCHAR(36) NOT NULL,
      kind ENUM('MOCKUP_FRONT', 'MOCKUP_BACK', 'FLAT', 'LIFESTYLE') NOT NULL,
      width INT NOT NULL,
      height INT NOT NULL,
      url TEXT NOT NULL,
      metadataJson JSON NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_renders_version_idx (versionId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_assets (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      type ENUM('GARMENT_TEMPLATE', 'LOGO', 'REFERENCE', 'BRAND_KIT', 'MASK') NOT NULL,
      name VARCHAR(191) NOT NULL,
      url TEXT NOT NULL,
      metadataJson JSON NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_assets_user_idx (userId),
      INDEX merch_assets_type_idx (type)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_jobs (
      id VARCHAR(36) PRIMARY KEY,
      type ENUM('RENDER', 'INPAINT', 'EXPORT_ZIP', 'EXPORT_PDF') NOT NULL,
      status ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
      inputJson JSON NULL,
      outputJson JSON NULL,
      error TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_jobs_status_idx (status),
      INDEX merch_jobs_type_idx (type)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_exports (
      id VARCHAR(36) PRIMARY KEY,
      projectId VARCHAR(36) NOT NULL,
      type ENUM('MOCKUP_PACK_ZIP', 'TECHPACK_PDF') NOT NULL,
      url TEXT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_exports_project_idx (projectId),
      INDEX merch_exports_type_idx (type)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merch_orders (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      projectId VARCHAR(36) NOT NULL,
      status ENUM('DRAFT', 'PAID', 'FULFILLING', 'SHIPPED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
      itemsJson JSON NULL,
      totalCents INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX merch_orders_user_idx (userId),
      INDEX merch_orders_project_idx (projectId),
      INDEX merch_orders_status_idx (status)
    )
  `);
}

