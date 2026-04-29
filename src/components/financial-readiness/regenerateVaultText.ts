import {
  buildCeaseCommunicationNotice,
  buildCreditorVerificationLetter,
  buildDebtValidationLetter,
  buildDisputeLetter,
} from "./documentModels";
import type { VaultDocument } from "./vaultTypes";

/** Rebuild letter body from stored sources. */
export function regenerateVaultText(doc: VaultDocument): { text: string } {
  switch (doc.type) {
    case "bureau_dispute": {
      const { text } = buildDisputeLetter(doc.sources as import("./documentModels").DisputeLetterSources);
      return { text };
    }
    case "creditor_verification": {
      const { text } = buildCreditorVerificationLetter(
        doc.sources as import("./documentModels").CreditorVerificationSources
      );
      return { text };
    }
    case "debt_validation": {
      const { text } = buildDebtValidationLetter(doc.sources as import("./documentModels").DebtValidationSources);
      return { text };
    }
    case "cease_communication": {
      const { text } = buildCeaseCommunicationNotice(
        doc.sources as import("./documentModels").CeaseCommunicationSources
      );
      return { text };
    }
  }
}
