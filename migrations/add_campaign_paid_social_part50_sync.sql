-- Part 50: Meta sync/readback, runtime status, paid analytics snapshots (append-only).
ALTER TABLE campaign_paid_social_campaigns
  ADD COLUMN meta_runtime_status VARCHAR(24) NULL,
  ADD COLUMN last_meta_status_json JSON NULL,
  ADD COLUMN last_meta_sync_error_json JSON NULL;

CREATE TABLE IF NOT EXISTS campaign_paid_social_analytics_snapshots (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  campaign_paid_social_campaign_id VARCHAR(36) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  metrics_json JSON NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY camp_paid_soc_analytics_paid_fetched_idx (campaign_paid_social_campaign_id, fetched_at),
  KEY camp_paid_soc_analytics_provider_idx (provider, fetched_at)
);
