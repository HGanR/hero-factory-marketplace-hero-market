import { z } from "zod";
import { JarvaPartyIntakeSchema } from "@/lib/jarva/trust-intake-schema";

export const TrustPartyIntakeSchema = JarvaPartyIntakeSchema;

export const TrustExistingDocumentsSchema = z.object({
  hasPourOverWill: z.boolean().optional(),
  hasPriorTrust: z.boolean().optional(),
  attorneyEngaged: z.boolean().optional(),
  documentNotes: z.string().trim().max(4000).optional(),
});

export const ClaudeTrustIntakeSchema = z.object({
  trustPurpose: z.string().trim().max(20000).optional(),
  partiesInvolved: z
    .object({
      grantor: TrustPartyIntakeSchema.optional(),
      trustee: TrustPartyIntakeSchema.optional(),
      beneficiariesSummary: z.string().trim().max(20000).optional(),
      protectorNote: z.string().trim().max(5000).optional(),
    })
    .optional(),
  trusteePreferences: z
    .object({
      successorTrusteeNote: z.string().trim().max(5000).optional(),
      coTrusteeNote: z.string().trim().max(5000).optional(),
    })
    .optional(),
  protectorPreferences: z.string().trim().max(5000).optional(),
  assetCategories: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  familyBusinessContext: z.string().trim().max(10000).optional(),
  jurisdictionState: z.string().trim().max(10).optional(),
  urgency: z.enum(["low", "normal", "high", "rush"]).optional(),
  existingDocuments: TrustExistingDocumentsSchema.optional(),
  desiredOutputPackage: z
    .enum(["trust_review_packet", "smart_trust_setup_brief", "both"])
    .optional(),
});

export type ClaudeTrustIntake = z.infer<typeof ClaudeTrustIntakeSchema>;

export const TRUST_INTAKE_READINESS_TIERS = ["weak", "medium", "strong"] as const;

export type TrustIntakeReadinessTier = (typeof TRUST_INTAKE_READINESS_TIERS)[number];

export type TrustIntakeNormalized = {
  trustPurpose: string | null;
  grantorName: string | null;
  trusteeName: string | null;
  beneficiariesSummary: string | null;
  successorTrusteeNote: string | null;
  protectorNote: string | null;
  assetCategories: string[];
  familyBusinessContext: string | null;
  jurisdictionState: string | null;
  urgency: "low" | "normal" | "high" | "rush" | null;
  existingDocuments: {
    hasPourOverWill: boolean | null;
    hasPriorTrust: boolean | null;
    attorneyEngaged: boolean | null;
    documentNotes: string | null;
  };
  desiredOutputPackage: "trust_review_packet" | "smart_trust_setup_brief" | "both";
};

export type TrustIntakeReadiness = {
  tier: TrustIntakeReadinessTier;
  score: number;
  fulfillmentReady: boolean;
  missingFields: string[];
  presentFields: string[];
  legalAdvisories: string[];
};

export type TrustIntakePackage = {
  normalized: TrustIntakeNormalized;
  readiness: TrustIntakeReadiness;
  skipperSummary: string;
  trustBrief: string;
};

export type TrustIntakeSnapshot = {
  normalized: TrustIntakeNormalized;
  readiness: TrustIntakeReadiness;
  skipperSummary: string;
  trustBrief: string;
};
