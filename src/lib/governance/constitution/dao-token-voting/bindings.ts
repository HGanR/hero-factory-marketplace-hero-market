export type DaoFieldBinding = {
  key: string;
  path: string;
  required: boolean | "conditional";
  answerType: "text" | "number" | "select" | "multiselect" | "boolean";
  question: string;
  constraints?: Record<string, unknown>;
  options?: string[];
};

export const DAO_SCHEMA_VERSION = "1.0.0";

export const DAO_FIELD_BINDINGS: Record<string, DaoFieldBinding> = {
  daoName: { key: "daoName", path: "/constitutionDraft/data/daoName", required: true, answerType: "text", question: "What is the DAO name?" },
  mission: { key: "mission", path: "/constitutionDraft/data/mission", required: true, answerType: "text", question: "Summarize the DAO mission/purpose (1-2 sentences)." },
  chain: {
    key: "chain",
    path: "/constitutionDraft/data/chain",
    required: true,
    answerType: "select",
    question: "Which chain is primary for governance?",
    options: ["ethereum", "polygon", "arbitrum", "optimism", "base", "other"],
  },
  tokenSymbol: { key: "tokenSymbol", path: "/constitutionDraft/data/tokenSymbol", required: true, answerType: "text", question: "What is the governance token symbol?" },
  tokenAddress: { key: "tokenAddress", path: "/constitutionDraft/data/tokenAddress", required: false, answerType: "text", question: "What is the token contract address (0x...)?" },
  governancePlatform: {
    key: "governancePlatform",
    path: "/constitutionDraft/data/governancePlatform",
    required: true,
    answerType: "select",
    question: "Which governance platform is used?",
    options: ["snapshot", "tally", "compound_governor", "aragon", "other"],
  },
  votingUnit: {
    key: "votingUnit",
    path: "/constitutionDraft/data/votingUnit",
    required: true,
    answerType: "select",
    question: "What voting model should be used?",
    options: ["token_weighted", "delegated_token_weighted"],
  },
  proposalTypes: {
    key: "proposalTypes",
    path: "/constitutionDraft/data/proposalTypes",
    required: true,
    answerType: "multiselect",
    question: "List the proposal types to allow (comma-separated).",
    options: [
      "parameter_change",
      "treasury_spend",
      "grant",
      "upgrade",
      "council_election",
      "constitution_amendment",
      "emergency_action",
    ],
  },
  quorumBps: {
    key: "quorumBps",
    path: "/constitutionDraft/data/quorumBps",
    required: true,
    answerType: "number",
    question: "What quorum should proposals require (bps)?",
    constraints: { min: 0, max: 10000, unit: "bps" },
  },
  approvalBps: {
    key: "approvalBps",
    path: "/constitutionDraft/data/approvalBps",
    required: true,
    answerType: "number",
    question: "What approval threshold should proposals require (bps)?",
    constraints: { min: 0, max: 10000, unit: "bps" },
  },
  supermajorityBps: {
    key: "supermajorityBps",
    path: "/constitutionDraft/data/supermajorityBps",
    required: true,
    answerType: "number",
    question: "What supermajority threshold is required for sensitive votes (bps)?",
    constraints: { min: 0, max: 10000, unit: "bps" },
  },
  votingPeriodDays: {
    key: "votingPeriodDays",
    path: "/constitutionDraft/data/votingPeriodDays",
    required: true,
    answerType: "number",
    question: "How many days should voting remain open?",
    constraints: { min: 1, max: 60, unit: "days" },
  },
  timelockHours: {
    key: "timelockHours",
    path: "/constitutionDraft/data/timelockHours",
    required: true,
    answerType: "number",
    question: "How many hours should a timelock delay execution?",
    constraints: { min: 0, max: 720, unit: "hours" },
  },
  treasuryType: {
    key: "treasuryType",
    path: "/constitutionDraft/data/treasuryType",
    required: true,
    answerType: "select",
    question: "What treasury control model should apply?",
    options: ["multisig", "timelock_contract", "both"],
  },
  multisigAddress: {
    key: "multisigAddress",
    path: "/constitutionDraft/data/multisigAddress",
    required: "conditional",
    answerType: "text",
    question: "Provide the treasury multisig address (0x...).",
  },
  spendingLimitUsd: {
    key: "spendingLimitUsd",
    path: "/constitutionDraft/data/spendingLimitUsd",
    required: false,
    answerType: "number",
    question: "Optional: set a spending limit in USD (number).",
    constraints: { min: 0 },
  },
  emergencyCouncilEnabled: {
    key: "emergencyCouncilEnabled",
    path: "/constitutionDraft/data/emergencyCouncilEnabled",
    required: true,
    answerType: "boolean",
    question: "Enable an emergency council?",
  },
  emergencyCouncilMembers: {
    key: "emergencyCouncilMembers",
    path: "/constitutionDraft/data/emergencyCouncilMembers",
    required: "conditional",
    answerType: "multiselect",
    question: "List emergency council members (comma-separated names).",
  },
  emergencyPowers: {
    key: "emergencyPowers",
    path: "/constitutionDraft/data/emergencyPowers",
    required: false,
    answerType: "multiselect",
    question: "Which emergency powers should be allowed (comma-separated)?",
    options: ["pause", "cancel_proposal", "freeze_treasury", "rollback_upgrade"],
  },
  conflictOfInterestPolicy: {
    key: "conflictOfInterestPolicy",
    path: "/constitutionDraft/data/conflictOfInterestPolicy",
    required: false,
    answerType: "boolean",
    question: "Enable conflict-of-interest policy?",
  },
  recordsTransparency: {
    key: "recordsTransparency",
    path: "/constitutionDraft/data/recordsTransparency",
    required: true,
    answerType: "select",
    question: "Select transparency level.",
    options: ["public", "members_only", "mixed"],
  },
  disputeResolution: {
    key: "disputeResolution",
    path: "/constitutionDraft/data/disputeResolution",
    required: true,
    answerType: "select",
    question: "Select dispute resolution path.",
    options: ["internal_mediation", "arbitration", "court"],
  },
  amendmentRequiresSupermajority: {
    key: "amendmentRequiresSupermajority",
    path: "/constitutionDraft/data/amendmentRequiresSupermajority",
    required: true,
    answerType: "boolean",
    question: "Require supermajority for amendments?",
  },
} as const;

export const DAO_FIELD_ORDER = Object.keys(DAO_FIELD_BINDINGS);

export function getDaoBindingByPath(path: string): DaoFieldBinding | null {
  const entry = Object.values(DAO_FIELD_BINDINGS).find((b) => path.startsWith(b.path));
  return entry ?? null;
}
