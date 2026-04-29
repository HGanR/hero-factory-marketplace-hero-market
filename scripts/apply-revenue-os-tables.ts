/**
 * Apply revenue-os module tables directly.
 * Run: npx tsx scripts/apply-revenue-os-tables.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import mysql from "mysql2/promise";

const sql = `
CREATE TABLE IF NOT EXISTS revenue_os_funnels (
  id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  profile_id varchar(36),
  client_id varchar(36) NOT NULL DEFAULT '',
  trust_id varchar(36) NOT NULL DEFAULT '',
  name varchar(200) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'DRAFT',
  created_at timestamp NOT NULL DEFAULT (now()),
  updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS revenue_os_funnel_pages (
  id varchar(36) NOT NULL,
  funnel_id varchar(36) NOT NULL,
  title varchar(200) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  sections json,
  created_at timestamp NOT NULL DEFAULT (now()),
  updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS revenue_os_message_sequences (
  id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  profile_id varchar(36),
  client_id varchar(36) NOT NULL DEFAULT '',
  trust_id varchar(36) NOT NULL DEFAULT '',
  channel varchar(24) NOT NULL,
  name varchar(200) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'DRAFT',
  created_at timestamp NOT NULL DEFAULT (now()),
  updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS revenue_os_sequence_steps (
  id varchar(36) NOT NULL,
  sequence_id varchar(36) NOT NULL,
  day_offset int NOT NULL,
  subject varchar(500),
  body text NOT NULL,
  trigger varchar(120),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT (now()),
  updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS market_sources (
  id varchar(36) NOT NULL,
  name varchar(200) NOT NULL,
  url varchar(512),
  industry varchar(120),
  source_type varchar(64),
  last_market_scan_id varchar(36) NULL,
  created_at timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(id),
  UNIQUE KEY mkt_src_url_uidx (url(512))
);
CREATE TABLE IF NOT EXISTS market_scans (
  id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  industry varchar(120) NOT NULL,
  geo varchar(120),
  offer_type varchar(120),
  payload json,
  created_at timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS capital_plans (
  id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  client_id varchar(36) NOT NULL DEFAULT '',
  trust_id varchar(36) NOT NULL DEFAULT '',
  ad_spend decimal(18,2) NOT NULL,
  channel_mix json,
  cac decimal(18,2) NOT NULL,
  ltv decimal(18,2) NOT NULL,
  margins decimal(5,4),
  payload json,
  created_at timestamp NOT NULL DEFAULT (now()),
  updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS channel_spend_snapshots (
  id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  client_id varchar(36) NOT NULL DEFAULT '',
  trust_id varchar(36) NOT NULL DEFAULT '',
  profile_id varchar(36) NULL,
  month varchar(7) NOT NULL,
  channel varchar(64) NOT NULL,
  spend decimal(18,2) NOT NULL,
  revenue_attributed decimal(18,2) NULL,
  roas decimal(10,4) NULL,
  created_at timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(id),
  UNIQUE KEY chspend_workspace_month_channel_uidx (user_id, client_id, trust_id, month, channel)
);
CREATE TABLE IF NOT EXISTS revenue_os_funnel_deployment_runs (
  id varchar(36) NOT NULL,
  funnel_id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  client_id varchar(36) NOT NULL DEFAULT '',
  trust_id varchar(36) NOT NULL DEFAULT '',
  provider varchar(32) NOT NULL DEFAULT 'artifact',
  mode varchar(32) NOT NULL DEFAULT 'stored',
  status varchar(24) NOT NULL,
  result_summary json,
  error_message text,
  started_at timestamp NOT NULL DEFAULT (now()),
  finished_at timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(id),
  KEY revos_funnel_run_funnel_idx (funnel_id),
  KEY revos_funnel_run_user_client_idx (user_id, client_id)
);
CREATE TABLE IF NOT EXISTS revenue_os_sequence_execution_runs (
  id varchar(36) NOT NULL,
  sequence_id varchar(36) NOT NULL,
  user_id varchar(64) NOT NULL,
  client_id varchar(36) NOT NULL DEFAULT '',
  trust_id varchar(36) NOT NULL DEFAULT '',
  provider varchar(32) NOT NULL DEFAULT 'none',
  mode varchar(32) NOT NULL,
  status varchar(24) NOT NULL,
  result_summary json,
  error_message text,
  started_at timestamp NOT NULL DEFAULT (now()),
  finished_at timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(id),
  KEY revos_seq_run_seq_idx (sequence_id),
  KEY revos_seq_run_user_client_idx (user_id, client_id)
);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const conn = await mysql.createConnection(url.split("?")[0]);
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    if (stmt) {
      await conn.execute(stmt + ";");
      const table = stmt.match(/CREATE TABLE IF NOT EXISTS\s+(\S+)/)?.[1];
      console.log("OK:", table ?? "statement");
    }
  }
  await conn.end();
  console.log("Revenue OS tables applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
