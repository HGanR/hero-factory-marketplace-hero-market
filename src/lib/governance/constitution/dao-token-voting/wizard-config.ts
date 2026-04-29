export type DaoTokenVotingConstitutionDraft = {
  subtype: "dao_token_voting";
  state: string;
  data: Record<string, unknown>;
};

export const daoTokenVotingConstitutionWizard = {
  id: "constitution_dao_token_voting",
  title: "DAO Constitution (Token Voting)",
  sections: [
    {
      id: "identity",
      title: "Identity & Purpose",
      fields: [
        { key: "daoName", type: "text", label: "DAO Name", required: true },
        { key: "mission", type: "textarea", label: "Mission / Purpose", required: true },
      ],
    },
    {
      id: "token",
      title: "Token & Chain",
      fields: [
        { key: "chain", type: "select", label: "Chain", options: ["ethereum", "polygon", "arbitrum", "optimism", "base", "other"], required: true },
        { key: "tokenSymbol", type: "text", label: "Token Symbol", required: true },
        { key: "tokenAddress", type: "text", label: "Token Address (optional)", required: false },
      ],
    },
    {
      id: "governance",
      title: "Governance Mechanics",
      fields: [
        { key: "governancePlatform", type: "select", label: "Governance Platform", options: ["snapshot", "tally", "compound_governor", "aragon", "other"], required: true },
        { key: "votingUnit", type: "select", label: "Voting Model", options: ["token_weighted", "delegated_token_weighted"], required: true },
        {
          key: "proposalTypes",
          type: "multiselect",
          label: "Proposal Types",
          options: [
            "parameter_change",
            "treasury_spend",
            "grant",
            "upgrade",
            "council_election",
            "constitution_amendment",
            "emergency_action",
          ],
          required: true,
        },
        { key: "quorumBps", type: "number", label: "Quorum (bps)", required: true },
        { key: "approvalBps", type: "number", label: "Approval threshold (bps)", required: true },
        { key: "supermajorityBps", type: "number", label: "Supermajority threshold (bps)", required: true },
        { key: "votingPeriodDays", type: "number", label: "Voting period (days)", required: true },
        { key: "timelockHours", type: "number", label: "Timelock (hours)", required: true },
      ],
    },
    {
      id: "treasury",
      title: "Treasury Controls",
      fields: [
        { key: "treasuryType", type: "select", label: "Treasury Type", options: ["multisig", "timelock_contract", "both"], required: true },
        { key: "multisigAddress", type: "text", label: "Multisig Address", required: false },
        { key: "spendingLimitUsd", type: "number", label: "Spending Limit USD (optional)", required: false },
      ],
    },
    {
      id: "safety",
      title: "Safety & Dispute Handling",
      fields: [
        { key: "emergencyCouncilEnabled", type: "toggle", label: "Enable emergency council?", required: true },
        { key: "emergencyPowers", type: "multiselect", label: "Emergency powers", options: ["pause", "cancel_proposal", "freeze_treasury", "rollback_upgrade"], required: false },
        { key: "recordsTransparency", type: "select", label: "Transparency", options: ["public", "members_only", "mixed"], required: true },
        { key: "disputeResolution", type: "select", label: "Dispute Resolution", options: ["internal_mediation", "arbitration", "court"], required: true },
      ],
    },
  ],
} as const;
