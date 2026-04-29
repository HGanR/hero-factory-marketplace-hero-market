// Bylaws Rulesets - State-Specific Legal Requirements
// Versioned, structured data for governing document compliance

export type EntityForm = "nonprofit_corp" | "religious_corp" | "llc" | "unincorporated";

export type ClauseRequirement = "required" | "recommended" | "optional" | "prohibited";

export type BylawClause = {
  id: string;
  title: string;
  description: string;
  requirement: ClauseRequirement;
  defaultContent?: string;
  minimums?: {
    directorCount?: number;
    quorumPercentage?: number;
    noticeDays?: number;
  };
  statutoryReference?: string;
  irsGuidance?: string;
};

export type BylawRuleset = {
  id: string;
  state: string; // e.g., "TX", "DE", "CA"
  stateName: string; // e.g., "Texas", "Delaware", "California"
  entityForm: EntityForm;
  schemaVersion: string; // e.g., "1.0.0"
  effectiveDate: string; // ISO date when ruleset became active
  lastReviewed: string; // ISO date of last legal review

  // Core requirements
  requiredClauses: string[]; // IDs of required clauses
  statutoryMinimums: {
    minimumDirectors: number;
    quorumFloor: number; // percentage 0-100
    noticeRequirement: number; // days
    amendmentThreshold?: number; // percentage for amendments
  };

  // Available clauses for this state/form combination
  availableClauses: BylawClause[];

  // IRS integration
  irsSuggestions: {
    purposeLanguage: string[];
    dissolutionLanguage: string[];
    prohibitedActivities: string[];
  };

  // Trust Protector integration
  protectorClauses: {
    allowed: boolean;
    suggestedLanguage?: string;
    statutoryLimits?: string[];
  };

  // Metadata
  notes: string[];
  legalDisclaimer: string;
};

// State Rulesets - Pilot Implementation
export const BYLAW_RULESETS: BylawRuleset[] = [
  // Texas Nonprofit Corporation
  {
    id: "tx-nonprofit-corp-1.0.0",
    state: "TX",
    stateName: "Texas",
    entityForm: "nonprofit_corp",
    schemaVersion: "1.0.0",
    effectiveDate: "2024-01-01",
    lastReviewed: "2024-12-01",

    requiredClauses: [
      "name-purpose",
      "board-composition",
      "officer-roles",
      "meetings-quorum",
      "amendment-procedure",
      "dissolution"
    ],

    statutoryMinimums: {
      minimumDirectors: 3, // Texas Business Organizations Code § 22.202
      quorumFloor: 50, // Majority unless bylaws specify otherwise
      noticeRequirement: 10, // Business days for regular meetings
      amendmentThreshold: 66 // 2/3 vote for amendments
    },

    availableClauses: [
      {
        id: "name-purpose",
        title: "Name and Purpose",
        description: "The corporation's legal name and charitable purposes",
        requirement: "required",
        defaultContent: "The name of this corporation is [CORPORATION NAME]. The purpose of this corporation is to [CHARITABLE PURPOSES].",
        statutoryReference: "Texas Business Organizations Code § 22.001 et seq."
      },
      {
        id: "board-composition",
        title: "Board Composition and Directors",
        description: "Number of directors, terms, qualifications",
        requirement: "required",
        minimums: { directorCount: 3 },
        defaultContent: "The corporation shall have a board of directors consisting of not less than three directors.",
        statutoryReference: "Texas Business Organizations Code § 22.202"
      },
      {
        id: "officer-roles",
        title: "Officers",
        description: "Required officer positions and duties",
        requirement: "required",
        defaultContent: "The officers of the corporation shall be a President, Secretary, and Treasurer, each elected by the board.",
        statutoryReference: "Texas Business Organizations Code § 22.203"
      },
      {
        id: "meetings-quorum",
        title: "Meetings and Quorum",
        description: "Board meeting requirements and voting quorum",
        requirement: "required",
        minimums: { quorumPercentage: 50, noticeDays: 10 },
        defaultContent: "Regular meetings shall be held quarterly. Special meetings may be called by the President. A majority of directors shall constitute a quorum.",
        statutoryReference: "Texas Business Organizations Code § 22.226"
      },
      {
        id: "committees",
        title: "Committees",
        description: "Executive and other committees",
        requirement: "recommended",
        defaultContent: "The board may appoint executive and other committees as needed.",
        statutoryReference: "Texas Business Organizations Code § 22.221"
      },
      {
        id: "amendment-procedure",
        title: "Amendment Procedure",
        description: "How bylaws can be amended",
        requirement: "required",
        minimums: { quorumPercentage: 66 },
        defaultContent: "These bylaws may be amended by a two-thirds vote of the board of directors.",
        statutoryReference: "Texas Business Organizations Code § 22.102"
      },
      {
        id: "dissolution",
        title: "Dissolution",
        description: "Procedure for dissolving the corporation",
        requirement: "required",
        defaultContent: "Upon dissolution, assets shall be distributed to charitable organizations.",
        irsGuidance: "Required for 501(c)(3) organizations"
      },
      {
        id: "indemnification",
        title: "Indemnification",
        description: "Protection for directors and officers",
        requirement: "recommended",
        defaultContent: "The corporation shall indemnify directors and officers to the fullest extent permitted by law.",
        statutoryReference: "Texas Business Organizations Code § 8.051"
      },
      {
        id: "conflicts-interest",
        title: "Conflicts of Interest",
        description: "Policy for handling conflicts of interest",
        requirement: "recommended",
        defaultContent: "Directors shall disclose potential conflicts of interest and recuse themselves from related decisions.",
        irsGuidance: "Best practice for nonprofit governance"
      }
    ],

    irsSuggestions: {
      purposeLanguage: [
        "The corporation is organized exclusively for charitable, religious, educational, and scientific purposes",
        "No part of the net earnings shall inure to the benefit of any private individual",
        "No substantial part of the activities shall be carrying on propaganda or attempting to influence legislation"
      ],
      dissolutionLanguage: [
        "Upon dissolution, assets shall be distributed for exempt purposes to organizations described in Section 501(c)(3) of the Internal Revenue Code"
      ],
      prohibitedActivities: [
        "No private inurement or private benefit",
        "No substantial lobbying activities",
        "No political campaign activities"
      ]
    },

    protectorClauses: {
      allowed: true,
      suggestedLanguage: "The board may appoint a Trust Protector with authority to [SPECIFIC POWERS], subject to the limitations of Texas law.",
      statutoryLimits: [
        "Protector may not serve as director or officer",
        "Protector powers must be consistent with charitable purposes",
        "Board retains ultimate authority"
      ]
    },

    notes: [
      "Texas requires nonprofit corporations to have bylaws adopted by the board",
      "Minimum 3 directors required by statute",
      "Bylaws must be consistent with articles of incorporation",
      "Regular board meetings required annually"
    ],
    legalDisclaimer: "This ruleset provides general guidance and does not constitute legal advice. Consult qualified counsel for your specific situation."
  },

  // Delaware Nonstock Corporation (Baseline)
  {
    id: "de-nonstock-corp-1.0.0",
    state: "DE",
    stateName: "Delaware",
    entityForm: "nonprofit_corp",
    schemaVersion: "1.0.0",
    effectiveDate: "2024-01-01",
    lastReviewed: "2024-12-01",

    requiredClauses: [
      "name-purpose",
      "board-composition",
      "officer-roles",
      "meetings-quorum",
      "amendment-procedure"
    ],

    statutoryMinimums: {
      minimumDirectors: 1, // Delaware allows 1 director
      quorumFloor: 50,
      noticeRequirement: 10,
      amendmentThreshold: 50
    },

    availableClauses: [
      {
        id: "name-purpose",
        title: "Name and Purpose",
        description: "The corporation's legal name and purposes",
        requirement: "required",
        defaultContent: "The name of this corporation is [CORPORATION NAME]. The purposes of this corporation are charitable, educational, and scientific.",
        statutoryReference: "Delaware General Corporation Law § 102(b)(3)"
      },
      {
        id: "board-composition",
        title: "Board of Directors",
        description: "Director composition, terms, and qualifications",
        requirement: "required",
        minimums: { directorCount: 1 },
        defaultContent: "The corporation shall have a board of directors consisting of at least one director.",
        statutoryReference: "Delaware General Corporation Law § 141(b)"
      },
      {
        id: "officer-roles",
        title: "Officers",
        description: "Required officer positions",
        requirement: "required",
        defaultContent: "The officers shall include a President, Secretary, and Treasurer, elected annually by the board.",
        statutoryReference: "Delaware General Corporation Law § 142"
      },
      {
        id: "meetings-quorum",
        title: "Meetings and Quorum",
        description: "Board meeting requirements",
        requirement: "required",
        minimums: { quorumPercentage: 50, noticeDays: 10 },
        defaultContent: "Meetings shall be held annually. A majority of directors constitutes a quorum.",
        statutoryReference: "Delaware General Corporation Law § 141(g)"
      },
      {
        id: "amendment-procedure",
        title: "Amendment of Bylaws",
        description: "How bylaws can be changed",
        requirement: "required",
        defaultContent: "These bylaws may be amended by majority vote of the board of directors.",
        statutoryReference: "Delaware General Corporation Law § 109"
      }
    ],

    irsSuggestions: {
      purposeLanguage: [
        "The corporation is organized and operated exclusively for exempt purposes",
        "No private shareholder or individual shall be entitled to share in the net earnings"
      ],
      dissolutionLanguage: [
        "Upon dissolution, the corporation shall distribute its assets to one or more organizations described in Section 501(c)(3)"
      ],
      prohibitedActivities: [
        "No activities not permitted to organizations exempt under 501(c)(3)",
        "No substantial legislative activities",
        "No participation in political campaigns"
      ]
    },

    protectorClauses: {
      allowed: true,
      suggestedLanguage: "The corporation may designate a Trust Protector with specified powers, provided such designation is consistent with the corporation's charitable purposes."
    },

    notes: [
      "Delaware allows flexibility in bylaws structure",
      "Minimum 1 director permitted by statute",
      "Bylaws serve as internal governance document"
    ],
    legalDisclaimer: "This ruleset provides general guidance and does not constitute legal advice. Delaware law allows significant flexibility in nonprofit bylaws."
  },

  // California Nonprofit Religious Corporation
  {
    id: "ca-religious-corp-1.0.0",
    state: "CA",
    stateName: "California",
    entityForm: "religious_corp",
    schemaVersion: "1.0.0",
    effectiveDate: "2024-01-01",
    lastReviewed: "2024-12-01",

    requiredClauses: [
      "name-purpose",
      "religious-purpose",
      "board-composition",
      "officer-roles",
      "meetings-quorum",
      "doctrinal-oversight",
      "amendment-procedure",
      "dissolution"
    ],

    statutoryMinimums: {
      minimumDirectors: 2, // California requires minimum 2 directors
      quorumFloor: 50,
      noticeRequirement: 10,
      amendmentThreshold: 50
    },

    availableClauses: [
      {
        id: "name-purpose",
        title: "Name and General Purpose",
        description: "Corporation name and general charitable purposes",
        requirement: "required",
        defaultContent: "The name of this corporation is [CORPORATION NAME]. The corporation is organized for charitable and religious purposes.",
        statutoryReference: "California Corporations Code § 9110 et seq."
      },
      {
        id: "religious-purpose",
        title: "Religious Purpose Statement",
        description: "Specific religious purposes and doctrinal commitments",
        requirement: "required",
        defaultContent: "The corporation is organized to [SPECIFIC RELIGIOUS PURPOSES], in accordance with [DENOMINATION/FAITH TRADITION] teachings and practices.",
        statutoryReference: "California Corporations Code § 9112"
      },
      {
        id: "board-composition",
        title: "Board of Directors",
        description: "Director composition and religious qualifications",
        requirement: "required",
        minimums: { directorCount: 2 },
        defaultContent: "The corporation shall have a board of at least two directors. Directors shall be members in good standing of [RELIGIOUS COMMUNITY].",
        statutoryReference: "California Corporations Code § 9210"
      },
      {
        id: "officer-roles",
        title: "Officers",
        description: "Required officers and religious leadership roles",
        requirement: "required",
        defaultContent: "Officers shall include a President, Secretary, and Treasurer. The [RELIGIOUS LEADER TITLE] may serve as President or in another capacity.",
        statutoryReference: "California Corporations Code § 9211"
      },
      {
        id: "meetings-quorum",
        title: "Meetings and Quorum",
        description: "Board meeting requirements",
        requirement: "required",
        minimums: { quorumPercentage: 50, noticeDays: 10 },
        defaultContent: "The board shall meet annually and as needed. A majority of directors constitutes a quorum.",
        statutoryReference: "California Corporations Code § 9215"
      },
      {
        id: "doctrinal-oversight",
        title: "Doctrinal Oversight",
        description: "Religious authority oversight provisions",
        requirement: "recommended",
        defaultContent: "The [RELIGIOUS AUTHORITY] shall have authority to ensure compliance with religious teachings and practices.",
        statutoryReference: "California Corporations Code § 9112(b)"
      },
      {
        id: "amendment-procedure",
        title: "Amendment Procedure",
        description: "How bylaws can be amended",
        requirement: "required",
        defaultContent: "Bylaws may be amended by majority vote of the board, subject to approval by the [RELIGIOUS AUTHORITY].",
        statutoryReference: "California Corporations Code § 9210"
      },
      {
        id: "dissolution",
        title: "Dissolution",
        description: "Dissolution procedure with religious asset protection",
        requirement: "required",
        defaultContent: "Upon dissolution, assets shall be distributed to religious organizations of the same faith tradition.",
        statutoryReference: "California Corporations Code § 9660 et seq."
      }
    ],

    irsSuggestions: {
      purposeLanguage: [
        "The corporation is organized and operated exclusively for religious purposes",
        "The corporation shall operate in accordance with the teachings and practices of [SPECIFIC FAITH TRADITION]"
      ],
      dissolutionLanguage: [
        "Upon dissolution, assets shall be distributed to organizations described in Section 501(c)(3) that are operated for religious purposes"
      ],
      prohibitedActivities: [
        "No activities that would jeopardize tax-exempt status",
        "Operations must be consistent with religious purposes"
      ]
    },

    protectorClauses: {
      allowed: true,
      suggestedLanguage: "The corporation may designate a Trust Protector to ensure compliance with religious teachings and charitable purposes.",
      statutoryLimits: [
        "Protector role must align with religious governance structure",
        "Board retains ultimate authority",
        "Religious authority may have oversight of protector"
      ]
    },

    notes: [
      "California has specific provisions for religious corporations",
      "Minimum 2 directors required",
      "Religious purpose must be clearly stated",
      "Doctrinal oversight provisions are common"
    ],
    legalDisclaimer: "California law imposes specific requirements on religious corporations. This ruleset provides general guidance and does not constitute legal advice."
  }
];

// Helper functions
export function getRulesetForState(state: string, entityForm: EntityForm): BylawRuleset | null {
  return BYLAW_RULESETS.find(r =>
    r.state === state.toUpperCase() && r.entityForm === entityForm
  ) || null;
}

export function getAvailableStates(): string[] {
  return [...new Set(BYLAW_RULESETS.map(r => r.state))].sort();
}

export function getAvailableEntityForms(state: string): EntityForm[] {
  return BYLAW_RULESETS
    .filter(r => r.state === state.toUpperCase())
    .map(r => r.entityForm);
}

export function validateBylawsAgainstRuleset(
  bylawsData: any,
  ruleset: BylawRuleset
): {
  missingRequired: string[];
  violations: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
} {
  const missingRequired: string[] = [];
  const violations: Array<{ field: string; message: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  // Check required clauses
  for (const clauseId of ruleset.requiredClauses) {
    if (!bylawsData.clauses?.[clauseId]?.content?.trim()) {
      missingRequired.push(clauseId);
    }
  }

  // Check statutory minimums
  if (bylawsData.directorCount < ruleset.statutoryMinimums.minimumDirectors) {
    violations.push({
      field: "directorCount",
      message: `Minimum ${ruleset.statutoryMinimums.minimumDirectors} directors required by ${ruleset.state} law`
    });
  }

  if (bylawsData.quorumPercentage < ruleset.statutoryMinimums.quorumFloor) {
    violations.push({
      field: "quorumPercentage",
      message: `Quorum cannot be less than ${ruleset.statutoryMinimums.quorumFloor}% (${ruleset.state} statutory minimum)`
    });
  }

  // Check notice requirements
  if (bylawsData.noticeDays < ruleset.statutoryMinimums.noticeRequirement) {
    violations.push({
      field: "noticeDays",
      message: `Notice period cannot be less than ${ruleset.statutoryMinimums.noticeRequirement} days (${ruleset.state} requirement)`
    });
  }

  // Warnings for recommended clauses not included
  const recommendedClauses = ruleset.availableClauses
    .filter(c => c.requirement === "recommended")
    .map(c => c.id);

  for (const clauseId of recommendedClauses) {
    if (!bylawsData.clauses?.[clauseId]?.content?.trim()) {
      warnings.push({
        field: `clauses.${clauseId}`,
        message: `Consider including ${ruleset.availableClauses.find(c => c.id === clauseId)?.title} (recommended for ${ruleset.state} ${ruleset.entityForm})`
      });
    }
  }

  return { missingRequired, violations, warnings };
}








