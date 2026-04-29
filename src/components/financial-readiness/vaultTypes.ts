/**
 * Normalized vault / case types for Financial Readiness Center.
 */

import type {
  CeaseCommunicationSources,
  CreditorVerificationSources,
  DebtValidationSources,
  DisputeLetterSources,
} from "./documentModels";

export type VaultDocumentType =
  | "bureau_dispute"
  | "creditor_verification"
  | "debt_validation"
  | "cease_communication";

export type DocumentLifecycleStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_response"
  | "follow_up_due"
  | "completed"
  | "escalated";

export type FrModule = "foundation" | "optimization" | "resolution";

export type VaultDocument = {
  id: string;
  type: VaultDocumentType;
  module: FrModule;
  status: DocumentLifecycleStatus;
  primaryParty: string;
  createdAt: string;
  updatedAt: string;
  followUpDueAt: string | null;
  tags: string[];
  text: string;
  sources: DisputeLetterSources | CreditorVerificationSources | DebtValidationSources | CeaseCommunicationSources;
  caseId: string | null;
};

export type CaseModule = "optimization" | "resolution";

export type FrCase = {
  id: string;
  label: string;
  module: CaseModule;
  status: DocumentLifecycleStatus;
  primaryParty: string;
  documentIds: string[];
  interactionIds: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  followUpDueAt: string | null;
  tags: string[];
};
