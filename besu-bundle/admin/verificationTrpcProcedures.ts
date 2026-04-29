/**
 * Verification tRPC Procedures
 * 
 * tRPC procedures for verifying trust records on Hyperledger Besu
 * before certificate export.
 */

import { protectedProcedure } from '@/server/_core/trpc';
import { z } from 'zod';
import { db } from '@/server/db';
import { trustRecords } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import BlockchainVerificationService from '@/services/BlockchainVerificationService';
import {
  BlockchainVerification,
  VerificationResult,
  BlockchainStatus,
} from '@/types/CertificateTypes';

// ============================================================================
// Initialize Verification Service
// ============================================================================

const verificationService = new BlockchainVerificationService(
  process.env.BESU_RPC_URL || 'http://localhost:8545',
  process.env.TRUST_CONTRACT_ADDRESS || '0x0',
  JSON.parse(process.env.TRUST_CONTRACT_ABI || '[]')
);

// Initialize on startup
(async () => {
  try {
    await verificationService.initialize();
    console.log('Blockchain verification service initialized');
  } catch (error) {
    console.error('Failed to initialize verification service:', error);
  }
})();

// ============================================================================
// Verify Trust Procedure
// ============================================================================

export const verifyTrustProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
      forceRefresh: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // 1. Get trust record from database
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // 2. Verify user owns this trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized: You do not own this trust');
      }

      // 3. Check if verification is already cached and valid
      if (
        !input.forceRefresh &&
        trust.blockchainStatus === 'verified' &&
        trust.transactionHash &&
        trust.verificationTimestamp
      ) {
        // Return cached verification
        return {
          success: true,
          isVerified: true,
          cached: true,
          blockchainVerification: {
            transactionHash: trust.transactionHash,
            blockNumber: trust.blockNumber,
            verificationTimestamp: trust.verificationTimestamp,
            explorerUrl: `${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${trust.transactionHash}`,
            chainId: parseInt(process.env.BESU_CHAIN_ID || '1337'),
          },
          message: 'Trust already verified on blockchain',
        };
      }

      // 4. Check blockchain connection
      const networkStatus = await verificationService.getNetworkStatus();
      if (!networkStatus.connected) {
        throw new Error('Blockchain network is not available');
      }

      // 5. Verify trust on blockchain
      const verificationResult = await verificationService.verifyTrust(
        trust.id,
        {
          name: trust.name,
          amount: trust.amount,
          beneficiary: trust.beneficiary,
          maturityDate: trust.maturityDate,
          terms: trust.terms,
        }
      );

      // 6. Create blockchain verification object
      const blockchainVerification = await verificationService.createBlockchainVerification(
        verificationResult,
        process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
      );

      // 7. Update trust record in database
      const newStatus: BlockchainStatus = verificationResult.isValid ? 'verified' : 'failed';

      await db
        .update(trustRecords)
        .set({
          blockchainStatus: newStatus,
          transactionHash: verificationResult.transactionHash,
          blockNumber: verificationResult.blockNumber,
          contractAddress: blockchainVerification.contractAddress,
          verificationTimestamp: verificationResult.verificationTimestamp,
          isVerified: verificationResult.isVerified,
        })
        .where(eq(trustRecords.id, trust.id));

      // 8. Return verification result
      return {
        success: true,
        isVerified: verificationResult.isVerified,
        cached: false,
        blockchainVerification,
        verificationDetails: verificationResult.details,
        message: verificationResult.message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Update trust status to failed
      try {
        await db
          .update(trustRecords)
          .set({
            blockchainStatus: 'failed',
          })
          .where(eq(trustRecords.id, input.trustId));
      } catch (updateError) {
        console.error('Failed to update trust status:', updateError);
      }

      throw new Error(`Trust verification failed: ${message}`);
    }
  });

// ============================================================================
// Check Verification Status Procedure
// ============================================================================

export const checkVerificationStatusProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    try {
      // Get trust record
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // Verify user owns trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      // Return verification status
      return {
        trustId: trust.id,
        trustName: trust.name,
        status: trust.blockchainStatus,
        isVerified: trust.isVerified,
        transactionHash: trust.transactionHash,
        blockNumber: trust.blockNumber,
        verificationTimestamp: trust.verificationTimestamp,
        explorerUrl: trust.transactionHash
          ? `${process.env.BESU_EXPLORER_URL || 'http://localhost:4000'}/tx/${trust.transactionHash}`
          : null,
        canExport: trust.blockchainStatus === 'verified' && trust.transactionHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to check verification status: ${message}`);
    }
  });

// ============================================================================
// Get Payment History Procedure
// ============================================================================

export const getPaymentHistoryProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    try {
      // Get trust record
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // Verify user owns trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      // Check if trust is verified on blockchain
      if (trust.blockchainStatus !== 'verified') {
        throw new Error('Trust is not verified on blockchain');
      }

      // Get payment history from blockchain
      const paymentHistory = await verificationService.getPaymentHistory(trust.id);

      return {
        trustId: trust.id,
        trustName: trust.name,
        totalAmount: trust.amount,
        payments: paymentHistory,
        paymentCount: paymentHistory.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get payment history: ${message}`);
    }
  });

// ============================================================================
// Get Instrument Status Procedure
// ============================================================================

export const getInstrumentStatusProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    try {
      // Get trust record
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // Verify user owns trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      // Check if trust is verified on blockchain
      if (trust.blockchainStatus !== 'verified') {
        throw new Error('Trust is not verified on blockchain');
      }

      // Get instrument status from blockchain
      const status = await verificationService.getInstrumentStatus(trust.id);

      return {
        trustId: trust.id,
        trustName: trust.name,
        ...status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get instrument status: ${message}`);
    }
  });

// ============================================================================
// Get Blockchain Statistics Procedure
// ============================================================================

export const getBlockchainStatisticsProcedure = protectedProcedure
  .query(async () => {
    try {
      // Get network status
      const networkStatus = await verificationService.getNetworkStatus();

      // Get statistics
      const statistics = await verificationService.getStatistics();

      return {
        success: true,
        networkStatus,
        statistics,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get blockchain statistics: ${message}`);
    }
  });

// ============================================================================
// Batch Verify Trusts Procedure
// ============================================================================

export const batchVerifyTrustsProcedure = protectedProcedure
  .input(
    z.object({
      trustIds: z.array(z.string()),
      forceRefresh: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      const results = [];
      const errors = [];

      for (const trustId of input.trustIds) {
        try {
          // Get trust record
          const trust = await db.query.trustRecords.findFirst({
            where: eq(trustRecords.id, trustId),
          });

          if (!trust) {
            errors.push({ trustId, error: 'Trust not found' });
            continue;
          }

          // Verify user owns trust
          if (trust.userId !== ctx.user.id) {
            errors.push({ trustId, error: 'Unauthorized' });
            continue;
          }

          // Skip if already verified and not forcing refresh
          if (
            !input.forceRefresh &&
            trust.blockchainStatus === 'verified' &&
            trust.transactionHash
          ) {
            results.push({
              trustId,
              trustName: trust.name,
              status: 'verified',
              cached: true,
              transactionHash: trust.transactionHash,
            });
            continue;
          }

          // Verify trust on blockchain
          const verificationResult = await verificationService.verifyTrust(trustId, {
            name: trust.name,
            amount: trust.amount,
            beneficiary: trust.beneficiary,
            maturityDate: trust.maturityDate,
            terms: trust.terms,
          });

          // Update database
          const newStatus: BlockchainStatus = verificationResult.isVerified
            ? 'verified'
            : 'failed';

          await db
            .update(trustRecords)
            .set({
              blockchainStatus: newStatus,
              transactionHash: verificationResult.transactionHash,
              blockNumber: verificationResult.blockNumber,
              verificationTimestamp: verificationResult.verificationTimestamp,
              isVerified: verificationResult.isVerified,
            })
            .where(eq(trustRecords.id, trustId));

          results.push({
            trustId,
            trustName: trust.name,
            status: newStatus,
            cached: false,
            transactionHash: verificationResult.transactionHash,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ trustId, error: message });
        }
      }

      return {
        success: true,
        total: input.trustIds.length,
        verified: results.filter((r) => r.status === 'verified').length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Batch verification failed: ${message}`);
    }
  });

// ============================================================================
// Poll Verification Status Procedure
// ============================================================================

export const pollVerificationStatusProcedure = protectedProcedure
  .input(
    z.object({
      trustId: z.string(),
      maxAttempts: z.number().default(30),
      intervalMs: z.number().default(2000),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // Get trust record
      const trust = await db.query.trustRecords.findFirst({
        where: eq(trustRecords.id, input.trustId),
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      // Verify user owns trust
      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      // Poll for verification
      const verificationResult = await verificationService.pollVerificationStatus(
        trust.id,
        {
          name: trust.name,
          amount: trust.amount,
          beneficiary: trust.beneficiary,
          maturityDate: trust.maturityDate,
          terms: trust.terms,
        },
        input.maxAttempts,
        input.intervalMs
      );

      // Create blockchain verification object
      const blockchainVerification = await verificationService.createBlockchainVerification(
        verificationResult,
        process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
      );

      // Update database
      await db
        .update(trustRecords)
        .set({
          blockchainStatus: 'verified',
          transactionHash: verificationResult.transactionHash,
          blockNumber: verificationResult.blockNumber,
          verificationTimestamp: verificationResult.verificationTimestamp,
          isVerified: true,
        })
        .where(eq(trustRecords.id, trust.id));

      return {
        success: true,
        isVerified: true,
        blockchainVerification,
        message: 'Trust verified successfully after polling',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Polling failed: ${message}`);
    }
  });

// ============================================================================
// Export Procedures
// ============================================================================

export default {
  verifyTrust: verifyTrustProcedure,
  checkVerificationStatus: checkVerificationStatusProcedure,
  getPaymentHistory: getPaymentHistoryProcedure,
  getInstrumentStatus: getInstrumentStatusProcedure,
  getBlockchainStatistics: getBlockchainStatisticsProcedure,
  batchVerifyTrusts: batchVerifyTrustsProcedure,
  pollVerificationStatus: pollVerificationStatusProcedure,
};
