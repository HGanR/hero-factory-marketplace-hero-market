/**
 * Structured document generation — text + source fields for audit and re-generation.
 * Not legal advice; templates for user editing before sending.
 */

export type DocumentKind =
  | "dispute_letter"
  | "creditor_verification_letter"
  | "debt_validation_letter"
  | "cease_communication_notice";

export type DisputeLetterSources = {
  consumerName: string;
  consumerAddress: string;
  creditor: string;
  accountLast4: string;
  reason: string;
  details: string;
  bureau?: string;
};

export type CreditorVerificationSources = {
  consumerName: string;
  consumerAddress: string;
  creditor: string;
  accountLast4: string;
  itemDescription: string;
  recordsRequested: string;
};

export type DebtValidationSources = {
  consumerName: string;
  consumerAddress: string;
  collectorName: string;
  accountReference: string;
  allegedAmount: string;
};

export type CeaseCommunicationSources = {
  consumerName: string;
  consumerAddress: string;
  collectorName: string;
  accountReference: string;
};

export type DocumentSources =
  | { kind: "dispute_letter"; data: DisputeLetterSources }
  | { kind: "creditor_verification_letter"; data: CreditorVerificationSources }
  | { kind: "debt_validation_letter"; data: DebtValidationSources }
  | { kind: "cease_communication_notice"; data: CeaseCommunicationSources };

export function buildDisputeLetter(s: DisputeLetterSources): { text: string; sources: DisputeLetterSources } {
  const date = new Date().toLocaleDateString();
  const bureauLine = s.bureau?.trim() ? ` (${s.bureau})` : "";
  const text = [
    date,
    "",
    s.consumerName,
    s.consumerAddress,
    "",
    `Re: Dispute — ${s.creditor} — Account ending ${s.accountLast4}${bureauLine}`,
    "",
    "To Whom It May Concern,",
    "",
    `I am disputing the accuracy of the information reported for the above-referenced account. Reason: ${s.reason}.`,
    "",
    s.details.trim() || "Please investigate this tradeline with the furnisher and correct or delete inaccurate information.",
    "",
    "Please complete your investigation and respond within applicable timelines.",
    "",
    "Sincerely,",
    s.consumerName,
  ].join("\n");
  return { text, sources: { ...s } };
}

export function buildCreditorVerificationLetter(s: CreditorVerificationSources): {
  text: string;
  sources: CreditorVerificationSources;
} {
  const date = new Date().toLocaleDateString();
  const text = [
    date,
    "",
    s.consumerName,
    s.consumerAddress,
    "",
    s.creditor,
    `Re: Verification — Account ending ${s.accountLast4}`,
    "",
    "Dear Sir or Madam,",
    "",
    `I am requesting verification of the following item: ${s.itemDescription}`,
    "",
    "Please provide:",
    s.recordsRequested.trim() || "- Documentation supporting the reported balance and account status.",
    "",
    "Sincerely,",
    s.consumerName,
  ].join("\n");
  return { text, sources: { ...s } };
}

export function buildDebtValidationLetter(s: DebtValidationSources): {
  text: string;
  sources: DebtValidationSources;
} {
  const date = new Date().toLocaleDateString();
  const text = [
    date,
    "",
    s.consumerName,
    s.consumerAddress,
    "",
    s.collectorName,
    `Re: Debt validation — Ref: ${s.accountReference}`,
    "",
    "Dear Sir or Madam,",
    "",
    "I am requesting validation of the alleged debt referenced above.",
    "",
    `Alleged amount (if stated): ${s.allegedAmount || "[not stated]"}`,
    "",
    "Please provide:",
    "- Name and address of the original creditor",
    "- Account number and documentation of the debt",
    "- Verification of your authority to collect",
    "",
    "Until validation is provided as required by law, please cease collection activity.",
    "",
    "Sincerely,",
    s.consumerName,
  ].join("\n");
  return { text, sources: { ...s } };
}

export function buildCeaseCommunicationNotice(s: CeaseCommunicationSources): {
  text: string;
  sources: CeaseCommunicationSources;
} {
  const date = new Date().toLocaleDateString();
  const text = [
    date,
    "",
    s.consumerName,
    s.consumerAddress,
    "",
    s.collectorName,
    `Re: Cease communication — ${s.accountReference}`,
    "",
    "Dear Sir or Madam,",
    "",
    "Pursuant to the Fair Debt Collection Practices Act, I request that you cease all further communication with me regarding this debt, except to notify me that collection efforts are being terminated or that you intend to pursue a specific legally permitted remedy.",
    "",
    "Sincerely,",
    s.consumerName,
  ].join("\n");
  return { text, sources: { ...s } };
}

export function documentTitle(kind: DocumentKind): string {
  switch (kind) {
    case "dispute_letter":
      return "Credit dispute letter";
    case "creditor_verification_letter":
      return "Creditor verification letter";
    case "debt_validation_letter":
      return "Debt validation letter";
    case "cease_communication_notice":
      return "Cease communication notice";
  }
}
