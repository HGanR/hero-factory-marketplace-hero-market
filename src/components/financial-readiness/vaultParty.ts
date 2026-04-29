import type {
  CeaseCommunicationSources,
  CreditorVerificationSources,
  DebtValidationSources,
  DisputeLetterSources,
} from "./documentModels";
import type { VaultDocument, VaultDocumentType } from "./vaultTypes";

export function inferPrimaryParty(
  type: VaultDocumentType,
  sources: VaultDocument["sources"]
): string {
  if (type === "bureau_dispute") {
    const s = sources as DisputeLetterSources;
    return s.creditor?.trim() || "Unknown creditor";
  }
  if (type === "creditor_verification") {
    const s = sources as CreditorVerificationSources;
    return s.creditor?.trim() || "Unknown creditor";
  }
  if (type === "debt_validation") {
    const s = sources as DebtValidationSources;
    return s.collectorName?.trim() || "Unknown collector";
  }
  const s = sources as CeaseCommunicationSources;
  return s.collectorName?.trim() || "Unknown collector";
}
