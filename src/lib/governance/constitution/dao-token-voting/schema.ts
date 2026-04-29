import { z } from "zod";

export const DaoTokenVotingConstitutionSchema = z.object({
  daoName: z.string().min(2),
  mission: z.string().min(10),

  chain: z.enum(["ethereum", "polygon", "arbitrum", "optimism", "base", "other"]),
  tokenSymbol: z.string().min(1),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),

  governancePlatform: z.enum(["snapshot", "tally", "compound_governor", "aragon", "other"]),
  votingUnit: z.enum(["token_weighted", "delegated_token_weighted"]),
  proposalTypes: z.array(z.enum([
    "parameter_change",
    "treasury_spend",
    "grant",
    "upgrade",
    "council_election",
    "constitution_amendment",
    "emergency_action",
  ])).min(2),

  quorumBps: z.number().int().min(0).max(10000),
  approvalBps: z.number().int().min(0).max(10000),
  supermajorityBps: z.number().int().min(0).max(10000),
  votingPeriodDays: z.number().int().min(1).max(60),
  timelockHours: z.number().int().min(0).max(720),

  treasuryType: z.enum(["multisig", "timelock_contract", "both"]),
  multisigAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  multisigSigners: z.array(z.object({
    name: z.string().min(2),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  })).min(1).optional(),
  spendingLimitUsd: z.number().min(0).optional(),

  emergencyCouncilEnabled: z.boolean().default(false),
  emergencyCouncilMembers: z.array(z.object({
    name: z.string().min(2),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  })).optional(),
  emergencyPowers: z.array(z.enum(["pause", "cancel_proposal", "freeze_treasury", "rollback_upgrade"])).default([]),

  conflictOfInterestPolicy: z.boolean().default(true),
  recordsTransparency: z.enum(["public", "members_only", "mixed"]),
  disputeResolution: z.enum(["internal_mediation", "arbitration", "court"]).default("internal_mediation"),

  amendmentRequiresSupermajority: z.boolean().default(true),
}).superRefine((val, ctx) => {
  if (val.treasuryType !== "timelock_contract" && !val.multisigAddress) {
    ctx.addIssue({
      code: "custom",
      message: "Multisig address is required for treasuryType multisig/both",
      path: ["multisigAddress"],
    });
  }
  if (val.emergencyCouncilEnabled && (!val.emergencyCouncilMembers || val.emergencyCouncilMembers.length === 0)) {
    ctx.addIssue({
      code: "custom",
      message: "Emergency council members required when enabled",
      path: ["emergencyCouncilMembers"],
    });
  }
});

export type DaoTokenVotingConstitution = z.infer<typeof DaoTokenVotingConstitutionSchema>;
