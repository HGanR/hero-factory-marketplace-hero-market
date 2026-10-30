-- Test-database schema for the SMART TRUST Mobile protected Preview.
--
-- Source: src/lib/db/schema.ts, `marketplaceUsers` (table `marketplace_users`),
-- transcribed from branch feat/smart-trust-mobile-preview-20261026 at
-- e26b3dd932fec6b627a5a675725047e381343957. The login route selects the
-- entire row (SELECT *), so the COMPLETE column definition is preserved
-- here. The definition carries no foreign keys, and both inspected
-- login/profile routes touch only this table, so no other table is
-- required for the preview login path.
--
-- Status: NOT RUN. Not executed against any database. Review this file
-- against the schema source before first use. Index names below are
-- local to this test schema; Drizzle-generated names may differ — the
-- uniqueness behavior is what matters.
--
-- Apply only to an ISOLATED test database. Never to production.

CREATE TABLE IF NOT EXISTS `marketplace_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(320) NOT NULL,
  `username` varchar(100) NOT NULL,
  `passwordHash` varchar(255) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 0,
  `isApproved` tinyint(1) NOT NULL DEFAULT 0,
  `walletAddress` varchar(42) DEFAULT NULL,
  `hasTokenAccess` tinyint(1) NOT NULL DEFAULT 0,
  `phone` varchar(24) DEFAULT NULL,
  `smsConsent` tinyint(1) NOT NULL DEFAULT 0,
  `revenueOsAccess` tinyint(1) NOT NULL DEFAULT 1,
  `lastActiveTrustId` varchar(36) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastLogin` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `marketplace_users_email_unique` (`email`),
  UNIQUE KEY `marketplace_users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
