// src/lib/filing-awareness/catalog.ts
import { InstrumentCard } from "./types";

export const PLATFORM_DISCLAIMER = `
This section provides general informational awareness of commonly used regulatory instruments.
It does not determine applicability, prepare filings, or replace legal or tax professionals.
Use this to support professional review and appropriate handoffs.
`.trim();

export const INSTRUMENT_CATALOG: Record<string, InstrumentCard> = {
  irs_2848: {
    id: "irs_2848",
    displayName: "IRS Form 2848 – Power of Attorney and Declaration of Representative",
    category: "authority",
    audience: "both",
    summary:
      "Used to authorize an eligible representative to communicate with the IRS and act on specified tax matters for the taxpayer.",
    commonTriggers: [
      "You want a CPA/attorney to speak with the IRS on behalf of the trust/entity",
      "Representation is needed for IRS notices, transcripts, or ongoing tax matters",
      "A representative is being added or changed",
    ],
    typicalTimeframe: "before_transacting",
    whoTypicallyHandles: ["CPA", "Attorney", "Authorized Representative"],
    consultantTalkingPoints: [
      "If you want a professional to speak with the IRS for you, we typically ask your CPA/attorney whether a Form 2848 is appropriate.",
      "Form 2848 is scoped—specific years and matters—so the professional usually prepares it to match your situation.",
    ],
    platformBoundaryNote:
      "The platform does not prepare, file, or submit Form 2848. This card is informational only.",
    references: [
      { label: "Scope control", note: "Authorization is limited to specified tax matters and periods." },
    ],
  },

  irs_56: {
    id: "irs_56",
    displayName: "IRS Form 56 – Notice Concerning Fiduciary Relationship",
    category: "fiduciary_notice",
    audience: "both",
    summary:
      "Used to notify the IRS that a fiduciary relationship exists or has changed (e.g., trustee/executor acting for a taxpayer).",
    commonTriggers: [
      "A trustee or executor begins acting in a fiduciary capacity",
      "A fiduciary role changes or ends",
      "A trust administration role becomes active for tax matters",
    ],
    typicalTimeframe: "immediate_after_event",
    whoTypicallyHandles: ["CPA", "Attorney", "Authorized Fiduciary"],
    consultantTalkingPoints: [
      "When fiduciary authority begins or changes, professionals often consider whether a fiduciary notice to the IRS is appropriate.",
      "Your CPA/attorney can confirm applicability and handle submission as needed.",
    ],
    platformBoundaryNote:
      "The platform does not determine whether Form 56 is required or submit it. This card is general awareness.",
  },

  irs_56f: {
    id: "irs_56f",
    displayName: "IRS Form 56-F – Notice Concerning Fiduciary Relationship (Foreign)",
    category: "fiduciary_notice",
    audience: "consultant",
    summary:
      "Used in certain contexts involving fiduciary relationships with foreign persons/entities; applicability is fact-specific and typically handled by specialized tax professionals.",
    commonTriggers: [
      "Foreign entity, nonresident, or cross-border fiduciary factor is present",
      "International tax counsel/CPA is involved",
      "Uncertain residency or foreign status must be clarified",
    ],
    typicalTimeframe: "as_needed",
    whoTypicallyHandles: ["International Tax CPA", "Tax Attorney"],
    consultantTalkingPoints: [
      "If there's any cross-border element, we typically refer this to specialized tax counsel/CPA to evaluate the appropriate notices and filings.",
      "Form 56-F is flagged as awareness only; applicability is highly fact-specific.",
    ],
    platformBoundaryNote:
      "The platform does not provide cross-border filing determinations. This card is a referral trigger for specialized professionals.",
  },

  irs_8822b: {
    id: "irs_8822b",
    displayName: "IRS Form 8822-B – Change of Address or Responsible Party (Business)",
    category: "address_responsible_party",
    audience: "both",
    summary:
      "Used to notify the IRS of address changes or responsible party changes for an entity with an EIN.",
    commonTriggers: [
      "Entity address changes",
      "Responsible party changes (common after role transitions)",
      "Mailing address updates to ensure IRS notices are received",
    ],
    typicalTimeframe: "immediate_after_event",
    whoTypicallyHandles: ["CPA", "Authorized Officer", "Attorney"],
    consultantTalkingPoints: [
      "If your address or responsible party changes, professionals often update IRS records to prevent missed notices.",
      "Your CPA can confirm whether 8822-B is appropriate and handle it if needed.",
    ],
    platformBoundaryNote:
      "The platform does not file Form 8822-B. This is general informational awareness.",
  },

  irs_1041: {
    id: "irs_1041",
    displayName: "IRS Form 1041 – U.S. Income Tax Return for Estates and Trusts",
    category: "tax_return",
    audience: "both",
    summary:
      "An income tax return used for certain trusts and estates when they have taxable income, deductions, or distributions requiring reporting.",
    commonTriggers: [
      "The trust is irrevocable and has income or reportable activity",
      "The trust holds income-producing assets",
      "Distributions to beneficiaries occur that require tax reporting coordination",
    ],
    typicalTimeframe: "annual_or_recurring",
    whoTypicallyHandles: ["CPA", "Tax Attorney"],
    consultantTalkingPoints: [
      "If the trust generates income or makes distributions, your CPA will determine whether an annual trust return is applicable and prepare it.",
      "We use this section to flag that trust tax filings may come into scope depending on activity.",
    ],
    platformBoundaryNote:
      "The platform does not determine tax filing obligations or prepare returns. Use as a handoff checklist for tax professionals.",
  },

  // Optional extensions (helpful without crossing lines)
  irs_ss4_ein: {
    id: "irs_ss4_ein",
    displayName: "IRS Form SS-4 – EIN Application Awareness",
    category: "other",
    audience: "both",
    summary:
      "Used to apply for an Employer Identification Number (EIN) for an entity or trust when appropriate.",
    commonTriggers: [
      "Opening a bank account requires an EIN",
      "Hiring personnel or opening vendor accounts requires EIN",
      "Entity formation completed and EIN is needed for operations",
    ],
    typicalTimeframe: "within_first_tax_year",
    whoTypicallyHandles: ["CPA", "Attorney", "Authorized Officer/Fiduciary"],
    consultantTalkingPoints: [
      "Many banks require an EIN to open accounts; your CPA/attorney can confirm the right EIN approach for the structure.",
    ],
    platformBoundaryNote:
      "The platform does not submit EIN applications. This is informational awareness only.",
  },

  irs_990_series: {
    id: "irs_990_series",
    displayName: "IRS Form 990 Series – Exempt Organization Return Awareness",
    category: "information_return",
    audience: "consultant",
    summary:
      "Annual information returns that may apply to certain tax-exempt organizations depending on classification and activity.",
    commonTriggers: [
      "Charitable foundation operating with recognized exempt status",
      "Donation programs and public solicitation activity",
      "Counsel/CPA indicates exempt org return obligations",
    ],
    typicalTimeframe: "annual_or_recurring",
    whoTypicallyHandles: ["CPA", "Tax Attorney"],
    consultantTalkingPoints: [
      "Exempt organizations often have annual information returns depending on structure and status; tax professionals determine the correct series.",
    ],
    platformBoundaryNote:
      "The platform does not establish exempt status and does not prepare 990 filings. This is awareness for professional handoff.",
  },

  irs_1120: {
    id: "irs_1120",
    displayName: "IRS Form 1120 – U.S. Corporation Income Tax Return Awareness",
    category: "tax_return",
    audience: "consultant",
    summary:
      "Corporate income tax return generally associated with C-Corporations; details depend on activity and tax posture.",
    commonTriggers: [
      "C-Corp operations begin",
      "Revenue, expenses, payroll, or other taxable activity occurs",
      "Bank accounts and financial records are established",
    ],
    typicalTimeframe: "annual_or_recurring",
    whoTypicallyHandles: ["CPA"],
    consultantTalkingPoints: [
      "Once a C-Corp begins operating, corporate tax filings are usually handled by a CPA based on the company's activity and books.",
    ],
    platformBoundaryNote:
      "The platform does not provide tax advice or prepare corporate returns. Use as awareness for tax coordination.",
  },

  state_charity_registration: {
    id: "state_charity_registration",
    displayName: "State Charity Registration – Solicitation Compliance Awareness",
    category: "state_registration",
    audience: "consultant",
    summary:
      "Many states regulate charitable solicitation and may require registration before fundraising or soliciting donations in that state.",
    commonTriggers: [
      "Charitable foundation intends to solicit donations",
      "Multi-state fundraising or online fundraising planned",
      "Professional fundraising vendors are used",
    ],
    typicalTimeframe: "before_transacting",
    whoTypicallyHandles: ["Attorney", "Compliance Specialist"],
    consultantTalkingPoints: [
      "Before soliciting donations, counsel typically confirms state registration requirements based on where fundraising occurs.",
    ],
    platformBoundaryNote:
      "State rules vary widely. This platform does not determine registration requirements.",
  },

  bank_resolution_packet: {
    id: "bank_resolution_packet",
    displayName: "Bank Resolution Packet – Account Opening Evidence",
    category: "banking_kyc",
    audience: "consultant",
    summary:
      "A set of governance documents commonly requested by banks to evidence authority to open accounts and designate signers.",
    commonTriggers: [
      "Opening a bank account",
      "Adding signers or changing signatory policy",
      "Establishing authority evidence for a new entity",
    ],
    typicalTimeframe: "before_transacting",
    whoTypicallyHandles: ["Consultant", "Authorized Officer/Fiduciary", "Attorney (review)"],
    consultantTalkingPoints: [
      "Banks often request governance evidence; we can assemble a draft packet for counsel review and adoption.",
    ],
    platformBoundaryNote:
      "Outputs are Draft/Review and must be adopted/executed outside the platform as appropriate.",
  },
};








