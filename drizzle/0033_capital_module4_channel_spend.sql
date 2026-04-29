-- Module 4: channel spend actuals + capital plan listing indexes (idempotent ALTERs).

ALTER TABLE `channel_spend_snapshots`
  ADD COLUMN `trust_id` VARCHAR(36) NOT NULL DEFAULT '' AFTER `client_id`,
  ADD COLUMN `profile_id` VARCHAR(36) NULL AFTER `trust_id`,
  ADD COLUMN `revenue_attributed` DECIMAL(18,2) NULL AFTER `spend`,
  ADD COLUMN `roas` DECIMAL(10,4) NULL AFTER `revenue_attributed`;

CREATE UNIQUE INDEX `chspend_workspace_month_channel_uidx` ON `channel_spend_snapshots` (
  `user_id`,
  `client_id`,
  `trust_id`,
  `month`,
  `channel`
);

CREATE INDEX `capital_plan_user_client_month_idx` ON `capital_plans` (`user_id`, `client_id`, `snapshot_month`);
CREATE INDEX `capital_plan_user_client_created_idx` ON `capital_plans` (`user_id`, `client_id`, `created_at`);
