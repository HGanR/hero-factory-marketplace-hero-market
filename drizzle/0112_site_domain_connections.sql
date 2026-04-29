-- Site Builder: custom domain / Freename Web3 connection tracking (Vercel + DNS verification).
-- Runtime ensure: `ensureSiteDomainConnectionsTable` in `src/lib/site-builder/db.ts`

CREATE TABLE IF NOT EXISTS site_domain_connections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  siteId VARCHAR(36) NOT NULL,
  clientId VARCHAR(36) NULL,
  ownerUserId INT NOT NULL,
  domain VARCHAR(255) NOT NULL,
  domainType VARCHAR(24) NOT NULL,
  provider VARCHAR(24) NOT NULL,
  targetUrl VARCHAR(2000) NOT NULL,
  vercelProjectId VARCHAR(120) NULL,
  vercelDeploymentUrl VARCHAR(2000) NULL,
  status VARCHAR(32) NOT NULL,
  verificationMethod VARCHAR(64) NULL,
  requiredRecordsJson TEXT NULL,
  lastCheckedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY uq_sdc_site (siteId),
  INDEX idx_sdc_owner (ownerUserId),
  INDEX idx_sdc_client (clientId),
  INDEX idx_sdc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
