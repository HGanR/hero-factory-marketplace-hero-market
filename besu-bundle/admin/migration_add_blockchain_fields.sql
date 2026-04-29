/**
 * Database Migration: Add Blockchain Fields to Trust Records
 * 
 * This migration adds the following fields to the trust_records table:
 * - blockchain_status: Current status of blockchain recording
 * - transaction_hash: Hash of the blockchain transaction
 * - block_number: Block number where transaction was recorded
 * - contract_address: Address of the smart contract
 * - verification_timestamp: When the verification was completed
 * 
 * Migration Type: SQLite (with Prisma schema)
 * Direction: Up
 * 
 * Run with: npx prisma migrate dev --name add_blockchain_fields
 */

-- ============================================================================
-- Add Blockchain Status Column
-- ============================================================================

-- Status values: 'not_recorded', 'pending', 'syncing', 'verified', 'failed'
ALTER TABLE trust_records ADD COLUMN blockchain_status VARCHAR(50) DEFAULT 'not_recorded';

-- ============================================================================
-- Add Transaction Hash Column
-- ============================================================================

-- Stores the Ethereum transaction hash (0x...)
-- Nullable because not all records will be on blockchain initially
ALTER TABLE trust_records ADD COLUMN transaction_hash VARCHAR(255);

-- ============================================================================
-- Add Block Number Column
-- ============================================================================

-- Stores the block number where the transaction was recorded
-- Nullable until transaction is confirmed
ALTER TABLE trust_records ADD COLUMN block_number INTEGER;

-- ============================================================================
-- Add Contract Address Column
-- ============================================================================

-- Stores the address of the smart contract that recorded the instrument
-- Nullable until recorded on blockchain
ALTER TABLE trust_records ADD COLUMN contract_address VARCHAR(255);

-- ============================================================================
-- Add Verification Timestamp Column
-- ============================================================================

-- Stores when the verification was completed
-- Nullable until verification is done
ALTER TABLE trust_records ADD COLUMN verification_timestamp DATETIME;

-- ============================================================================
-- Create Indexes for Performance
-- ============================================================================

-- Index on blockchain_status for quick filtering
CREATE INDEX idx_trust_records_blockchain_status 
ON trust_records(blockchain_status);

-- Index on transaction_hash for quick lookup
CREATE INDEX idx_trust_records_transaction_hash 
ON trust_records(transaction_hash);

-- Index on verification_timestamp for sorting
CREATE INDEX idx_trust_records_verification_timestamp 
ON trust_records(verification_timestamp);

-- ============================================================================
-- Add is_verified Column (Boolean)
-- ============================================================================

-- Stores whether the trust has been verified on blockchain
-- 0 = not verified, 1 = verified
ALTER TABLE trust_records ADD COLUMN is_verified INTEGER DEFAULT 0;

-- ============================================================================
-- Create View for Verified Trusts
-- ============================================================================

-- Useful view for querying only verified trusts
CREATE VIEW verified_trusts AS
SELECT 
    id,
    user_id,
    name,
    amount,
    beneficiary,
    maturity_date,
    terms,
    created_at,
    blockchain_status,
    transaction_hash,
    block_number,
    contract_address,
    verification_timestamp,
    is_verified
FROM trust_records
WHERE blockchain_status = 'verified' AND is_verified = 1;

-- ============================================================================
-- Create View for Pending Verifications
-- ============================================================================

-- Useful view for querying trusts pending verification
CREATE VIEW pending_verifications AS
SELECT 
    id,
    user_id,
    name,
    amount,
    beneficiary,
    maturity_date,
    terms,
    created_at,
    blockchain_status,
    transaction_hash
FROM trust_records
WHERE blockchain_status IN ('pending', 'syncing');

-- ============================================================================
-- Create View for Failed Verifications
-- ============================================================================

-- Useful view for querying failed verifications
CREATE VIEW failed_verifications AS
SELECT 
    id,
    user_id,
    name,
    amount,
    beneficiary,
    maturity_date,
    terms,
    created_at,
    blockchain_status,
    transaction_hash
FROM trust_records
WHERE blockchain_status = 'failed';

-- ============================================================================
-- Update Existing Records (Optional)
-- ============================================================================

-- If you have existing records, you may want to set their status
-- Uncomment if needed:
-- UPDATE trust_records 
-- SET blockchain_status = 'not_recorded' 
-- WHERE blockchain_status IS NULL;

-- ============================================================================
-- Verify Migration
-- ============================================================================

-- Check that columns were added successfully
-- SELECT 
--     name,
--     type
-- FROM pragma_table_info('trust_records')
-- WHERE name IN (
--     'blockchain_status',
--     'transaction_hash',
--     'block_number',
--     'contract_address',
--     'verification_timestamp',
--     'is_verified'
-- );
