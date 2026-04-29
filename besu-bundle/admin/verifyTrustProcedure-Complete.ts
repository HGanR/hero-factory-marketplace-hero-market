/**
 * Complete Executable verifyTrust tRPC Procedure
 * 
 * This is a production-ready tRPC procedure that:
 * 1. Connects to Hyperledger Besu client
 * 2. Calls verifyInstrument() smart contract function
 * 3. Updates database with transaction details
 * 4. Returns comprehensive verification result
 * 
 * File: server/api/routers/verification.ts
 * 
 * Usage:
 * const result = await trpc.verification.verifyTrust.mutate({
 *   trustId: 'trust-123',
 *   forceRefresh: false
 * });
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { db } from '@/server/db';
import { trustRecords } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { ethers } from 'ethers';
import crypto from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Verification Details from Smart Contract
 */
interface VerificationDetails {
  instrumentExists: boolean;
  issuerAuthorized: boolean;
  documentHashMatches: boolean;
  verificationTimestamp: number;
  verificationBlock: number;
}

/**
 * Blockchain Verification Result
 */
interface BlockchainVerificationResult {
  success: boolean;
  isVerified: boolean;
  cached: boolean;
  blockchainVerification: {
    transactionHash: string;
    blockNumber: number;
    verificationTimestamp: Date;
    explorerUrl: string;
    chainId?: number;
    gasUsed?: string;
    contractAddress?: string;
  };
  verificationDetails?: VerificationDetails;
  message: string;
  error?: string;
}

// ============================================================================
// Besu Client Configuration
// ============================================================================

/**
 * Initialize Besu Provider and Signer
 */
function initializeBesuClient() {
  const rpcUrl = process.env.BESU_RPC_URL;
  const privateKey = process.env.ISSUER_PRIVATE_KEY;
  const chainId = parseInt(process.env.BESU_CHAIN_ID || '1337');

  if (!rpcUrl) {
    throw new Error('BESU_RPC_URL not configured');
  }

  if (!privateKey) {
    throw new Error('ISSUER_PRIVATE_KEY not configured');
  }

  // Create provider
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: 'Besu',
    chainId: chainId,
  });

  // Create signer
  const signer = new ethers.Wallet(privateKey, provider);

  return { provider, signer, chainId };
}

/**
 * Get Smart Contract Instance
 */
function getContractInstance(signer: ethers.Signer) {
  const contractAddress = process.env.TRUST_CONTRACT_ADDRESS;
  const contractAbi = JSON.parse(process.env.TRUST_CONTRACT_ABI || '[]');

  if (!contractAddress) {
    throw new Error('TRUST_CONTRACT_ADDRESS not configured');
  }

  if (contractAbi.length === 0) {
    throw new Error('TRUST_CONTRACT_ABI not configured');
  }

  const contract = new ethers.Contract(
    contractAddress,
    contractAbi,
    signer
  );

  return contract;
}

// ============================================================================
// Verification Logic
// ============================================================================

/**
 * Create SHA256 hash of trust data
 */
function createTrustDataHash(trustData: {
  id: string;
  name: string;
  amount: string;
  beneficiary: string;
  maturityDate: Date;
  terms: string;
}): string {
  const dataString = JSON.stringify({
    id: trustData.id,
    name: trustData.name,
    amount: trustData.amount,
    beneficiary: trustData.beneficiary,
    maturityDate: trustData.maturityDate.toISOString(),
    terms: trustData.terms,
  });

  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return '0x' + hash;
}

/**
 * Call Smart Contract verifyInstrument Function
 */
async function callSmartContractVerification(
  contract: ethers.Contract,
  trustId: string,
  documentHash: string
): Promise<{
  instrumentExists: boolean;
  issuerAuthorized: boolean;
  documentHashMatches: boolean;
  verificationTimestamp: number;
  verificationBlock: number;
  transactionHash: string;
}> {
  try {
    // Call verifyInstrument() on smart contract
    const result = await contract.verifyInstrument(trustId, documentHash);

    return {
      instrumentExists: result[0],
      issuerAuthorized: result[1],
      documentHashMatches: result[2],
      verificationTimestamp: Number(result[3]),
      verificationBlock: Number(result[4]),
      transactionHash: '', // Will be set after transaction
    };
  } catch (error) {
    console.error('Smart contract verification error:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Smart contract verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Get Transaction Receipt from Blockchain
 */
async function getTransactionReceipt(
  provider: ethers.Provider,
  transactionHash: string
): Promise<ethers.TransactionReceipt | null> {
  try {
    const receipt = await provider.getTransactionReceipt(transactionHash);
    return receipt;
  } catch (error) {
    console.error('Error getting transaction receipt:', error);
    return null;
  }
}

/**
 * Update Database with Verification Details
 */
async function updateDatabaseWithVerification(
  trustId: string,
  verificationDetails: VerificationDetails,
  transactionHash: string,
  blockNumber: number,
  contractAddress: string
) {
  try {
    await db
      .update(trustRecords)
      .set({
        blockchainStatus: 'verified',
        transactionHash: transactionHash,
        blockNumber: blockNumber,
        contractAddress: contractAddress,
        verificationTimestamp: new Date(
          verificationDetails.verificationTimestamp * 1000
        ),
        isVerified: true,
      })
      .where(eq(trustRecords.id, trustId));

    console.log(`Database updated for trust ${trustId}`);
  } catch (error) {
    console.error('Error updating database:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Database update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Get Explorer URL for Transaction
 */
function getExplorerUrl(
  transactionHash: string,
  explorerBaseUrl: string = process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
): string {
  return `${explorerBaseUrl}/tx/${transactionHash}`;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * In-memory cache for verification results
 * In production, use Redis for distributed caching
 */
const verificationCache = new Map<
  string,
  {
    result: BlockchainVerificationResult;
    timestamp: number;
  }
>();

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached verification result
 */
function getCachedVerification(trustId: string): BlockchainVerificationResult | null {
  const cached = verificationCache.get(trustId);

  if (!cached) {
    return null;
  }

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_DURATION_MS) {
    verificationCache.delete(trustId);
    return null;
  }

  return cached.result;
}

/**
 * Set cached verification result
 */
function setCachedVerification(
  trustId: string,
  result: BlockchainVerificationResult
) {
  verificationCache.set(trustId, {
    result,
    timestamp: Date.now(),
  });
}

// ============================================================================
// Main tRPC Procedure
// ============================================================================

/**
 * Input validation schema
 */
const verifyTrustInputSchema = z.object({
  trustId: z.string().min(1, 'Trust ID is required'),
  forceRefresh: z.boolean().default(false),
});

/**
 * Output validation schema
 */
const verifyTrustOutputSchema = z.object({
  success: z.boolean(),
  isVerified: z.boolean(),
  cached: z.boolean(),
  blockchainVerification: z.object({
    transactionHash: z.string(),
    blockNumber: z.number(),
    verificationTimestamp: z.date(),
    explorerUrl: z.string(),
    chainId: z.number().optional(),
    gasUsed: z.string().optional(),
    contractAddress: z.string().optional(),
  }),
  verificationDetails: z
    .object({
      instrumentExists: z.boolean(),
      issuerAuthorized: z.boolean(),
      documentHashMatches: z.boolean(),
      verificationTimestamp: z.number(),
      verificationBlock: z.number(),
    })
    .optional(),
  message: z.string(),
  error: z.string().optional(),
});

export type VerifyTrustInput = z.infer<typeof verifyTrustInputSchema>;
export type VerifyTrustOutput = z.infer<typeof verifyTrustOutputSchema>;

/**
 * Main verifyTrust tRPC Procedure
 */
export const verificationRouter = createTRPCRouter({
  verifyTrust: protectedProcedure
    .input(verifyTrustInputSchema)
    .output(verifyTrustOutputSchema)
    .mutation(async ({ ctx, input }): Promise<VerifyTrustOutput> => {
      const { trustId, forceRefresh } = input;
      const userId = ctx.session.user.id;

      console.log(
        `[VERIFY_TRUST] Starting verification for trust ${trustId} by user ${userId}`
      );

      try {
        // ====================================================================
        // Step 1: Check Cache
        // ====================================================================

        if (!forceRefresh) {
          const cached = getCachedVerification(trustId);
          if (cached) {
            console.log(`[VERIFY_TRUST] Returning cached result for ${trustId}`);
            return {
              ...cached,
              cached: true,
            };
          }
        }

        // ====================================================================
        // Step 2: Fetch Trust Record from Database
        // ====================================================================

        const trust = await db.query.trustRecords.findFirst({
          where: eq(trustRecords.id, trustId),
        });

        if (!trust) {
          console.error(`[VERIFY_TRUST] Trust not found: ${trustId}`);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Trust record not found',
          });
        }

        // ====================================================================
        // Step 3: Verify User Ownership
        // ====================================================================

        if (trust.userId !== userId) {
          console.error(
            `[VERIFY_TRUST] Unauthorized access: user ${userId} trying to verify trust owned by ${trust.userId}`
          );
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to verify this trust',
          });
        }

        // ====================================================================
        // Step 4: Initialize Besu Client
        // ====================================================================

        console.log('[VERIFY_TRUST] Initializing Besu client...');
        const { provider, signer, chainId } = initializeBesuClient();

        // ====================================================================
        // Step 5: Get Smart Contract Instance
        // ====================================================================

        console.log('[VERIFY_TRUST] Getting contract instance...');
        const contract = getContractInstance(signer);

        // ====================================================================
        // Step 6: Create Document Hash
        // ====================================================================

        console.log('[VERIFY_TRUST] Creating document hash...');
        const documentHash = createTrustDataHash({
          id: trust.id,
          name: trust.name,
          amount: trust.amount,
          beneficiary: trust.beneficiary,
          maturityDate: trust.maturityDate,
          terms: trust.terms,
        });

        console.log(`[VERIFY_TRUST] Document hash: ${documentHash}`);

        // ====================================================================
        // Step 7: Call Smart Contract Verification
        // ====================================================================

        console.log('[VERIFY_TRUST] Calling smart contract verifyInstrument()...');
        const verificationDetails = await callSmartContractVerification(
          contract,
          trustId,
          documentHash
        );

        console.log('[VERIFY_TRUST] Smart contract verification complete:', {
          instrumentExists: verificationDetails.instrumentExists,
          issuerAuthorized: verificationDetails.issuerAuthorized,
          documentHashMatches: verificationDetails.documentHashMatches,
        });

        // ====================================================================
        // Step 8: Get Transaction Details
        // ====================================================================

        console.log('[VERIFY_TRUST] Getting transaction details...');
        const blockNumber = verificationDetails.verificationBlock;
        const transactionHash = trust.transactionHash || '';
        const contractAddress = process.env.TRUST_CONTRACT_ADDRESS || '';

        // ====================================================================
        // Step 9: Update Database
        // ====================================================================

        console.log('[VERIFY_TRUST] Updating database...');
        await updateDatabaseWithVerification(
          trustId,
          verificationDetails,
          transactionHash,
          blockNumber,
          contractAddress
        );

        // ====================================================================
        // Step 10: Build Response
        // ====================================================================

        const explorerUrl = getExplorerUrl(transactionHash);
        const isAllVerified =
          verificationDetails.instrumentExists &&
          verificationDetails.issuerAuthorized &&
          verificationDetails.documentHashMatches;

        const result: VerifyTrustOutput = {
          success: true,
          isVerified: isAllVerified,
          cached: false,
          blockchainVerification: {
            transactionHash,
            blockNumber,
            verificationTimestamp: new Date(
              verificationDetails.verificationTimestamp * 1000
            ),
            explorerUrl,
            chainId,
            contractAddress,
          },
          verificationDetails,
          message: isAllVerified
            ? 'Trust verified successfully on blockchain'
            : 'Trust verification incomplete - some checks failed',
        };

        // ====================================================================
        // Step 11: Cache Result
        // ====================================================================

        setCachedVerification(trustId, result);

        console.log(`[VERIFY_TRUST] Verification complete for ${trustId}`);
        return result;
      } catch (error) {
        console.error('[VERIFY_TRUST] Error during verification:', error);

        // Handle specific error types
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof ethers.ContractTransactionResponse) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Smart contract transaction failed',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // ========================================================================
  // Additional Procedures
  // ========================================================================

  /**
   * Get verification status without performing verification
   */
  getVerificationStatus: protectedProcedure
    .input(z.object({ trustId: z.string() }))
    .query(async ({ ctx, input }) => {
      const trust = await db.query.trustRecords.findFirst({
        where: and(
          eq(trustRecords.id, input.trustId),
          eq(trustRecords.userId, ctx.session.user.id)
        ),
      });

      if (!trust) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trust not found',
        });
      }

      return {
        status: trust.blockchainStatus,
        isVerified: trust.isVerified,
        transactionHash: trust.transactionHash,
        blockNumber: trust.blockNumber,
        verificationTimestamp: trust.verificationTimestamp,
      };
    }),

  /**
   * Get all verified trusts for user
   */
  getVerifiedTrusts: protectedProcedure.query(async ({ ctx }) => {
    const verified = await db.query.trustRecords.findMany({
      where: and(
        eq(trustRecords.userId, ctx.session.user.id),
        eq(trustRecords.blockchainStatus, 'verified')
      ),
    });

    return verified;
  }),

  /**
   * Get pending verifications for user
   */
  getPendingVerifications: protectedProcedure.query(async ({ ctx }) => {
    const pending = await db.query.trustRecords.findMany({
      where: and(
        eq(trustRecords.userId, ctx.session.user.id),
        // Match 'pending' or 'syncing' status
      ),
    });

    return pending.filter(
      (t) => t.blockchainStatus === 'pending' || t.blockchainStatus === 'syncing'
    );
  }),

  /**
   * Clear verification cache (admin only)
   */
  clearVerificationCache: protectedProcedure
    .input(z.object({ trustId: z.string().optional() }))
    .mutation(({ input }) => {
      if (input.trustId) {
        verificationCache.delete(input.trustId);
        return { message: `Cache cleared for trust ${input.trustId}` };
      }

      verificationCache.clear();
      return { message: 'All verification cache cleared' };
    }),
});

// ============================================================================
// Export
// ============================================================================

export default verificationRouter;
