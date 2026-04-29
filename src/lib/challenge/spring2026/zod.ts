// src/lib/challenge/spring2026/zod.ts
import { z } from "zod";

export const OwnershipSplitSchema = z.object({
  name: z.string().min(1).max(200),
  pct: z.number().min(0).max(100),
  role: z.string().max(80).optional(),
});

export const SpringAnswersSchema = z.object({
  phase1: z.object({
    entityType: z.enum(["llc", "c-corp", "s-corp", "partnership", "sole-prop"]),
    jurisdiction: z.string().min(2).max(100),
    businessPurpose: z.string().min(10).max(500),
  }),
  phase2: z.object({
    owners: z.array(OwnershipSplitSchema).min(1).max(10),
    totalPct: z.number().optional(),
  }),
  phase3: z.object({
    operatingAgreement: z.boolean(),
    capTable: z.boolean(),
    bankAccountSim: z.enum(["yes", "no", "pending"]),
    einSim: z.enum(["yes", "no", "pending"]),
  }),
  phase4: z.object({
    complianceChecklist: z.array(z.string()).min(1).max(20),
    filingAwareness: z.array(z.string()).min(0).max(10),
  }),
  phase5: z.object({
    governanceChoice: z.enum(["member-managed", "manager-managed"]),
    annualMeeting: z.boolean(),
    recordkeeping: z.boolean(),
  }),
});

export type SpringAnswers = z.infer<typeof SpringAnswersSchema>;
export type OwnershipSplit = z.infer<typeof OwnershipSplitSchema>;

export const StartPayloadSchema = z.object({
  consented: z.literal(true),
});
export type StartPayload = z.infer<typeof StartPayloadSchema>;

export const SaveAnswersPayloadSchema = z.object({
  submissionId: z.string().min(1).max(64),
  answers: SpringAnswersSchema.partial(),
});
export type SaveAnswersPayload = z.infer<typeof SaveAnswersPayloadSchema>;

export const SubmitPayloadSchema = z.object({
  submissionId: z.string().min(1).max(64),
  answers: SpringAnswersSchema,
});
export type SubmitPayload = z.infer<typeof SubmitPayloadSchema>;

export const ApplyCreditPayloadSchema = z.object({
  submissionId: z.string().min(1).max(64),
});
export type ApplyCreditPayload = z.infer<typeof ApplyCreditPayloadSchema>;
