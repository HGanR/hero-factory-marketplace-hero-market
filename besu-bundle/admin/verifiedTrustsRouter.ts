/**
 * Verified Trusts tRPC Router
 * 
 * File: server/routers/verifiedTrusts.ts
 * 
 * This router provides tRPC procedures for querying verified trust records
 * utilizing the new blockchain verification fields (is_verified, verification_timestamp).
 */

import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../db';
import {
  TrustRecord,
  VerifiedTrustFilter,
  VerificationStatistics,
  BlockchainVerificationDetails,
  VerifiedTrustFilterSchema,
  VerificationStatisticsSchema,
  BlockchainVerificationDetailsSchema,
  calculateVerificationRate,
  formatBlockchainVerificationDetails,
  getBlockchainExplorerUrl,
} from '../types/trust';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get verification statistics for a user
 */
async function getUserVerificationStatistics(
  userId: string
): Promise<VerificationStatistics> {
  const trusts = await db.trustRecord.findMany({
    where: { userId },
  });

  const verifiedTrusts = trusts.filter((t) => t.isVerified);
  const pendingTrusts = trusts.filter(
    (t) => t.blockchainStatus === 'recording' || t.blockchainStatus === 'recorded'
  );
  const failedTrusts = trusts.filter((t) => t.blockchainStatus === 'failed');
  const notRecordedTrusts = trusts.filter(
    (t) => t.blockchainStatus === 'not_recorded'
  );

  const verificationRate = calculateVerificationRate(
    verifiedTrusts.length,
    trusts.length
  );

  return {
    totalTrusts: trusts.length,
    verifiedTrusts: verifiedTrusts.length,
    pendingTrusts: pendingTrusts.length,
    failedTrusts: failedTrusts.length,
    notRecordedTrusts: notRecordedTrusts.length,
    verificationRate,
  };
}

/**
 * Format trust record with blockchain details
 */
function formatTrustWithBlockchainDetails(
  trust: TrustRecord,
  explorerBaseUrl: string
): TrustRecord & { blockchainDetails: BlockchainVerificationDetails } {
  return {
    ...trust,
    blockchainDetails: formatBlockchainVerificationDetails(
      trust,
      explorerBaseUrl
    ),
  };
}

// ============================================================================
// tRPC Router
// ============================================================================

export const verifiedTrustsRouter = router({
  /**
   * Get all verified trusts for the current user
   * 
   * Query Parameters:
   * - limit: number (default: 20, max: 100)
   * - offset: number (default: 0)
   * - sortBy: 'verificationTimestamp' | 'createdAt' | 'amount' (default: 'verificationTimestamp')
   * - sortOrder: 'asc' | 'desc' (default: 'desc')
   * 
   * Returns:
   * - data: VerifiedTrustRecord[]
   * - total: number
   * - limit: number
   * - offset: number
   * - hasMore: boolean
   * - statistics: VerificationStatistics
   * 
   * Example:
   * const result = await trpc.verifiedTrusts.getAll.query({
   *   limit: 10,
   *   offset: 0,
   *   sortBy: 'verificationTimestamp',
   *   sortOrder: 'desc'
   * });
   */
  getAll: protectedProcedure
    .input(VerifiedTrustFilterSchema.partial())
    .query(async ({ input, ctx }) => {
      const filter: VerifiedTrustFilter = {
        userId: ctx.user.id,
        limit: input.limit ?? 20,
        offset: input.offset ?? 0,
        sortBy: input.sortBy ?? 'verificationTimestamp',
        sortOrder: input.sortOrder ?? 'desc',
      };

      // Validate limit
      if (filter.limit > 100) {
        filter.limit = 100;
      }

      // Build sort order
      const orderBy: Record<string, 'asc' | 'desc'> = {};
      orderBy[filter.sortBy] = filter.sortOrder;

      // Query verified trusts
      const [trusts, total] = await Promise.all([
        db.trustRecord.findMany({
          where: {
            userId: filter.userId,
            isVerified: true,
          },
          orderBy,
          take: filter.limit,
          skip: filter.offset,
        }),
        db.trustRecord.count({
          where: {
            userId: filter.userId,
            isVerified: true,
          },
        }),
      ]);

      // Get statistics
      const statistics = await getUserVerificationStatistics(filter.userId);

      return {
        data: trusts,
        total,
        limit: filter.limit,
        offset: filter.offset,
        hasMore: filter.offset + filter.limit < total,
        statistics,
      };
    }),

  /**
   * Get a specific verified trust by ID
   * 
   * Parameters:
   * - id: string (trust record ID)
   * 
   * Returns:
   * - TrustRecord with blockchain details
   * 
   * Throws:
   * - NOT_FOUND if trust doesn't exist or isn't verified
   * - FORBIDDEN if user doesn't own the trust
   * 
   * Example:
   * const trust = await trpc.verifiedTrusts.getById.query({ id: 'trust-123' });
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const trust = await db.trustRecord.findUnique({
        where: { id: input.id },
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      if (!trust.isVerified) {
        throw new Error('Trust record is not verified');
      }

      return formatTrustWithBlockchainDetails(
        trust,
        process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
      );
    }),

  /**
   * Search verified trusts by name or beneficiary
   * 
   * Parameters:
   * - query: string (search term)
   * - limit: number (default: 20, max: 100)
   * - offset: number (default: 0)
   * 
   * Returns:
   * - data: TrustRecord[]
   * - total: number
   * - limit: number
   * - offset: number
   * - hasMore: boolean
   * 
   * Example:
   * const results = await trpc.verifiedTrusts.search.query({
   *   query: 'Smith',
   *   limit: 10
   * });
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const searchTerm = `%${input.query}%`;

      const [trusts, total] = await Promise.all([
        db.trustRecord.findMany({
          where: {
            AND: [
              { userId: ctx.user.id },
              { isVerified: true },
              {
                OR: [
                  { trustName: { contains: input.query } },
                  { beneficiary: { contains: input.query } },
                ],
              },
            ],
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { verificationTimestamp: 'desc' },
        }),
        db.trustRecord.count({
          where: {
            AND: [
              { userId: ctx.user.id },
              { isVerified: true },
              {
                OR: [
                  { trustName: { contains: input.query } },
                  { beneficiary: { contains: input.query } },
                ],
              },
            ],
          },
        }),
      ]);

      return {
        data: trusts,
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get verification statistics for the current user
   * 
   * Returns:
   * - totalTrusts: number
   * - verifiedTrusts: number
   * - pendingTrusts: number
   * - failedTrusts: number
   * - notRecordedTrusts: number
   * - verificationRate: number (0-100)
   * 
   * Example:
   * const stats = await trpc.verifiedTrusts.getStatistics.query();
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    return await getUserVerificationStatistics(ctx.user.id);
  }),

  /**
   * Get verified trusts by blockchain status
   * 
   * Parameters:
   * - status: 'recorded' | 'verified' | 'failed'
   * - limit: number (default: 20, max: 100)
   * - offset: number (default: 0)
   * 
   * Returns:
   * - data: TrustRecord[]
   * - total: number
   * - limit: number
   * - offset: number
   * - hasMore: boolean
   * 
   * Example:
   * const recordedTrusts = await trpc.verifiedTrusts.getByStatus.query({
   *   status: 'recorded'
   * });
   */
  getByStatus: protectedProcedure
    .input(
      z.object({
        status: z.enum(['recorded', 'verified', 'failed']),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const [trusts, total] = await Promise.all([
        db.trustRecord.findMany({
          where: {
            userId: ctx.user.id,
            blockchainStatus: input.status,
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { verificationTimestamp: 'desc' },
        }),
        db.trustRecord.count({
          where: {
            userId: ctx.user.id,
            blockchainStatus: input.status,
          },
        }),
      ]);

      return {
        data: trusts,
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get verified trusts within a date range
   * 
   * Parameters:
   * - startDate: Date
   * - endDate: Date
   * - limit: number (default: 20, max: 100)
   * - offset: number (default: 0)
   * 
   * Returns:
   * - data: TrustRecord[]
   * - total: number
   * - limit: number
   * - offset: number
   * - hasMore: boolean
   * 
   * Example:
   * const recentTrusts = await trpc.verifiedTrusts.getByDateRange.query({
   *   startDate: new Date('2025-12-01'),
   *   endDate: new Date('2025-12-31')
   * });
   */
  getByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const [trusts, total] = await Promise.all([
        db.trustRecord.findMany({
          where: {
            userId: ctx.user.id,
            isVerified: true,
            verificationTimestamp: {
              gte: input.startDate,
              lte: input.endDate,
            },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { verificationTimestamp: 'desc' },
        }),
        db.trustRecord.count({
          where: {
            userId: ctx.user.id,
            isVerified: true,
            verificationTimestamp: {
              gte: input.startDate,
              lte: input.endDate,
            },
          },
        }),
      ]);

      return {
        data: trusts,
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get verified trusts by amount range
   * 
   * Parameters:
   * - minAmount: number
   * - maxAmount: number
   * - limit: number (default: 20, max: 100)
   * - offset: number (default: 0)
   * 
   * Returns:
   * - data: TrustRecord[]
   * - total: number
   * - limit: number
   * - offset: number
   * - hasMore: boolean
   * 
   * Example:
   * const highValueTrusts = await trpc.verifiedTrusts.getByAmountRange.query({
   *   minAmount: 100000,
   *   maxAmount: 1000000
   * });
   */
  getByAmountRange: protectedProcedure
    .input(
      z.object({
        minAmount: z.number().nonnegative(),
        maxAmount: z.number().positive(),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const [trusts, total] = await Promise.all([
        db.trustRecord.findMany({
          where: {
            userId: ctx.user.id,
            isVerified: true,
            amount: {
              gte: input.minAmount,
              lte: input.maxAmount,
            },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { amount: 'desc' },
        }),
        db.trustRecord.count({
          where: {
            userId: ctx.user.id,
            isVerified: true,
            amount: {
              gte: input.minAmount,
              lte: input.maxAmount,
            },
          },
        }),
      ]);

      return {
        data: trusts,
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get blockchain verification details for a trust
   * 
   * Parameters:
   * - id: string (trust record ID)
   * 
   * Returns:
   * - BlockchainVerificationDetails
   * 
   * Example:
   * const details = await trpc.verifiedTrusts.getBlockchainDetails.query({
   *   id: 'trust-123'
   * });
   */
  getBlockchainDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const trust = await db.trustRecord.findUnique({
        where: { id: input.id },
      });

      if (!trust) {
        throw new Error('Trust record not found');
      }

      if (trust.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      return formatBlockchainVerificationDetails(
        trust,
        process.env.BESU_EXPLORER_URL || 'http://localhost:4000'
      );
    }),

  /**
   * Export verified trusts as JSON
   * 
   * Parameters:
   * - format: 'json' | 'csv'
   * 
   * Returns:
   * - data: string (JSON or CSV formatted)
   * - filename: string
   * - contentType: string
   * 
   * Example:
   * const exported = await trpc.verifiedTrusts.export.query({
   *   format: 'json'
   * });
   */
  export: protectedProcedure
    .input(z.object({ format: z.enum(['json', 'csv']).default('json') }))
    .query(async ({ input, ctx }) => {
      const trusts = await db.trustRecord.findMany({
        where: {
          userId: ctx.user.id,
          isVerified: true,
        },
        orderBy: { verificationTimestamp: 'desc' },
      });

      if (input.format === 'json') {
        return {
          data: JSON.stringify(trusts, null, 2),
          filename: `verified-trusts-${new Date().toISOString().split('T')[0]}.json`,
          contentType: 'application/json',
        };
      } else {
        // CSV format
        const headers = [
          'ID',
          'Name',
          'Amount',
          'Beneficiary',
          'Maturity Date',
          'Verified',
          'Verification Date',
          'Transaction Hash',
          'Block Number',
        ];

        const rows = trusts.map((t) => [
          t.id,
          t.trustName,
          t.amount,
          t.beneficiary,
          t.maturityDate.toISOString(),
          t.isVerified ? 'Yes' : 'No',
          t.verificationTimestamp?.toISOString() || '',
          t.transactionHash || '',
          t.blockNumber || '',
        ]);

        const csv =
          headers.join(',') +
          '\n' +
          rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');

        return {
          data: csv,
          filename: `verified-trusts-${new Date().toISOString().split('T')[0]}.csv`,
          contentType: 'text/csv',
        };
      }
    }),
});

// ============================================================================
// Export router
// ============================================================================

export type VerifiedTrustsRouter = typeof verifiedTrustsRouter;
