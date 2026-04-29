/**
 * Trust Blockchain Router
 * 
 * tRPC backend procedures for blockchain-enabled trust operations.
 * Handles creating, verifying, and managing trust records on Besu.
 */

import { router, protectedProcedure } from '@/server/_core/trpc';
import { z } from 'zod';
import { db } from '@/server/db';
import { trustRecords } from '@/server/db/schema';
import BesuWeb3Service from '@/services/BesuWeb3Service';
import { eq } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

const BlockchainStatusEnum = z.enum([
  'pending',
  'syncing',
  'verified',
  'failed',
  'not_recorded',
]);

const TrustRecordWithBlockchainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  amount: z.string(),
  beneficiary: z.string(),
  createdAt: z.date(),
  maturityDate: z.date(),
  terms: z.string(),
  // Blockchain fields
  blockchainStatus: BlockchainStatusEnum,
  transactionHash: z.string().nullable(),
  blockNumber: z.number().nullable(),
  contractAddress: z.string().nullable(),
  verificationTimestamp: z.date().nullable(),
  isVerified: z.boolean(),
});

// ============================================================================
// Initialize Besu Service
// ============================================================================

const besuService = new BesuWeb3Service({
  rpcUrl: process.env.BESU_RPC_URL || 'http://localhost:8545',
  chainId: parseInt(process.env.BESU_CHAIN_ID || '1337'),
});

// ============================================================================
// Trust Blockchain Router
// ============================================================================

export const trustBlockchainRouter = router({
  /**
   * Create trust record and record on blockchain
   */
  createTrustWithBlockchain: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Trust name required'),
        amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount'),
        beneficiary: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
        maturityDate: z.date(),
        terms: z.string(),
        privateKey: z.string().optional(), // For signing transactions
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // 1. Create trust record in database
        const trustRecord = await db
          .insert(trustRecords)
          .values({
            userId: ctx.user.id,
            name: input.name,
            amount: input.amount,
            beneficiary: input.beneficiary,
            maturityDate: input.maturityDate,
            terms: input.terms,
            blockchainStatus: 'pending',
            createdAt: new Date(),
          })
          .returning();

        const trust = trustRecord[0];

        // 2. Record on blockchain (async, don't block response)
        recordTrustOnBlockchain(trust.id, input, ctx.user.id).catch((error) => {
          console.error(`Failed to record trust ${trust.id} on blockchain:`, error);
        });

        return {
          success: true,
          trustId: trust.id,
          blockchainStatus: 'pending',
          message: 'Trust created. Recording on blockchain...',
        };
      } catch (error) {
        throw new Error(`Failed to create trust: ${error}`);
      }
    }),

  /**
   * Get trust record with blockchain verification status
   */
  getTrustWithBlockchain: protectedProcedure
    .input(z.object({ trustId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // Get trust from database
        const trust = await db.query.trustRecords.findFirst({
          where: eq(trustRecords.id, input.trustId),
        });

        if (!trust) {
          throw new Error('Trust record not found');
        }

        // Verify user owns this trust
        if (trust.userId !== ctx.user.id) {
          throw new Error('Unauthorized');
        }

        // If blockchain status is verified, verify it's still on chain
        if (trust.blockchainStatus === 'verified' && trust.transactionHash) {
          const isStillVerified = await verifyTrustOnBlockchain(trust.transactionHash);

          if (!isStillVerified) {
            // Update status if verification failed
            await db
              .update(trustRecords)
              .set({ blockchainStatus: 'failed' })
              .where(eq(trustRecords.id, trust.id));
          }
        }

        return {
          ...trust,
          blockchainStatus: trust.blockchainStatus,
          isVerified: trust.blockchainStatus === 'verified',
          verificationUrl: trust.transactionHash
            ? `${process.env.BESU_EXPLORER_URL}/tx/${trust.transactionHash}`
            : null,
        };
      } catch (error) {
        throw new Error(`Failed to get trust: ${error}`);
      }
    }),

  /**
   * Get all trust records for user with blockchain status
   */
  getAllTrustsWithBlockchain: protectedProcedure.query(async ({ ctx }) => {
    try {
      const trusts = await db.query.trustRecords.findMany({
        where: eq(trustRecords.userId, ctx.user.id),
      });

      // Enrich with blockchain status
      const enrichedTrusts = trusts.map((trust) => ({
        ...trust,
        isVerified: trust.blockchainStatus === 'verified',
        verificationUrl: trust.transactionHash
          ? `${process.env.BESU_EXPLORER_URL}/tx/${trust.transactionHash}`
          : null,
      }));

      return enrichedTrusts;
    } catch (error) {
      throw new Error(`Failed to get trusts: ${error}`);
    }
  }),

  /**
   * Verify trust on blockchain
   */
  verifyTrustBlockchain: protectedProcedure
    .input(z.object({ trustId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get trust from database
        const trust = await db.query.trustRecords.findFirst({
          where: eq(trustRecords.id, input.trustId),
        });

        if (!trust) {
          throw new Error('Trust record not found');
        }

        if (trust.userId !== ctx.user.id) {
          throw new Error('Unauthorized');
        }

        if (!trust.transactionHash) {
          throw new Error('Trust not recorded on blockchain');
        }

        // Verify on blockchain
        const isVerified = await verifyTrustOnBlockchain(trust.transactionHash);

        if (isVerified) {
          // Update status
          await db
            .update(trustRecords)
            .set({
              blockchainStatus: 'verified',
              verificationTimestamp: new Date(),
            })
            .where(eq(trustRecords.id, trust.id));

          return {
            success: true,
            isVerified: true,
            message: 'Trust verified on blockchain',
          };
        } else {
          return {
            success: false,
            isVerified: false,
            message: 'Trust verification failed',
          };
        }
      } catch (error) {
        throw new Error(`Failed to verify trust: ${error}`);
      }
    }),

  /**
   * Get blockchain verification details
   */
  getBlockchainDetails: protectedProcedure
    .input(z.object({ trustId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const trust = await db.query.trustRecords.findFirst({
          where: eq(trustRecords.id, input.trustId),
        });

        if (!trust) {
          throw new Error('Trust record not found');
        }

        if (trust.userId !== ctx.user.id) {
          throw new Error('Unauthorized');
        }

        if (!trust.transactionHash) {
          return {
            status: 'not_recorded',
            message: 'Trust not yet recorded on blockchain',
          };
        }

        // Get transaction details from blockchain
        try {
          const receipt = await besuService.provider.getTransactionReceipt(
            trust.transactionHash
          );

          if (!receipt) {
            return {
              status: 'pending',
              transactionHash: trust.transactionHash,
              message: 'Transaction pending...',
            };
          }

          return {
            status: receipt.status === 1 ? 'verified' : 'failed',
            transactionHash: trust.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            timestamp: new Date(Number(receipt.timestamp) * 1000),
            explorerUrl: `${process.env.BESU_EXPLORER_URL}/tx/${trust.transactionHash}`,
          };
        } catch (error) {
          return {
            status: 'error',
            message: `Failed to fetch blockchain details: ${error}`,
          };
        }
      } catch (error) {
        throw new Error(`Failed to get blockchain details: ${error}`);
      }
    }),

  /**
   * Export trust verification certificate
   */
  exportVerificationCertificate: protectedProcedure
    .input(z.object({ trustId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const trust = await db.query.trustRecords.findFirst({
          where: eq(trustRecords.id, input.trustId),
        });

        if (!trust) {
          throw new Error('Trust record not found');
        }

        if (trust.userId !== ctx.user.id) {
          throw new Error('Unauthorized');
        }

        if (trust.blockchainStatus !== 'verified') {
          throw new Error('Trust not verified on blockchain');
        }

        // Generate certificate
        const certificate = {
          trustId: trust.id,
          trustName: trust.name,
          amount: trust.amount,
          beneficiary: trust.beneficiary,
          maturityDate: trust.maturityDate,
          terms: trust.terms,
          blockchainVerification: {
            transactionHash: trust.transactionHash,
            blockNumber: trust.blockNumber,
            verificationTimestamp: trust.verificationTimestamp,
            explorerUrl: `${process.env.BESU_EXPLORER_URL}/tx/${trust.transactionHash}`,
          },
          certificateGeneratedAt: new Date(),
          certificateId: `CERT-${trust.id}-${Date.now()}`,
        };

        return {
          success: true,
          certificate,
          format: 'json', // Can be extended to PDF, etc.
        };
      } catch (error) {
        throw new Error(`Failed to export certificate: ${error}`);
      }
    }),

  /**
   * Get blockchain network status
   */
  getBlockchainStatus: protectedProcedure.query(async () => {
    try {
      const networkInfo = await besuService.getNetworkInfo();

      return {
        connected: true,
        chainId: networkInfo.chainId,
        blockNumber: networkInfo.blockNumber,
        gasPrice: networkInfo.gasPrice,
        rpcUrl: process.env.BESU_RPC_URL,
      };
    } catch (error) {
      return {
        connected: false,
        error: `Failed to connect to blockchain: ${error}`,
      };
    }
  }),

  /**
   * Retry recording trust on blockchain
   */
  retryBlockchainRecording: protectedProcedure
    .input(z.object({ trustId: z.string(), privateKey: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const trust = await db.query.trustRecords.findFirst({
          where: eq(trustRecords.id, input.trustId),
        });

        if (!trust) {
          throw new Error('Trust record not found');
        }

        if (trust.userId !== ctx.user.id) {
          throw new Error('Unauthorized');
        }

        // Update status to pending
        await db
          .update(trustRecords)
          .set({ blockchainStatus: 'pending' })
          .where(eq(trustRecords.id, trust.id));

        // Retry recording
        recordTrustOnBlockchain(
          trust.id,
          {
            name: trust.name,
            amount: trust.amount,
            beneficiary: trust.beneficiary,
            maturityDate: trust.maturityDate,
            terms: trust.terms,
            privateKey: input.privateKey,
          },
          ctx.user.id
        ).catch((error) => {
          console.error(`Failed to retry blockchain recording for ${trust.id}:`, error);
        });

        return {
          success: true,
          message: 'Retrying blockchain recording...',
        };
      } catch (error) {
        throw new Error(`Failed to retry blockchain recording: ${error}`);
      }
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record trust on blockchain (async background task)
 */
async function recordTrustOnBlockchain(
  trustId: string,
  trustData: {
    name: string;
    amount: string;
    beneficiary: string;
    maturityDate: Date;
    terms: string;
    privateKey?: string;
  },
  userId: string
) {
  try {
    // Connect wallet if private key provided
    if (trustData.privateKey) {
      await besuService.connectWallet(trustData.privateKey);
    }

    // Get contract address from environment
    const contractAddress = process.env.TRUST_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('Trust contract address not configured');
    }

    // Get contract ABI
    const contractABI = JSON.parse(process.env.TRUST_CONTRACT_ABI || '[]');

    // Record on blockchain
    const result = await besuService.createTrust(
      contractAddress,
      `TRUST-${trustId}`,
      trustData.amount,
      trustData.beneficiary,
      trustData.maturityDate,
      trustData.terms,
      contractABI
    );

    // Update database with blockchain details
    await db
      .update(trustRecords)
      .set({
        blockchainStatus: 'verified',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        contractAddress,
        verificationTimestamp: result.timestamp,
      })
      .where(eq(trustRecords.id, trustId));

    console.log(`Trust ${trustId} recorded on blockchain: ${result.hash}`);
  } catch (error) {
    console.error(`Failed to record trust ${trustId} on blockchain:`, error);

    // Update status to failed
    await db
      .update(trustRecords)
      .set({ blockchainStatus: 'failed' })
      .where(eq(trustRecords.id, trustId));
  }
}

/**
 * Verify trust on blockchain
 */
async function verifyTrustOnBlockchain(transactionHash: string): Promise<boolean> {
  try {
    const receipt = await besuService.provider.getTransactionReceipt(transactionHash);

    if (!receipt) {
      return false; // Still pending
    }

    return receipt.status === 1; // 1 = success, 0 = failed
  } catch (error) {
    console.error(`Failed to verify transaction ${transactionHash}:`, error);
    return false;
  }
}

export default trustBlockchainRouter;
