import { getConnection } from "@/lib/db";

async function tryAlter(statement: string): Promise<void> {
  try {
    const conn = await getConnection();
    await conn.query(statement);
  } catch {
    /* duplicate column — ignore */
  }
}

/**
 * Best-effort DDL for campaign columns when Drizzle migrations are not applied on prod yet.
 */
export async function ensureCampaignSchemaColumns(): Promise<void> {
  await tryAlter(
    "ALTER TABLE campaigns ADD COLUMN publish_approval_chain_json JSON NULL AFTER end_at",
  );
  await tryAlter(
    "ALTER TABLE campaigns ADD COLUMN publish_approval_report_schedule_json JSON NULL AFTER publish_approval_chain_json",
  );
  await tryAlter("ALTER TABLE campaigns ADD COLUMN bentley_run_id VARCHAR(128) NULL");
  await tryAlter("ALTER TABLE campaigns ADD COLUMN bentley_generation_json JSON NULL");
  await tryAlter(
    "ALTER TABLE campaigns ADD COLUMN bentley_autopilot_publish TINYINT(1) NOT NULL DEFAULT 0",
  );
  await tryAlter("ALTER TABLE campaigns ADD COLUMN derived_from_campaign_id VARCHAR(36) NULL");
}
