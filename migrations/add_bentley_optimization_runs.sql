-- Bentley closed-loop optimization: durable runs + campaign lineage (child campaigns).
CREATE TABLE IF NOT EXISTS bentley_optimization_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(36) NOT NULL DEFAULT '',
  campaign_id VARCHAR(36) NOT NULL,
  parent_campaign_id VARCHAR(36) NULL,
  bentley_run_id VARCHAR(128) NULL,
  optimization_key VARCHAR(128) NOT NULL,
  post_ids_json JSON NULL,
  source_metrics_summary_json JSON NOT NULL,
  result_json JSON NOT NULL,
  execution_mode VARCHAR(24) NOT NULL,
  child_campaign_id VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX bentley_opt_campaign_idx (campaign_id),
  INDEX bentley_opt_parent_idx (parent_campaign_id),
  UNIQUE KEY bentley_opt_idempotency_uidx (campaign_id, optimization_key)
);

ALTER TABLE campaigns
  ADD COLUMN derived_from_campaign_id VARCHAR(36) NULL,
  ADD COLUMN bentley_optimization_run_id VARCHAR(36) NULL;

CREATE INDEX campaigns_derived_from_idx ON campaigns (derived_from_campaign_id);
