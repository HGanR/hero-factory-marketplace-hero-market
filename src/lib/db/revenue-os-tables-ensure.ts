/**
 * Ensures revenue_profiles and revenue_os_runs tables exist.
 * These tables are used by the AI Revenue OS Analyze flow but may not exist
 * if Drizzle migrations haven't been run. This allows the feature to work
 * without requiring a full migration.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureRevenueOsAnalyzeTables() {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_profiles (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36),
      trust_id VARCHAR(36),
      walletAddress VARCHAR(64),
      businessName VARCHAR(160),
      businessType VARCHAR(120),
      market VARCHAR(120),
      currentMonthlyRevenue DECIMAL(18,2) NOT NULL,
      targetMonthlyRevenue DECIMAL(18,2) NOT NULL,
      avgOrderValue DECIMAL(18,2) NOT NULL,
      grossMarginPct DECIMAL(5,2) NOT NULL,
      monthlyTraffic INT NOT NULL,
      conversionRatePct DECIMAL(6,3) NOT NULL,
      cac DECIMAL(18,2) NOT NULL,
      ltv DECIMAL(18,2) NOT NULL,
      constraints JSON,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX revprof_user_idx (user_id),
      INDEX revprof_client_idx (client_id),
      INDEX revprof_trust_idx (trust_id),
      INDEX revprof_wallet_idx (walletAddress),
      UNIQUE INDEX revprof_user_unique (user_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_runs (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36),
      trust_id VARCHAR(36),
      profileId VARCHAR(36) NOT NULL,
      input JSON NOT NULL,
      output JSON NOT NULL,
      inputHash VARCHAR(64) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX revosrun_user_idx (user_id),
      INDEX revosrun_profile_idx (profileId),
      INDEX revosrun_hash_idx (inputHash)
    )
  `);
}
