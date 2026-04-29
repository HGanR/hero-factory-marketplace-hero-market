/* =========================================================
Parent Company + C-Corp Wizard — Production Migration (MySQL)
Aligned with actual Drizzle schema.ts definitions
- Safe, idempotent, explicit
========================================================= */

START TRANSACTION;

-- 1) Core companies table (aligned with schema.ts)
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,          -- UUID
  userId INT NOT NULL,                          -- FK to users.id - ownership isolation

  companyName VARCHAR(255) NOT NULL,
  formationState VARCHAR(2) NOT NULL,           -- US state code
  companyKind ENUM('parent_holding_company', 'operating_company') NOT NULL,
  corpType ENUM('c_corp', 's_corp', 'llc', 'unknown') NOT NULL,
  parentStructure ENUM('single_parent_single_sub', 'single_parent_multi_sub', 'parent_only', 'unknown') NOT NULL,

  -- Formation details
  registeredAgentPlanned BOOLEAN DEFAULT FALSE,
  authorizedShares INT NULL,
  parValue DECIMAL(10,6) NULL,                  -- e.g., 0.00001
  fiscalYearEndMonth INT NULL,                  -- 1-12

  -- Governance
  boardSize INT NULL,
  officersPlanned BOOLEAN DEFAULT TRUE,
  initialBoardConsentPlanned BOOLEAN DEFAULT TRUE,

  -- Status and metadata
  publicCompanyId VARCHAR(20) NULL,             -- e.g., "COMP-DE-2026-0001"
  status ENUM('draft', 'counsel_reviewed', 'board_adopted', 'execution_ready') DEFAULT 'draft' NOT NULL,
  draftJson TEXT NULL,                          -- Store the full ParentCorpDraft as JSON

  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_companies_publicCompanyId (publicCompanyId),
  KEY idx_companies_userId (userId),
  KEY idx_companies_formationState (formationState),
  KEY idx_companies_status (status),

  CONSTRAINT fk_companies_userId
    FOREIGN KEY (userId) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Company affiliations (aligned with schema.ts)
CREATE TABLE IF NOT EXISTS company_affiliations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,          -- UUID
  userId INT NOT NULL,                          -- FK to users.id - ensure both entities belong to same user

  affiliationType ENUM('parent_subsidiary', 'company_trust', 'company_family_office', 'company_foundation', 'company_dao') NOT NULL,

  parentCompanyId VARCHAR(36) NOT NULL,         -- FK to companies.id
  subsidiaryCompanyId VARCHAR(36) NULL,         -- FK to companies.id (for parent_subsidiary)
  trustId VARCHAR(36) NULL,                     -- FK to trusts.id (for company_trust)
  familyOfficeId VARCHAR(36) NULL,              -- FK to family_offices.id
  foundationId VARCHAR(36) NULL,                -- FK to foundations.id

  -- For parent_subsidiary type
  subsidiaryKind ENUM('operating', 'ip_holdco', 'real_estate', 'other') NULL,
  ownershipPercentage INT NULL,                 -- 1-100, default 100
  notes TEXT NULL,

  -- Relationship metadata
  relationshipRole VARCHAR(100) NULL,           -- e.g., "operating_subsidiary", "beneficiary", "sponsor"
  createdBy INT NOT NULL,                       -- userId who created this affiliation

  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  KEY idx_company_affiliations_userId (userId),
  KEY idx_company_affiliations_parentCompanyId (parentCompanyId),
  KEY idx_company_affiliations_subsidiaryCompanyId (subsidiaryCompanyId),
  KEY idx_company_affiliations_trustId (trustId),
  KEY idx_company_affiliations_affiliationType (affiliationType),

  -- Prevent duplicate affiliations (unique per user+parent+target)
  UNIQUE KEY uq_company_affiliations_user_parent_subsidiary (userId, parentCompanyId, subsidiaryCompanyId),
  UNIQUE KEY uq_company_affiliations_user_parent_trust (userId, parentCompanyId, trustId),
  UNIQUE KEY uq_company_affiliations_user_parent_family_office (userId, parentCompanyId, familyOfficeId),
  UNIQUE KEY uq_company_affiliations_user_parent_foundation (userId, parentCompanyId, foundationId),

  CONSTRAINT fk_company_affiliations_parentCompanyId
    FOREIGN KEY (parentCompanyId) REFERENCES companies(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_company_affiliations_subsidiaryCompanyId
    FOREIGN KEY (subsidiaryCompanyId) REFERENCES companies(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_company_affiliations_trustId
    FOREIGN KEY (trustId) REFERENCES trusts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Company sequences (aligned with schema.ts)
CREATE TABLE IF NOT EXISTS company_sequences (
  id VARCHAR(36) NOT NULL PRIMARY KEY,          -- UUID
  scope VARCHAR(191) NOT NULL,                  -- e.g., "COMPANY:DE:2026", "CERTIFICATE:DE:2026"
  currentValue INT NOT NULL DEFAULT 0,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_company_sequences_scope (scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

/* =========================================================
POST-MIGRATION VERIFICATION QUERIES
Run these after migration and test flows to validate claims
========================================================= */

/*
A) Public IDs are unique (no duplicates)
Expected: 0 rows
*/
SELECT publicCompanyId, COUNT(*) as duplicate_count
FROM companies
WHERE publicCompanyId IS NOT NULL
GROUP BY publicCompanyId
HAVING duplicate_count > 1;

/*
B) No duplicate affiliations (enforce uniqueness constraints)
Expected: 0 rows
*/
-- Check for parent-subsidiary duplicates
SELECT userId, parentCompanyId, subsidiaryCompanyId, COUNT(*) as duplicate_count
FROM company_affiliations
WHERE subsidiaryCompanyId IS NOT NULL
GROUP BY userId, parentCompanyId, subsidiaryCompanyId
HAVING duplicate_count > 1;

-- Check for company-trust duplicates
SELECT userId, parentCompanyId, trustId, COUNT(*) as duplicate_count
FROM company_affiliations
WHERE trustId IS NOT NULL
GROUP BY userId, parentCompanyId, trustId
HAVING duplicate_count > 1;

/*
C) Sequence monotonic sanity (values should increase predictably)
Expected: sequences increase over time per scope
*/
SELECT scope, currentValue, updatedAt
FROM company_sequences
ORDER BY updatedAt DESC
LIMIT 20;

/*
D) Ownership isolation verification (sample check)
Expected: Each user should only see their own companies
*/
SELECT userId, COUNT(*) as company_count
FROM companies
GROUP BY userId
ORDER BY userId;

/*
E) Affiliation ownership boundary check
Expected: All affiliations should have matching userId on both sides
*/
SELECT
  ca.id as affiliation_id,
  ca.userId as affiliation_user,
  c1.userId as parent_user,
  c2.userId as subsidiary_user
FROM company_affiliations ca
LEFT JOIN companies c1 ON ca.parentCompanyId = c1.id
LEFT JOIN companies c2 ON ca.subsidiaryCompanyId = c2.id
WHERE ca.userId != c1.userId
   OR (c2.id IS NOT NULL AND ca.userId != c2.userId);








