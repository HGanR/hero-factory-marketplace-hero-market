/**
 * Best-effort DDL when migrations are not applied yet (Revenue OS launch cycles).
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureRevenueOsLaunchCycleTables(): Promise<void> {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_launch_cycles (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36) NOT NULL DEFAULT '',
      trust_id VARCHAR(36) NOT NULL DEFAULT '',
      scope_key VARCHAR(200) NOT NULL,
      client_cycle_ref VARCHAR(80) NULL,
      launch_plan_summary TEXT NOT NULL,
      readiness_json JSON NULL,
      plan_json JSON NULL,
      signals_snapshot_json JSON NULL,
      tracking_snapshot_json JSON NULL,
      current_day INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      KEY revos_launch_cycle_user_updated_idx (user_id, updated_at),
      KEY revos_launch_cycle_workspace_scope_idx (user_id, client_id, trust_id, scope_key(128))
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_launch_cycle_days (
      id VARCHAR(36) PRIMARY KEY,
      launch_cycle_id VARCHAR(36) NOT NULL,
      day_number INT NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'not_started',
      completed_actions_json JSON NULL,
      notes_text TEXT NULL,
      last_action_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY revos_launch_day_cycle_day_uidx (launch_cycle_id, day_number),
      KEY revos_launch_day_cycle_day_idx (launch_cycle_id, day_number)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_launch_cycle_events (
      id VARCHAR(36) PRIMARY KEY,
      launch_cycle_id VARCHAR(36) NOT NULL,
      day_number INT NULL,
      event_type VARCHAR(64) NOT NULL,
      event_payload_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY revos_launch_evt_cycle_created_idx (launch_cycle_id, created_at)
    )
  `);
}
