import type { ReferenceItem } from "./schema";

export const REFERENCE_LIBRARY: ReferenceItem[] = [
  {
    id: "grantor-irc-671-679",
    topic: "GRANTOR_TRUST",
    title: "Grantor trust rules (IRC Sections 671-679)",
    summary:
      "Issue-spot powers and interests that cause income tax attribution to the grantor; document assumptions and intended filing posture.",
    scope: "FEDERAL",
    tags: ["income-tax", "grantor", "drafting"],
    citations: [{ label: "IRC Sections 671-679" }],
    checklist: [
      "Identify grantor powers retained (revocation, substitution, administrative controls).",
      "Confirm if any adverse party approvals change attribution.",
      "Coordinate with CPA on reporting approach and trust EIN usage (if applicable).",
    ],
  },
  {
    id: "transfer-tax-709-706",
    topic: "TRANSFER_TAX",
    title: "Transfer tax touchpoints: Forms 709/706",
    summary:
      "Determine gift/estate tax reporting triggers, valuation needs, and whether portability planning is relevant.",
    scope: "FEDERAL",
    tags: ["estate-tax", "gift-tax", "reporting"],
    citations: [{ label: "Form 709" }, { label: "Form 706" }],
    checklist: [
      "Confirm whether transfers are complete gifts and whether valuation is required.",
      "Identify any retained interests (2036/2038 style issues) for issue-spotting.",
      "Check beneficiary designations and titling consistency across entities.",
    ],
  },
  {
    id: "sec-family-office-rule",
    topic: "FAMILY_OFFICE_RULE",
    title: "SEC family office exclusion (rule-based)",
    summary:
      "Analyze whether the structure and services fit the exclusion; document client eligibility and avoid holding out.",
    scope: "FEDERAL",
    tags: ["sec", "regulatory", "adviser"],
    citations: [
      { label: "Investment Advisers Act – Family Office Rule (17 CFR 275.202(a)(11)(G)-1)" },
    ],
    checklist: [
      "Define who qualifies as a family client under the rule.",
      "Confirm ownership/control requirements.",
      "Confirm services don’t drift into public adviser marketing/holding-out.",
    ],
  },
  {
    id: "fiduciary-income-tax-1041-dni",
    topic: "FIDUCIARY_INCOME_TAX",
    title: "Trust/estate income tax administration: Form 1041 + DNI mechanics",
    summary:
      "High-level DNI concepts and distribution taxation; coordinate reporting posture and distribution timing with CPA.",
    scope: "FEDERAL",
    tags: ["1041", "dni", "income-tax", "administration"],
    citations: [{ label: "Form 1041" }, { label: "DNI (Subchapter J concepts)" }],
    checklist: [
      "Confirm trust type (simple/complex) and distribution provisions.",
      "Document distribution timing assumptions and beneficiary residency factors.",
      "Coordinate K-1 issuance posture and recordkeeping responsibilities.",
    ],
  },
  {
    id: "charitable-501c3-formation",
    topic: "CHARITABLE_501C3",
    title: "501(c)(3) formation pathways; public charity vs private foundation",
    summary:
      "Structure the entity and classify properly; classification drives reporting, governance, and excise-tax exposure.",
    scope: "FEDERAL",
    tags: ["501c3", "charity", "foundation", "governance"],
    citations: [{ label: "IRC Section 501(c)(3)" }],
    checklist: [
      "Confirm mission/charitable purpose alignment and prohibited activities (private inurement).",
      "Determine likely classification: public charity vs private foundation (default).",
      "Adopt conflict-of-interest and grantmaking policies early (best practice).",
    ],
  },
  {
    id: "private-foundation-ch42-overview",
    topic: "PRIVATE_FOUNDATION_CH42",
    title: "Private foundation excise-tax regime (IRC Chapter 42) overview",
    summary:
      "Issue-spot Chapter 42 compliance areas: self-dealing, minimum distributions, excess business holdings, jeopardizing investments, taxable expenditures.",
    scope: "FEDERAL",
    tags: ["chapter-42", "excise-tax", "foundation", "compliance"],
    citations: [{ label: "IRC Chapter 42" }],
    checklist: [
      "Map related-party relationships for self-dealing risk (direct/indirect).",
      "Track qualifying distributions and minimum distribution obligations.",
      "Review investment policy for jeopardizing investments exposure.",
      "Review grants for expenditure responsibility requirements when applicable.",
    ],
  },
  {
    id: "form-990-990pf-reporting",
    topic: "FORM_990",
    title: "Federal reporting: Form 990 / 990-PF (classification-dependent)",
    summary:
      "Reporting obligations vary by entity type; ensure governance, compensation, and program activity narratives are consistent with operations.",
    scope: "FEDERAL",
    tags: ["990", "990-pf", "disclosure", "governance"],
    citations: [{ label: "Form 990" }, { label: "Form 990-PF" }],
    checklist: [
      "Confirm organization classification and filing threshold/requirements.",
      "Validate governance and compensation disclosures for consistency.",
      "Confirm public disclosure posture and document retention practices.",
    ],
  },
  {
    id: "family-office-structure-governance",
    topic: "ENTITY_GOVERNANCE",
    title: "Family office: entity selection + governance controls",
    summary:
      "Governance primitives (LLC/LP structure, investment committee charter, policies) reduce operational and fiduciary risk.",
    scope: "MULTI",
    tags: ["llc", "lp", "governance", "investment-committee", "controls"],
    citations: [{ label: "Operating Agreement / LP Agreement (governance instruments)" }],
    checklist: [
      "Define authority: managers vs members, committees, delegated signers.",
      "Adopt investment policy statement and committee charter.",
      "Implement approvals for related-party transactions and expense policy.",
      "Document recordkeeping and audit trail expectations (minutes/resolutions).",
    ],
  },
  {
    id: "privacy-cyber-controls-vendor",
    topic: "PRIVACY_CYBER",
    title: "Privacy, cybersecurity, and operational risk controls (baseline)",
    summary:
      "Implement vendor management, access controls, logging, and incident response practices appropriate to the sensitivity of financial and identity data.",
    scope: "MULTI",
    tags: ["security", "privacy", "vendor", "incident-response", "access-control"],
    citations: [{ label: "NIST Cybersecurity Framework (baseline reference)" }],
    checklist: [
      "Centralize access control (least privilege) and MFA for admin roles.",
      "Define incident response plan and retention of audit logs.",
      "Implement vendor due diligence and contract controls for sensitive data.",
      "Define data classification and encryption at rest/in transit expectations.",
    ],
  },
];
