import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureOfferTables() {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS offers (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      priceRange VARCHAR(64),
      promise TEXT,
      icp TEXT,
      deliverables TEXT,
      guarantee TEXT,
      riskReversal TEXT,
      positioning TEXT,
      proof TEXT,
      objections TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX offers_user_idx (userId),
      INDEX offers_status_idx (status)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS offer_assets (
      id VARCHAR(36) PRIMARY KEY,
      offerId VARCHAR(36) NOT NULL,
      vslScript TEXT,
      landingCopy TEXT,
      adAngles TEXT,
      emailSeq TEXT,
      callScript TEXT,
      version INT NOT NULL DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX offer_assets_offer_idx (offerId)
    )
  `);
}
