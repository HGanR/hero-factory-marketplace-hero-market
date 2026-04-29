// lib/jurisdictions/dapt/schema.ts
import { z } from "zod";

export type JurisdictionTier = "TOP_TIER" | "ADVISORY_ONLY" | "RESTRICTED";

export const DaptJurisdictionSchema = z.object({
  stateCode: z.string().min(2).max(2), // e.g., "NV"
  stateName: z.string().min(2),

  // DAPT statute reference
  daptLegislation: z.string().min(1),
  protectionStatute: z.string().min(1),

  // RUFADAA authority reference (may be empty if unknown)
  rufadaaStatute: z.string().optional().default(""),

  // Situs / nexus mechanics
  residencyRequirement: z.string().min(1), // "Qualified Trustee (Must use NV resident/bank)" etc.

  // Fiscal profile
  stateTaxStatus: z.string().min(1), // "0%", "Taxable", etc.
  withdrawalProfile: z.string().min(1), // "Tax-free return of principal (Grantor Trust)." etc.

  // Freeform notes (case law maturity, creditor exceptions, lookback)
  notes: z.string().optional().default(""),

  // Derived flags
  tier: z.enum(["TOP_TIER", "ADVISORY_ONLY", "RESTRICTED"]),
  tags: z.array(z.string()).default([]), // e.g. ["NO_STATE_INCOME_TAX", "FAST_LIMITATIONS"]
});

export type DaptJurisdiction = z.infer<typeof DaptJurisdictionSchema>;

export const DaptJurisdictionListSchema = z.array(DaptJurisdictionSchema);