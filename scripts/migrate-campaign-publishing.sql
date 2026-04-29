-- Campaign Publishing (Blueprint → Launch)
-- Run: mysql $DATABASE_URL < scripts/migrate-campaign-publishing.sql

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(36) NOT NULL DEFAULT '',
  name VARCHAR(200) NOT NULL,
  objective VARCHAR(200),
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  start_at TIMESTAMP NULL,
  end_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX camp_user_idx (user_id),
  INDEX camp_status_idx (status)
);

CREATE TABLE IF NOT EXISTS campaign_assets (
  id VARCHAR(36) PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL,
  creative_type VARCHAR(24) NOT NULL,
  storage_url VARCHAR(512),
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX campasset_campaign_idx (campaign_id)
);

CREATE TABLE IF NOT EXISTS campaign_posts (
  id VARCHAR(36) PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL,
  asset_id VARCHAR(36),
  platform VARCHAR(24) NOT NULL,
  scheduled_at TIMESTAMP NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  caption TEXT,
  hashtags VARCHAR(1000),
  link_url VARCHAR(512),
  utm_params JSON,
  platform_post_id VARCHAR(120),
  error_message TEXT,
  posted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX campost_campaign_idx (campaign_id),
  INDEX campost_platform_idx (platform),
  INDEX campost_status_idx (status),
  INDEX campost_scheduled_idx (scheduled_at)
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(36) NOT NULL DEFAULT '',
  platform VARCHAR(24) NOT NULL,
  auth_type VARCHAR(24) NOT NULL DEFAULT 'OAUTH',
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  expires_at TIMESTAMP NULL,
  external_account_id VARCHAR(120),
  scopes VARCHAR(500),
  display_name VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX socacc_user_platform_uidx (user_id, client_id, platform)
);

CREATE TABLE IF NOT EXISTS campaign_audit_events (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  post_id VARCHAR(36),
  action VARCHAR(80) NOT NULL,
  platform VARCHAR(24),
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX campaudit_user_idx (user_id),
  INDEX campaudit_post_idx (post_id),
  INDEX campaudit_created_idx (created_at)
);
