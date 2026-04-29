/**
 * Verify Trust tRPC Procedure
 * 
 * Complete backend procedure for recording and verifying trust records
 * on Hyperledger Besu blockchain.
 * 
 * Flow:
 * 1. Validate input and user permissions
 * 2. Check if trust already recorded on blockchain
 * 3. Record trust on blockchain (if not already recorded)
 * 4. Verify trust authenticity
 * 5. Update database with verification details
 * 6. Return verification result
 */

import { protectedProcedure } from '@/server/_core/trpc';
import { z } from 'zod';
import { db } from '@/server/db';
import { trustRecords } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import BlockchainVerificationService from '@/services/BlockchainVerificationService';
import BesuTransactionService from '@/services/BesuTransactionService';
import { BlockchainVerification, BlockchainStatus } from '@/types/CertificateTypes';

// ============================================================================
// Initialize Services
// ============================================================================

const verificationService = new BlockchainVerificationService(
  process.env.BESU_RPC_URL || 'http://localhost:8545',
  process.env.TRUST_CONTRACT_ADDRESS || '0x0',
  JSON.parse(process.env.TRUST_CONTRACT_ABI || '[]')
);

const transactionService = new BesuTransactionService(
  process.env.BESU_RPC_URL || 'http://localhost:8545',
  process.env.TRUST_CONTRACT_ADDRESS || '0x0',
  process.env.ISSUER_PRIVATE_KEY || '0x0',
  JSON.parse(process.env.TRUST_CONTRACT_ABI || '[]')
);

// Initialize on startup
(async () => {
  try {
    await verificationService.initialize();
    await transactionService.initialize();
    console.log('Blockchain services initialized');
  } catch (error) {
    console.error('Failed to initialize blockchain services:', error);
  }
})();

// ============================================================================
// Input Validation Schema
// ============================================================================

const VerifyTrustInput = z.object({
  trustId: z.string().min(1, 'Trust ID is required'),
  forceRefresh: z.boolean().default(false).optional(),
});

type VerifyTrustInput = z.infer<typeof VerifyTrustInput>;

// ============================================================================
// Output Schema
// ============================================================================

const VerifyTrustOutput = z.object({
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
  verificationDetails: z.object({
    instrumentExists: z.boolean(),
    issuerAuthorized: z.boolean(),
    documentHashMatches: z.boolean(),
    paymentRecorded: z.boolean(),
    notRevoked: z.boolean(),
    contractValid: z.boolean(),
  }).optional(),
  message: z.string(),
});

type VerifyTrustOutput = z.infer<typeof VerifyTrustOutput>;

// ============================================================================
// Main Verify Trust Procedure
// ============================================================================

export const verifyTrustProcedure = protectedProcedure
  .input(VerifyTrustInput)
  .output(VerifyTrustOutput)
  .mutation(async ({ input, ctx }): Promise<VerifyTrustOutput> => {
    const { trustId, forceRefresh } = input;
    const userId = ctx.user.id;

    console.log(`[VerifyTrust] Starting verification for trust: ${trustId}, user: ${userId}`);

    try {
      // ======================================================================
      // Step 1: Validate Input
      // ======================================================================

      if (!trustId || trustId.trim().length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trust ID is required',
        });
      }

      // ======================================================================
      // Step 2: Fetch Trust Record
      // ======================================================================

      console.log(`[VerifyTrust] Fetching trust record: ${trustId}`);

      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, trustId),
      });

      if (!trust) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trust record not found',
        });
      }

      // ======================================================================
      // Step 3: Verify User Ownership
      // ======================================================================

      if (trust.userId !== userId) {
        console.warn(
          `[VerifyTrust] Unauthorized access attempt: user ${userId} tried to verify trust owned by ${trust.userId}`
        );

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to verify this trust',
        });
      }

      // ======================================================================
      // Step 4: Check Cached Verification
      // ======================================================================

      if (
        !forceRefresh &&
        trust.blockchainStatus === 'verified' &&
        trust.transactionHash &&
        trust.verificationTimestamp
      ) {
        console.log(`[VerifyTrust] Returning cached verification for trust: ${trustId}`);

        return {
          success: true,
          isVerified: true,
          cached: true,
          blockchainVerification: {
            transactionHash: trust.transactionHash,
            blockNumber: trust.blockNumber || 0,
            verificationTimestamp: trust.verificationTimestamp,
            explorerUrl: `${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${trust.transactionHash}`,
            chainId: parseInt(process.env.BESU_CHAIN_ID || '1337'),
            contractAddress: trust.contractAddress || undefined,
          },
          message: 'Trust already verified on blockchain (cached)',
        };
      }

      // ======================================================================
      // Step 5: Check Blockchain Connection
      // ======================================================================

      console.log(`[VerifyTrust] Checking blockchain connection`);

      const networkStatus = await verificationService.getNetworkStatus();

      if (!networkStatus.connected) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Blockchain network is not available',
        });
      }

      console.log(
        `[VerifyTrust] Connected to blockchain: Chain ID ${networkStatus.chainId}, Block ${networkStatus.blockNumber}`
      );

      // ======================================================================
      // Step 6: Record Trust on Blockchain (if not already recorded)
      // ======================================================================

      let transactionHash = trust.transactionHash;

      if (!transactionHash) {
        console.log(`[VerifyTrust] Recording trust on blockchain: ${trustId}`);

        try {
          transactionHash = await transactionService.recordTrustOnBlockchain({
            trustId: trust.id,
            name: trust.name,
            amount: trust.amount,
            beneficiary: trust.beneficiary,
            maturityDate: trust.maturityDate,
            terms: trust.terms,
          });

          console.log(
            `[VerifyTrust] Trust recorded on blockchain with transaction: ${transactionHash}`
          );

          // Update database with transaction hash
          await db
            .update(trustRecords)
            .set({
              transactionHash,
              blockchainStatus: 'syncing',
            })
            .where(eq(trustRecords.id, trustId));

          // Wait for transaction confirmation
          console.log(`[VerifyTrust] Waiting for transaction confirmation: ${transactionHash}`);

          const receipt = await transactionService.waitForTransactionConfirmation(
            transactionHash,
            300000 // 5 minute timeout
          );

          console.log(
            `[VerifyTrust] Transaction confirmed in block ${receipt.blockNumber}`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[VerifyTrust] Failed to record trust on blockchain:`, error);

          // Update database with failed status
          await db
            .update(trustRecords)
            .set({
              blockchainStatus: 'failed',
            })
            .where(eq(trustRecords.id, trustId));

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to record trust on blockchain: ${errorMessage}`,
          });
        }
      }

      // ======================================================================
      // Step 7: Verify Trust on Blockchain
      // ======================================================================

      console.log(`[VerifyTrust] Verifying trust on blockchain: ${trustId}`);

      let verificationResult;

      try {
        verificationResult = await verificationService.verifyTrust(trustId, {
          name: trust.name,
          amount: trust.amount,
          beneficiary: trust.beneficiary,
          maturityDate: trust.maturityDate,
          terms: trust.terms,
        });

        console.log(`[VerifyTrust] Verification result:`, {
          isValid: verificationResult.isValid,
          transactionHash: verificationResult.transactionHash,
          blockNumber: verificationResult.blockNumber,
          details: verificationResult.details,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[VerifyTrust] Verification failed:`, error);

        // Update database with failed status
        await db
          .update(trustRecords)
          .set({
            blockchainStatus: 'failed',
          })
          .where(eq(trustRecords.id, trustId));

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Trust verification failed: ${errorMessage}`,
        });
      }

      // ======================================================================
      // Step 8: Create Blockchain Verification Object
      // ======================================================================

      console.log(`[VerifyTrust] Creating blockchain verification object`);

      let blockchainVerification: BlockchainVerification;

      try {
        blockchainVerification = await verificationService.createBlockchainVerification(
          verificationResult,
          process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
        );

        console.log(`[VerifyTrust] Blockchain verification object created:`, {
          transactionHash: blockchainVerification.transactionHash,
          blockNumber: blockchainVerification.blockNumber,
          chainId: blockchainVerification.chainId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[VerifyTrust] Failed to create blockchain verification:`, error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create blockchain verification: ${errorMessage}`,
        });
      }

      // ======================================================================
      // Step 9: Update Database
      // ======================================================================

      console.log(`[VerifyTrust] Updating database with verification details`);

      const newStatus: BlockchainStatus = verificationResult.isValid ? 'verified' : 'failed';

      try {
        await db
          .update(trustRecords)
          .set({
            blockchainStatus: newStatus,
            transactionHash: verificationResult.transactionHash,
            blockNumber: verificationResult.blockNumber,
            contractAddress: blockchainVerification.contractAddress,
            verificationTimestamp: verificationResult.verificationTimestamp,
            isVerified: verificationResult.isValid ? 1 : 0,
          })
          .where(eq(trustRecords.id, trustId));

        console.log(`[VerifyTrust] Database updated with status: ${newStatus}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[VerifyTrust] Failed to update database:`, error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update verification details: ${errorMessage}`,
        });
      }

      // ======================================================================
      // Step 10: Return Result
      // ======================================================================

      console.log(`[VerifyTrust] Verification complete for trust: ${trustId}`);

      return {
        success: true,
        isVerified: verificationResult.isValid,
        cached: false,
        blockchainVerification,
        verificationDetails: verificationResult.details,
        message: verificationResult.message,
      };
    } catch (error) {
      // Handle TRPC errors
      if (error instanceof TRPCError) {
        throw error;
      }

      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[VerifyTrust] Unexpected error:`, error);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Verification failed: ${errorMessage}`,
      });
    }
  });

// ============================================================================
// Export
// ============================================================================

export default verifyTrustProcedure;
