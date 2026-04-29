-- Part 52: cross-run Meta Marketing API sync cooldown per ad account (provider-scoped).
CREATE TABLE IF NOT EXISTS paid_social_sync_backoff_state (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  account_key VARCHAR(128) NOT NULL,
  backoff_until DATETIME(3) NULL,
  last_failure_category VARCHAR(32) NULL,
  consecutive_throttle_count INT NOT NULL DEFAULT 0,
  last_failure_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_paid_sync_backoff_provider_account (provider, account_key),
  KEY idx_paid_sync_backoff_until (backoff_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
