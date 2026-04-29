-- Migration: Add client_id and trust_id to Revenue OS tables for workspace/Trust ID binding
-- Run AFTER drizzle-kit push (or run manually if push fails)
-- Backward compatible: columns are optional; "" or NULL for standalone mode

-- revenue_os_monthly_snapshots: add workspace columns and new unique index
ALTER TABLE revenue_os_monthly_snapshots
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trust_id VARCHAR(36) NOT NULL DEFAULT '';

-- Backfill existing rows (in case default didn't apply)
UPDATE revenue_os_monthly_snapshots SET client_id = '' WHERE client_id IS NULL;
UPDATE revenue_os_monthly_snapshots SET trust_id = '' WHERE trust_id IS NULL;

-- Drop old unique if exists, add new composite unique
-- (Run only if migrating from pre-workspace schema)
-- ALTER TABLE revenue_os_monthly_snapshots DROP INDEX snap_user_month_unique;
-- ALTER TABLE revenue_os_monthly_snapshots ADD UNIQUE INDEX snap_user_workspace_month_uidx (user_id, client_id, trust_id, month);
