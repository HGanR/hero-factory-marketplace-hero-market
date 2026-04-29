import { z } from "zod";

export const RevenueProfileSchema = z.object({
  userId: z.string().min(1),
  walletAddress: z.string().optional(),

  businessName: z.string().max(160).optional(),
  businessType: z.string().max(120).optional(),
  market: z.string().max(120).optional(),

  currentMonthlyRevenue: z.number().nonnegative(),
  targetMonthlyRevenue: z.number().positive(),

  avgOrderValue: z.number().positive(),
  grossMarginPct: z.number().min(0).max(100),

  monthlyTraffic: z.number().int().nonnegative(),
  conversionRatePct: z.number().min(0).max(100),

  cac: z.number().nonnegative(),
  ltv: z.number().nonnegative(),

  constraints: z.record(z.string(), z.any()).optional(),
  notes: z.string().max(5000).optional(),
});

export const RevenueOsAnalyzeRequestSchema = z.object({
  profile: RevenueProfileSchema,
  scenarioOverrides: z
    .object({
      monthlyTraffic: z.number().int().nonnegative().optional(),
      conversionRatePct: z.number().min(0).max(100).optional(),
      avgOrderValue: z.number().positive().optional(),
      cac: z.number().nonnegative().optional(),
    })
    .optional(),
});

export type RevenueOsAnalyzeRequest = z.infer<typeof RevenueOsAnalyzeRequestSchema>;

export const RevenueOsAnalyzeResponseSchema = z.object({
  kpis: z.object({
    currentMonthlyRevenueModel: z.number(),
    targetMonthlyRevenue: z.number(),
    revenueGap: z.number(),
    impliedOrdersNeeded: z.number(),
  }),
  levers: z.object({
    traffic: z.object({
      current: z.number(),
      target: z.number(),
      delta: z.number(),
    }),
    conversionRatePct: z.object({
      current: z.number(),
      target: z.number(),
      delta: z.number(),
    }),
    avgOrderValue: z.object({
      current: z.number(),
      target: z.number(),
      delta: z.number(),
    }),
    cac: z.object({
      current: z.number(),
      target: z.number(),
      delta: z.number(),
    }),
  }),
  plan: z.object({
    offerEngineering: z.array(z.string()),
    funnel: z.array(z.string()),
    sales: z.array(z.string()),
    capitalAllocation: z.array(z.string()),
    optimization: z.array(z.string()),
  }),
  projections: z.object({
    base: z.object({
      traffic: z.number(),
      conversionRatePct: z.number(),
      avgOrderValue: z.number(),
      revenue: z.number(),
    }),
    target: z.object({
      traffic: z.number(),
      conversionRatePct: z.number(),
      avgOrderValue: z.number(),
      revenue: z.number(),
    }),
  }),
  meta: z.object({
    inputHash: z.string(),
    createdAt: z.string(),
    /** `revenue_profiles.id` after upsert — links capital plans & channel spend. */
    profileId: z.string().optional(),
  }),
});

export type RevenueOsAnalyzeResponse = z.infer<typeof RevenueOsAnalyzeResponseSchema>;

export const RevenueOsApplySchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email().max(190),
  businessSummary: z.string().min(10).max(10000),
  userId: z.string().min(1).optional(),
  walletAddress: z.string().optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
});

export type RevenueOsApplyRequest = z.infer<typeof RevenueOsApplySchema>;
