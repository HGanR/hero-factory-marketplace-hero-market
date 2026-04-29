-- Create revenue_os_experiments table for Phase IV: Performance Memory & Experiment Tracking
-- Run: mysql $DATABASE_URL < scripts/migrate-revenue-os-experiments.sql

CREATE TABLE IF NOT EXISTS revenue_os_experiments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(36) NOT NULL DEFAULT '',
  trust_id VARCHAR(36) NOT NULL DEFAULT '',
  name VARCHAR(200) NOT NULL,
  lever VARCHAR(32) NOT NULL,
  hypothesis TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  input_snapshot JSON,
  result_snapshot JSON,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX revosxp_user_idx (user_id),
  INDEX revosxp_status_idx (status)
);
