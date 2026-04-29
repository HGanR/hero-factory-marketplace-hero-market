/**
 * Updated TrustRecord Types with Blockchain Verification Fields
 * 
 * File: server/types/trust.ts
 * 
 * This file contains the updated TrustRecord interface and related types
 * that include blockchain verification fields for querying verified trusts.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Blockchain status enum
 */
export const BlockchainStatusSchema = z.enum([
  'not_recorded',
  'recording',
  'recorded',
  'verified',
  'failed',
]);

export type BlockchainStatus = z.infer<typeof BlockchainStatusSchema>;

/**
 * TrustRecord input schema (for creating/updating)
 */
export const TrustRecordInputSchema = z.object({
  trustName: z.string().min(1).max(255),
  amount: z.number().positive(),
  beneficiary: z.string().min(1).max(255),
  maturityDate: z.date(),
  terms: z.string().min(1),
});

export type TrustRecordInput = z.infer<typeof TrustRecordInputSchema>;

/**
 * TrustRecord output schema (for responses)
 */
export const TrustRecordOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  trustName: z.string(),
  amount: z.number(),
  beneficiary: z.string(),
  maturityDate: z.date(),
  terms: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),

  // Blockchain verification fields
  blockchainStatus: BlockchainStatusSchema,
  transactionHash: z.string().nullable(),
  blockNumber: z.number().nullable(),
  contractAddress: z.string().nullable(),
  verificationTimestamp: z.date().nullable(),
  isVerified: z.boolean(),
  verificationAttempts: z.number(),
  lastVerificationAttempt: z.date().nullable(),
});

export type TrustRecordOutput = z.infer<typeof TrustRecordOutputSchema>;

/**
 * Verified trust filter schema
 */
export const VerifiedTrustFilterSchema = z.object({
  userId: z.string(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  sortBy: z
    .enum(['verificationTimestamp', 'createdAt', 'amount'])
    .default('verificationTimestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type VerifiedTrustFilter = z.infer<typeof VerifiedTrustFilterSchema>;

/**
 * Verification statistics schema
 */
export const VerificationStatisticsSchema = z.object({
  totalTrusts: z.number(),
  verifiedTrusts: z.number(),
  pendingTrusts: z.number(),
  failedTrusts: z.number(),
  notRecordedTrusts: z.number(),
  verificationRate: z.number().min(0).max(100),
});

export type VerificationStatistics = z.infer<
  typeof VerificationStatisticsSchema
>;

/**
 * Blockchain verification details schema
 */
export const BlockchainVerificationDetailsSchema = z.object({
  trustId: z.string(),
  trustName: z.string(),
  blockchainStatus: BlockchainStatusSchema,
  transactionHash: z.string().nullable(),
  blockNumber: z.number().nullable(),
  contractAddress: z.string().nullable(),
  verificationTimestamp: z.date().nullable(),
  isVerified: z.boolean(),
  verificationAttempts: z.number(),
  lastVerificationAttempt: z.date().nullable(),
  explorerUrl: z.string().nullable(),
});

export type BlockchainVerificationDetails = z.infer<
  typeof BlockchainVerificationDetailsSchema
>;

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * TrustRecord database model
 */
export interface TrustRecord {
  id: string;
  userId: string;
  trustName: string;
  amount: number;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
  createdAt: Date;
  updatedAt: Date;

  // Blockchain verification fields
  blockchainStatus: BlockchainStatus;
  transactionHash: string | null;
  blockNumber: number | null;
  contractAddress: string | null;
  verificationTimestamp: Date | null;
  isVerified: boolean;
  verificationAttempts: number;
  lastVerificationAttempt: Date | null;
}

/**
 * Verified trust record with blockchain details
 */
export interface VerifiedTrustRecord extends TrustRecord {
  isVerified: true;
  verificationTimestamp: Date;
  transactionHash: string;
  blockNumber: number;
  contractAddress: string;
  explorerUrl: string;
}

/**
 * Trust record query result
 */
export interface TrustRecordQueryResult {
  data: TrustRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Verified trust record query result
 */
export interface VerifiedTrustRecordQueryResult {
  data: VerifiedTrustRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  statistics: VerificationStatistics;
}

/**
 * Trust record with blockchain details
 */
export interface TrustRecordWithBlockchainDetails extends TrustRecord {
  blockchainDetails: BlockchainVerificationDetails;
  explorerUrl: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a trust record is verified
 */
export function isTrustVerified(trust: TrustRecord): trust is VerifiedTrustRecord {
  return (
    trust.isVerified &&
    trust.verificationTimestamp !== null &&
    trust.transactionHash !== null &&
    trust.blockNumber !== null &&
    trust.contractAddress !== null
  );
}

/**
 * Get blockchain explorer URL
 */
export function getBlockchainExplorerUrl(
  transactionHash: string | null,
  explorerBaseUrl: string = 'http://localhost:4000'
): string | null {
  if (!transactionHash) return null;
  return `${explorerBaseUrl}/tx/${transactionHash}`;
}

/**
 * Calculate verification rate
 */
export function calculateVerificationRate(
  verifiedCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return Math.round((verifiedCount / totalCount) * 100);
}

/**
 * Format blockchain verification details
 */
export function formatBlockchainVerificationDetails(
  trust: TrustRecord,
  explorerBaseUrl: string = 'http://localhost:4000'
): BlockchainVerificationDetails {
  return {
    trustId: trust.id,
    trustName: trust.trustName,
    blockchainStatus: trust.blockchainStatus,
    transactionHash: trust.transactionHash,
    blockNumber: trust.blockNumber,
    contractAddress: trust.contractAddress,
    verificationTimestamp: trust.verificationTimestamp,
    isVerified: trust.isVerified,
    verificationAttempts: trust.verificationAttempts,
    lastVerificationAttempt: trust.lastVerificationAttempt,
    explorerUrl: getBlockchainExplorerUrl(
      trust.transactionHash,
      explorerBaseUrl
    ),
  };
}

// ============================================================================
// Export all types and schemas
// ============================================================================

export {
  BlockchainStatusSchema,
  TrustRecordInputSchema,
  TrustRecordOutputSchema,
  VerifiedTrustFilterSchema,
  VerificationStatisticsSchema,
  BlockchainVerificationDetailsSchema,
};
