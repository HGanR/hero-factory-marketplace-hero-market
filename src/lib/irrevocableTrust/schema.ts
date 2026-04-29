import { z } from "zod";

export const US_STATE_CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

export type StateCode = typeof US_STATE_CODES[number];

export const StepStateSchema = z.object({
  governingState: z.enum(US_STATE_CODES),
  county: z.string().min(1).optional(),
  effectiveDate: z.string().min(4), // ISO date recommended
});

export const PersonSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.enum(US_STATE_CODES),
  postalCode: z.string().min(3),
});

export const StepPartiesSchema = z.object({
  grantor: PersonSchema,
  trustees: z.array(PersonSchema).min(1),
  successorTrustees: z.array(PersonSchema).optional().default([]),
  beneficiaries: z.array(z.object({
    person: PersonSchema,
    sharePct: z.number().min(0).max(100),
    contingent: z.boolean().optional().default(false),
  })).min(1),
});

export const StepTrustTermsSchema = z.object({
  trustName: z.string().min(1), // Trust name is free-form, no "Express" requirement
  trustType: z.enum(["IrrevocableLivingTrust","ILIT","SpecialNeeds","AssetProtection","Charitable","PrivateExpressTrust"]),
  trustCategory: z.enum(["private", "charitable", "statutory"]).default("private"),
  formationMode: z.enum(["express", "resulting", "constructive"]).default("express"), // All platform trusts are express by default
  governanceMode: z.enum(["simple", "complex"]).default("simple"),
  commercialEnabled: z.boolean().default(false), // Explicit authorization for commercial entity ownership
  sCorpEligible: z.boolean().default(false), // Must be true to own S Corporations
  trustSubtype: z.enum(["standard", "grantor", "QSST", "ESBT"]).default("standard"), // For S Corp qualification
  irsElectionConfirmed: z.boolean().default(false), // IRS election confirmation for qualified trusts
  purposeNotes: z.string().optional(),
  spendthrift: z.boolean().default(true),
  noAmendmentAcknowledgement: z.boolean(), // must be true
  taxNotes: z.string().optional(),
});

export const StepDistributionsSchema = z.object({
  distributionStandard: z.enum(["HEMS","Discretionary","MandatorySchedule","Hybrid"]),
  scheduleNotes: z.string().optional(),
  ageStaging: z.array(z.object({
    age: z.number().min(0).max(120),
    pct: z.number().min(0).max(100),
  })).optional().default([]),
});

export const StepPowersSchema = z.object({
  trusteePowersBroad: z.boolean().default(true),
  includeRealEstatePowers: z.boolean().default(true),
  includeInvestmentPowers: z.boolean().default(true),
  includeBusinessPowers: z.boolean().default(false),
  protectorEnabled: z.boolean().default(false),
  protector: PersonSchema.optional(),
});

export const StepFundingSchema = z.object({
  initialFundingSummary: z.string().min(1),
  assets: z.array(z.object({
    label: z.string().min(1),
    category: z.enum(["Cash","RealEstate","Securities","BusinessInterest","PersonalProperty","Other"]),
    estValue: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).optional().default([]),
  transferPlanAcknowledgement: z.boolean(), // must be true
});

export const StepReviewSchema = z.object({
  confirmAccuracy: z.boolean(),
  confirmIrrevocable: z.boolean(),
  confirmNotLegalAdvice: z.boolean(),
});

export const IrrevocableTrustWizardSchema = z.object({
  state: StepStateSchema,
  parties: StepPartiesSchema,
  terms: StepTrustTermsSchema,
  distributions: StepDistributionsSchema,
  powers: StepPowersSchema,
  funding: StepFundingSchema,
  review: StepReviewSchema,
});

export type IrrevocableTrustWizardData = z.infer<typeof IrrevocableTrustWizardSchema>;
export type StepStateData = z.infer<typeof StepStateSchema>;
export type StepPartiesData = z.infer<typeof StepPartiesSchema>;
export type StepTrustTermsData = z.infer<typeof StepTrustTermsSchema>;
export type StepDistributionsData = z.infer<typeof StepDistributionsSchema>;
export type StepPowersData = z.infer<typeof StepPowersSchema>;
export type StepFundingData = z.infer<typeof StepFundingSchema>;
export type StepReviewData = z.infer<typeof StepReviewSchema>;
