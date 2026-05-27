/**
 * Best-effort DDL for Revenue OS LIVE module tables / columns when migrations are not applied yet.
 */
import { sql } from "drizzle-orm";
import { getConnection, getDb } from "@/lib/db";

async function tryAlter(statement: string): Promise<void> {
  try {
    const conn = await getConnection();
    await conn.query(statement);
  } catch {
    // duplicate column / table — ignore
  }
}

export async function ensureRevenueOsLiveModuleTables(): Promise<void> {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS offer_packages (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36) NOT NULL DEFAULT '',
      trust_id VARCHAR(36) NOT NULL DEFAULT '',
      profile_id VARCHAR(36),
      name VARCHAR(200) NOT NULL DEFAULT 'Revenue ladder',
      industry_key VARCHAR(120),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY offer_pkg_workspace_idx (user_id, client_id, trust_id),
      KEY offer_pkg_user_idx (user_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS offer_versions (
      id VARCHAR(36) PRIMARY KEY,
      package_id VARCHAR(36) NOT NULL,
      version INT NOT NULL,
      offer_ladder JSON NOT NULL,
      pricing_bands JSON NOT NULL,
      upsells JSON NOT NULL,
      target_monthly_revenue DECIMAL(18,2),
      margin_pct DECIMAL(7,4),
      raw_payload JSON,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY offer_ver_pkg_ver_uidx (package_id, version),
      KEY offer_ver_pkg_idx (package_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS experiment_variants (
      id VARCHAR(36) PRIMARY KEY,
      experiment_id VARCHAR(36) NOT NULL,
      label VARCHAR(64) NOT NULL,
      is_control TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY exp_var_exp_idx (experiment_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS experiment_results (
      id VARCHAR(36) PRIMARY KEY,
      experiment_id VARCHAR(36) NOT NULL,
      variant_id VARCHAR(36) NOT NULL,
      metrics JSON NOT NULL,
      revenue_lift_pct DECIMAL(10,4),
      is_winner TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY exp_res_exp_idx (experiment_id),
      KEY exp_res_var_idx (variant_id)
    )
  `);

  await tryAlter(
    "ALTER TABLE market_scans ADD COLUMN client_id VARCHAR(36) NOT NULL DEFAULT '' AFTER user_id"
  );
  await tryAlter(
    "ALTER TABLE market_scans ADD COLUMN trust_id VARCHAR(36) NOT NULL DEFAULT '' AFTER client_id"
  );
  await tryAlter(
    "ALTER TABLE capital_plans ADD COLUMN profile_id VARCHAR(36) NULL AFTER trust_id"
  );
  await tryAlter(
    "ALTER TABLE capital_plans ADD COLUMN snapshot_month VARCHAR(7) NULL AFTER profile_id"
  );
  await tryAlter(
    "ALTER TABLE revenue_os_experiments ADD COLUMN winner_variant_id VARCHAR(36) NULL AFTER result_snapshot"
  );

  await tryAlter(
    "ALTER TABLE market_sources ADD COLUMN last_market_scan_id VARCHAR(36) NULL AFTER source_type"
  );
  await tryAlter(
    "CREATE UNIQUE INDEX mkt_src_url_uidx ON market_sources (url(512))"
  );
  await tryAlter(
    "CREATE INDEX mkt_scan_user_client_created_idx ON market_scans (user_id, client_id, created_at)"
  );

  await tryAlter(
    "ALTER TABLE channel_spend_snapshots ADD COLUMN trust_id VARCHAR(36) NOT NULL DEFAULT '' AFTER client_id"
  );
  await tryAlter(
    "ALTER TABLE channel_spend_snapshots ADD COLUMN profile_id VARCHAR(36) NULL AFTER trust_id"
  );
  await tryAlter(
    "ALTER TABLE channel_spend_snapshots ADD COLUMN revenue_attributed DECIMAL(18,2) NULL AFTER spend"
  );
  await tryAlter(
    "ALTER TABLE channel_spend_snapshots ADD COLUMN roas DECIMAL(10,4) NULL AFTER revenue_attributed"
  );
  await tryAlter(
    "CREATE UNIQUE INDEX chspend_workspace_month_channel_uidx ON channel_spend_snapshots (user_id, client_id, trust_id, month, channel)"
  );
  await tryAlter(
    "CREATE INDEX capital_plan_user_client_month_idx ON capital_plans (user_id, client_id, snapshot_month)"
  );
  await tryAlter(
    "CREATE INDEX capital_plan_user_client_created_idx ON capital_plans (user_id, client_id, created_at)"
  );
  await tryAlter(
    "ALTER TABLE revenue_os_funnels ADD COLUMN cross_module_context JSON NULL AFTER status"
  );
  await tryAlter(
    "ALTER TABLE revenue_os_message_sequences ADD COLUMN cross_module_context JSON NULL AFTER status"
  );

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_monthly_snapshots (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36) NOT NULL DEFAULT '',
      trust_id VARCHAR(36) NOT NULL DEFAULT '',
      month VARCHAR(7) NOT NULL,
      traffic INT NOT NULL,
      conversion_rate_pct DECIMAL(6,3) NOT NULL,
      avg_order_value DECIMAL(18,2) NOT NULL,
      revenue DECIMAL(18,2) NOT NULL,
      cac DECIMAL(18,2) NOT NULL,
      ltv DECIMAL(18,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY snap_user_workspace_month_uidx (user_id, client_id, trust_id, month),
      KEY snap_user_idx (user_id),
      KEY snap_client_idx (client_id),
      KEY snap_trust_idx (trust_id),
      KEY snap_month_idx (month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_funnel_deployment_runs (
      id VARCHAR(36) PRIMARY KEY,
      funnel_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36) NOT NULL DEFAULT '',
      trust_id VARCHAR(36) NOT NULL DEFAULT '',
      provider VARCHAR(32) NOT NULL DEFAULT 'artifact',
      mode VARCHAR(32) NOT NULL DEFAULT 'stored',
      status VARCHAR(24) NOT NULL,
      result_summary JSON,
      error_message TEXT,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY revos_funnel_run_funnel_idx (funnel_id),
      KEY revos_funnel_run_user_client_idx (user_id, client_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_sequence_execution_runs (
      id VARCHAR(36) PRIMARY KEY,
      sequence_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36) NOT NULL DEFAULT '',
      trust_id VARCHAR(36) NOT NULL DEFAULT '',
      provider VARCHAR(32) NOT NULL DEFAULT 'none',
      mode VARCHAR(32) NOT NULL,
      status VARCHAR(24) NOT NULL,
      result_summary JSON,
      error_message TEXT,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY revos_seq_run_seq_idx (sequence_id),
      KEY revos_seq_run_user_client_idx (user_id, client_id)
    )
  `);
}
