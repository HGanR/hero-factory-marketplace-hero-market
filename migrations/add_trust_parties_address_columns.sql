-- Add address columns to trust_parties table
-- The original migration created trust_parties without these columns;
-- run this once. If columns already exist, these will fail (safe to ignore).

ALTER TABLE trust_parties ADD COLUMN addressLine1 VARCHAR(255) NULL;
ALTER TABLE trust_parties ADD COLUMN addressLine2 VARCHAR(255) NULL;
ALTER TABLE trust_parties ADD COLUMN city VARCHAR(120) NULL;
ALTER TABLE trust_parties ADD COLUMN state VARCHAR(40) NULL;
ALTER TABLE trust_parties ADD COLUMN postalCode VARCHAR(20) NULL;
ALTER TABLE trust_parties ADD COLUMN country VARCHAR(2) NULL DEFAULT 'US';
