-- Add phone and smsConsent to marketplace_users (run manually if needed)
ALTER TABLE `marketplace_users` ADD COLUMN IF NOT EXISTS `phone` varchar(24);
ALTER TABLE `marketplace_users` ADD COLUMN IF NOT EXISTS `smsConsent` boolean NOT NULL DEFAULT false;
