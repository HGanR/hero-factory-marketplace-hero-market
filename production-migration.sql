-- ============================================
-- Production Database Migration Script
-- Hero Factory Marketplace - Religious Organization & Trust Protector
-- Migration Date: January 3, 2026
-- ============================================

-- IMPORTANT: Run this script in your PRODUCTION MySQL database
-- BACKUP FIRST: mysqldump -u [username] -p [database] > backup_pre_migration.sql

-- ============================================
-- Phase 1: Extend Existing Tables
-- ============================================

-- Add new columns to trusts table
ALTER TABLE trusts
ADD COLUMN publicId VARCHAR(40) COMMENT 'Public trust identifier (TID-STATE-YEAR-SEQ)',
ADD COLUMN authorityStatus ENUM('not_confirmed', 'confirmed', 'generated_draft') DEFAULT 'not_confirmed' COMMENT 'Trust authority confirmation status',
ADD COLUMN authorityJson TEXT COMMENT 'Authority checklist and metadata JSON';

-- Verify trusts table changes
SELECT 'trusts table columns' as check_type,
       COUNT(*) as column_count
FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'trusts'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('publicId', 'authorityStatus', 'authorityJson');

-- ============================================
-- Phase 2: Create Sequences Table (REQUIRED)
-- ============================================

CREATE TABLE workflow_sequences (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  scope VARCHAR(191) NOT NULL UNIQUE COMMENT 'Sequence scope (e.g., CLIENT:2026, TRUST:DE:2026)',
  currentValue INT NOT NULL DEFAULT 0 COMMENT 'Current sequence value',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sequence number allocation for IDs (CID, TID, certificates, etc.)';

-- ============================================
-- Phase 3: Create Governance Assignments Table
-- ============================================

CREATE TABLE governance_assignments (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  entityType ENUM('trust', 'family_office', 'foundation', 'dao_wrapper') NOT NULL COMMENT 'Type of entity being governed',
  entityId VARCHAR(36) NOT NULL COMMENT 'UUID of the entity',
  clientProfileId VARCHAR(36) NOT NULL COMMENT 'UUID of assigned client profile',
  role ENUM('trustee', 'trust_protector', 'committee_member', 'counsel_reviewer') NOT NULL COMMENT 'Governance role',
  powersJson TEXT NOT NULL COMMENT 'JSON array of granted powers',
  triggersJson TEXT COMMENT 'JSON object of activation conditions',
  status ENUM('active', 'inactive', 'pending_approval') DEFAULT 'active' NOT NULL COMMENT 'Assignment status',
  assignedBy INT NOT NULL COMMENT 'User ID who made the assignment',
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Assignment timestamp',
  activatedAt TIMESTAMP NULL COMMENT 'When triggers activated the role',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Trust Protector and governance role assignments';

-- ============================================
-- Phase 4: Create Workflow Tables
-- ============================================

CREATE TABLE workflow_client_profiles (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  userId INT NOT NULL COMMENT 'Auth user ID',
  publicId VARCHAR(32) NOT NULL UNIQUE COMMENT 'Public client ID (CID-2026-XXXXX)',
  fullName VARCHAR(255) COMMENT 'Client full name',
  email VARCHAR(255) COMMENT 'Client email address',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Client profiles for workflow management';

CREATE TABLE workflow_trust_assets (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  trustId VARCHAR(36) NOT NULL COMMENT 'Associated trust UUID',
  type VARCHAR(40) NOT NULL COMMENT 'Asset type (real estate, securities, etc.)',
  name VARCHAR(255) NOT NULL COMMENT 'Asset name',
  identifier VARCHAR(191) COMMENT 'Asset identifier (VIN, account number, etc.)',
  valuationUSD INT COMMENT 'Asset valuation in USD cents',
  valuationAsOf VARCHAR(24) COMMENT 'Valuation date (YYYY-MM-DD)',
  encumbrances TEXT COMMENT 'Any liens or encumbrances',
  evidenceNotes TEXT COMMENT 'Evidence and documentation notes',
  status ENUM('recorded', 'certificated', 'pledged', 'archived') DEFAULT 'recorded' COMMENT 'Asset status in workflow',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Trust assets in workflow management';

CREATE TABLE workflow_asset_certificates (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  trustId VARCHAR(36) NOT NULL COMMENT 'Associated trust UUID',
  assetId VARCHAR(36) NOT NULL COMMENT 'Associated asset UUID',
  certificateNumber VARCHAR(80) NOT NULL UNIQUE COMMENT 'Certificate number (AC-TID-2026-XXXX)',
  certificateClass VARCHAR(80) DEFAULT 'Unit' COMMENT 'Certificate class',
  units INT DEFAULT 1 COMMENT 'Number of units',
  restrictionsJson TEXT COMMENT 'Certificate restrictions JSON',
  trustDocumentId VARCHAR(36) COMMENT 'Associated trust document UUID',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Asset certificates in workflow';

CREATE TABLE workflow_promissory_notes (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  trustId VARCHAR(36) NOT NULL COMMENT 'Associated trust UUID',
  certificateId VARCHAR(36) NOT NULL COMMENT 'Associated certificate UUID',
  noteNumber VARCHAR(80) NOT NULL UNIQUE COMMENT 'Note number (PN-TID-2026-XXXX)',
  issuerName VARCHAR(255) NOT NULL COMMENT 'Note issuer name',
  principalAmountCents INT NOT NULL COMMENT 'Principal amount in cents',
  interestRateBps INT COMMENT 'Interest rate in basis points',
  paymentTerms TEXT NOT NULL COMMENT 'Payment terms',
  maturityDate VARCHAR(24) NOT NULL COMMENT 'Maturity date (YYYY-MM-DD)',
  governingLawState VARCHAR(10) COMMENT 'Governing law state code',
  trustDocumentId VARCHAR(36) COMMENT 'Associated trust document UUID',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Promissory notes in workflow';

CREATE TABLE workflow_security_agreements (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  trustId VARCHAR(36) NOT NULL COMMENT 'Associated trust UUID',
  certificateId VARCHAR(36) NOT NULL COMMENT 'Associated certificate UUID',
  noteId VARCHAR(36) COMMENT 'Associated note UUID (optional)',
  agreementNumber VARCHAR(80) NOT NULL UNIQUE COMMENT 'Agreement number (SA-TID-2026-XXXX)',
  debtorName VARCHAR(255) NOT NULL COMMENT 'Debtor name',
  collateralDescription TEXT NOT NULL COMMENT 'Collateral description',
  governingLawState VARCHAR(10) COMMENT 'Governing law state code',
  trustDocumentId VARCHAR(36) COMMENT 'Associated trust document UUID',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Security agreements in workflow';

CREATE TABLE workflow_presentation_packages (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  trustId VARCHAR(36) NOT NULL COMMENT 'Associated trust UUID',
  packageNumber VARCHAR(80) NOT NULL UNIQUE COMMENT 'Package number (PKG-TID-2026-XXXX)',
  status ENUM('draft', 'ready_for_review', 'approved', 'archived') DEFAULT 'draft' COMMENT 'Package status',
  includedJson TEXT NOT NULL COMMENT 'Included items JSON',
  pitchDeckTrustDocumentId VARCHAR(36) COMMENT 'Pitch deck document UUID',
  offeringId VARCHAR(36) COMMENT 'Associated offering UUID',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Presentation packages for offerings';

-- ============================================
-- Phase 5: Create Indexes
-- ============================================

-- Governance assignments indexes
CREATE INDEX idx_governance_assignments_entity ON governance_assignments(entityType, entityId)
  COMMENT 'Index for entity-based governance queries';
CREATE INDEX idx_governance_assignments_client ON governance_assignments(clientProfileId)
  COMMENT 'Index for client profile governance queries';
CREATE INDEX idx_governance_assignments_status ON governance_assignments(status, entityType)
  COMMENT 'Index for active governance queries';

-- Workflow sequences index
CREATE INDEX idx_workflow_sequences_scope ON workflow_sequences(scope)
  COMMENT 'Index for sequence scope lookups';

-- Workflow trust assets index
CREATE INDEX idx_workflow_trust_assets_trust ON workflow_trust_assets(trustId, status)
  COMMENT 'Index for trust asset queries';

-- Workflow certificates indexes
CREATE INDEX idx_workflow_certificates_trust ON workflow_asset_certificates(trustId)
  COMMENT 'Index for trust certificate queries';
CREATE INDEX idx_workflow_certificates_asset ON workflow_asset_certificates(assetId)
  COMMENT 'Index for asset certificate queries';

-- Workflow notes indexes
CREATE INDEX idx_workflow_notes_trust ON workflow_promissory_notes(trustId)
  COMMENT 'Index for trust note queries';
CREATE INDEX idx_workflow_notes_certificate ON workflow_promissory_notes(certificateId)
  COMMENT 'Index for certificate note queries';

-- Workflow agreements indexes
CREATE INDEX idx_workflow_agreements_trust ON workflow_security_agreements(trustId)
  COMMENT 'Index for trust agreement queries';
CREATE INDEX idx_workflow_agreements_certificate ON workflow_security_agreements(certificateId)
  COMMENT 'Index for certificate agreement queries';

-- Workflow packages index
CREATE INDEX idx_workflow_packages_trust ON workflow_presentation_packages(trustId, status)
  COMMENT 'Index for trust package queries';

-- ============================================
-- Phase 6: Verification Queries
-- ============================================

-- Count all new tables
SELECT 'Total new tables created' as verification_check,
       COUNT(*) as table_count
FROM information_schema.TABLES
WHERE TABLE_NAME IN (
  'workflow_sequences',
  'governance_assignments',
  'workflow_client_profiles',
  'workflow_trust_assets',
  'workflow_asset_certificates',
  'workflow_promissory_notes',
  'workflow_security_agreements',
  'workflow_presentation_packages'
)
AND TABLE_SCHEMA = DATABASE();

-- Count all new indexes
SELECT 'Total new indexes created' as verification_check,
       COUNT(*) as index_count
FROM information_schema.STATISTICS
WHERE TABLE_NAME IN (
  'governance_assignments',
  'workflow_sequences',
  'workflow_trust_assets',
  'workflow_asset_certificates',
  'workflow_promissory_notes',
  'workflow_security_agreements',
  'workflow_presentation_packages'
)
AND TABLE_SCHEMA = DATABASE()
AND INDEX_NAME LIKE 'idx_%';

-- Check trusts table extensions
SELECT 'Trusts table new columns' as verification_check,
       GROUP_CONCAT(COLUMN_NAME SEPARATOR ', ') as columns_added
FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'trusts'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('publicId', 'authorityStatus', 'authorityJson');

-- ============================================
-- Migration Complete
-- ============================================

-- Log completion
SELECT 'Migration completed successfully' as status,
       NOW() as completion_timestamp,
       USER() as executed_by;

-- Final verification summary
SELECT
  'Migration Verification Summary' as title,
  CONCAT(
    'Tables created: ', (
      SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_NAME IN (
        'workflow_sequences', 'governance_assignments', 'workflow_client_profiles',
        'workflow_trust_assets', 'workflow_asset_certificates', 'workflow_promissory_notes',
        'workflow_security_agreements', 'workflow_presentation_packages'
      ) AND TABLE_SCHEMA = DATABASE()
    ),
    ' | Trusts columns added: ', (
      SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_NAME = 'trusts' AND TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME IN ('publicId', 'authorityStatus', 'authorityJson')
    ),
    ' | Indexes created: ', (
      SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_NAME IN (
        'governance_assignments', 'workflow_sequences', 'workflow_trust_assets',
        'workflow_asset_certificates', 'workflow_promissory_notes', 'workflow_security_agreements',
        'workflow_presentation_packages'
      ) AND TABLE_SCHEMA = DATABASE() AND INDEX_NAME LIKE 'idx_%'
    )
  ) as summary;








