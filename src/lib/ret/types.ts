/** RET intake draft — local state until persisted sessions exist */

export type RetAgentDraft = {
  intake: {
    propertyLabel: string;
    ownerContact: string;
    notes: string;
  };
  flags: {
    titleClear: boolean;
    lienRecorded: boolean;
    mortgageActive: boolean;
  };
  structure: string;
  tokenDesign: string;
  risk: {
    securities: number;
    lender: number;
    title: number;
  };
  jurisdiction: string;
  consultantSummary: string;
  clientSummary: string;
  escalation: Record<string, boolean>;
  /** MAANIA widget: sell = RET intake; buy = buyer qualification script */
  maaniaIntakePath?: "unknown" | "sell" | "buy";
};
