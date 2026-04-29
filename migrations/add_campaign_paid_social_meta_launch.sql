-- Part 49: Meta Ads execution state + linkage on paid social drafts.
ALTER TABLE campaign_paid_social_campaigns
  ADD COLUMN meta_ad_account_id VARCHAR(64) NULL,
  ADD COLUMN meta_page_id VARCHAR(64) NULL,
  ADD COLUMN meta_facebook_social_account_id VARCHAR(36) NULL,
  ADD COLUMN meta_launch_status VARCHAR(24) NOT NULL DEFAULT 'idle',
  ADD COLUMN remote_meta_campaign_id VARCHAR(64) NULL,
  ADD COLUMN remote_meta_adset_id VARCHAR(64) NULL,
  ADD COLUMN remote_meta_creative_id VARCHAR(64) NULL,
  ADD COLUMN remote_meta_ad_id VARCHAR(64) NULL,
  ADD COLUMN last_launch_error_json JSON NULL,
  ADD COLUMN launched_at TIMESTAMP NULL,
  ADD COLUMN last_meta_sync_at TIMESTAMP NULL;
