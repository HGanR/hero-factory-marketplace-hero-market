-- Add publicId and publicIdIssuedAt fields to trusts table
-- These fields provide unique, immutable Trust IDs for certificates and instruments

ALTER TABLE trusts
ADD COLUMN publicId VARCHAR(40) NULL,
ADD COLUMN publicIdIssuedAt TIMESTAMP NULL;

-- Add unique index on publicId to ensure uniqueness
ALTER TABLE trusts
ADD UNIQUE INDEX idx_trusts_publicId (publicId);

-- Note: Existing trusts will have NULL publicId until explicitly assigned
-- This is intentional - public IDs should only be assigned when needed







