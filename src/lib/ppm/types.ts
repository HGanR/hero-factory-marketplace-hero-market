// PPM Offering System Types

export type TrustProfile = {
  trustKind:
    | "revocable_living_trust"
    | "irrevocable_trust"
    | "testamentary_trust"
    | "special_purpose_trust"
    | null; // trustType can be null

  jurisdictionState: string | null; // e.g. "NY"
  taxClassification?: "grantor" | "complex" | "simple" | "unknown";
  isCharitable?: boolean;          // derived or explicit
  isFoundation?: boolean;          // derived or explicit
  hasEIN?: boolean;
  einLast4?: string | null;        // optional
  executedAt?: string | null;      // ISO if executed
  status: "draft" | "in_review" | "approved" | "executed";
};

export type OfferingStatus =
  | "draft"
  | "disclosure_in_progress"
  | "disclosure_final"
  | "authorized"
  | "open"
  | "closed";

export type OfferingType =
  | "private_placement"
  | "subscription_note"
  | "membership_units"
  | "donation_program";

export type Offering = {
  id: string;
  trustId: string;
  type: OfferingType;
  name: string;

  status: OfferingStatus;

  // economics
  targetAmount?: string; // store as decimal string
  pricePerUnit?: string;
  interestRateBps?: number;
  maturityDate?: string;

  // compliance flags
  requiresPPM: boolean; // rule-driven
  requiresAccreditedOnly?: boolean;

  createdAt: string;
  updatedAt: string;
};

export type OfferingDocType =
  | "ppm"
  | "subscription_agreement"
  | "investor_questionnaire"
  | "risk_acknowledgement"
  | "term_sheet"
  | "other";

export type OfferingDocument = {
  id: string;
  offeringId: string;
  trustId: string;

  docType: OfferingDocType;
  title: string;

  // versioning
  version: number;
  status: "draft" | "final";
  finalizedAt?: string;

  // storage reference
  fileUrl: string;        // your storage URL or key
  fileSha256: string;     // hash-only anchoring support
  mimeType: string;

  createdAt: string;
  updatedAt: string;
};

export type AuthorizationLink = {
  offeringId: string;
  minutesId: string;
  authorizedAt: string;
  authorizedBy: string; // user id
};

// Wizard state types
export type WizardStep =
  | "setup"
  | "disclosures"
  | "authorization"
  | "open"
  | "issuance";

export type OfferingWizardState = {
  trustId: string;
  offeringId?: string;

  activeStep: WizardStep;

  // cached computed requirements
  requiresPPM?: boolean;

  // local UI state
  errors: string[];
  lastSavedAt?: string;
};
