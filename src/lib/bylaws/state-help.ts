// State-Specific Help Text for Bylaws Wizard
// Contextual guidance, statutory references, and compliance explanations

export interface StateHelpContent {
  state: string;
  stateName: string;
  entityForm: string;

  // Overview information
  overview: {
    summary: string;
    keyRequirements: string[];
    commonPitfalls: string[];
  };

  // Step-specific help
  steps: {
    entityGatekeeper: {
      stateNotes: string;
      entityFormGuidance: Record<string, string>;
    };

    stateSelection: {
      whyRulesMatter: string;
      stateAdvantages: string[];
      complianceNotes: string;
    };

    coreClauses: {
      namePurpose: {
        requirements: string;
        irsGuidance: string;
        stateSpecific: string;
      };
      religiousPurpose?: {
        requirements: string;
        statutoryReference: string;
        doctrinalNotes: string;
      };
    };

    boardGovernance: {
      directorMinimums: string;
      quorumRules: string;
      stateDefaults: string;
    };

    officerRoles: {
      requiredOfficers: string;
      stateRequirements: string;
      bankingNotes: string;
    };

    meetingsVoting: {
      statutoryMinimums: string;
      noticeRequirements: string;
      quorumDefaults: string;
    };

    committeesPolicies: {
      delegationLimits: string;
      indemnificationPermitted: string;
      stateSpecificPolicies: string[];
    };

    protectorIntegration: {
      allowed: boolean;
      permittedPowers: string[];
      statutoryLimits: string;
      bestPractices: string;
    };

    reviewValidation: {
      finalChecks: string[];
      stateSpecificValidation: string;
      nextStepsGuidance: string;
    };
  };

  // IRS-specific guidance
  irsGuidance: {
    purposeLanguage: {
      required: string;
      suggestions: string[];
      warnings: string;
    };
    dissolutionLanguage: {
      required: string;
      suggestions: string[];
      stateConsiderations: string;
    };
    prohibitedActivities: {
      list: string[];
      examples: string;
    };
  };

  // Banking and operational notes
  bankingNotes: {
    accountOpening: string[];
    requiredDocuments: string[];
    officerRequirements: string;
  };

  // Legal disclaimers and notes
  legalNotes: {
    generalDisclaimer: string;
    stateSpecificWarnings: string[];
    counselRecommendations: string;
  };
}

// Texas Nonprofit Corporation Help Content
const texasHelp: StateHelpContent = {
  state: "TX",
  stateName: "Texas",
  entityForm: "nonprofit_corp",

  overview: {
    summary: "Texas nonprofit corporations are governed by the Texas Business Organizations Code (BOC). Bylaws are authorized but not always required. When adopted, they must be consistent with the articles of incorporation and state law.",
    keyRequirements: [
      "Minimum 3 directors (BOC § 22.202)",
      "Annual meetings required",
      "Bylaws must be consistent with articles",
      "Board manages affairs (no members unless specified)"
    ],
    commonPitfalls: [
      "Setting quorum below statutory minimum",
      "Failing to provide notice requirements",
      "Inconsistent director terms",
      "Missing dissolution provisions"
    ]
  },

  steps: {
    entityGatekeeper: {
      stateNotes: "Texas offers flexibility in nonprofit structure. Most charitable organizations form as nonprofit corporations under BOC Chapter 22.",
      entityFormGuidance: {
        nonprofit_corp: "Standard choice for charities, churches, and educational organizations. Governed by BOC Chapter 22.",
        religious_corp: "Special provisions for religious organizations under BOC Chapter 22, with accommodations for ecclesiastical matters."
      }
    },

    stateSelection: {
      whyRulesMatter: "Texas law provides defaults for nonprofit governance, but bylaws can modify these. Understanding the statutory framework ensures your bylaws are enforceable.",
      stateAdvantages: [
        "Flexible governance structure",
        "Clear statutory defaults",
        "Established case law",
        "Bank-friendly jurisdiction"
      ],
      complianceNotes: "Texas requires nonprofit corporations to maintain bylaws that comply with BOC Chapter 22. The Secretary of State does not require filing of bylaws, but they must be available for inspection."
    },

    coreClauses: {
      namePurpose: {
        requirements: "Texas law requires the corporation's name in bylaws. Purpose must align with articles of incorporation and IRS-exempt purposes.",
        irsGuidance: "For 501(c)(3) organizations, purpose should clearly state charitable, religious, educational, or scientific purposes.",
        stateSpecific: "Bylaws must be consistent with articles of incorporation (BOC § 22.102). Purpose clause should reference Texas law compliance."
      }
    },

    boardGovernance: {
      directorMinimums: "Texas law requires a minimum of 3 directors for nonprofit corporations (BOC § 22.202). Bylaws may require more but not less.",
      quorumRules: "Texas law provides that a majority constitutes a quorum unless bylaws specify otherwise (BOC § 22.226).",
      stateDefaults: "If bylaws are silent, Texas provides: annual meetings, majority quorum, and board authority to manage affairs."
    },

    officerRoles: {
      requiredOfficers: "Texas law does not mandate specific officer positions, but bylaws typically require President, Secretary, and Treasurer for banking and contracts.",
      stateRequirements: "Officers are appointed by the board unless bylaws provide otherwise. Officers serve at board pleasure.",
      bankingNotes: "Texas banks typically require President, Secretary, and Treasurer. Additional officers may be needed for specific operations."
    },

    meetingsVoting: {
      statutoryMinimums: "Texas requires annual meetings of directors (BOC § 22.225). Special meetings may be called by board or officers.",
      noticeRequirements: "Texas law requires reasonable notice for meetings, typically 10 business days for special meetings unless bylaws specify otherwise.",
      quorumDefaults: "Majority of directors constitutes quorum unless bylaws provide otherwise (BOC § 22.226)."
    },

    committeesPolicies: {
      delegationLimits: "Texas law allows board to delegate authority to committees, but board retains ultimate responsibility (BOC § 22.221).",
      indemnificationPermitted: "Texas permits indemnification of directors and officers to the fullest extent permitted by law (BOC § 8.051).",
      stateSpecificPolicies: [
        "Record inspection rights (BOC § 22.351)",
        "Conflict of interest policy (recommended)",
        "Executive committee authority limits"
      ]
    },

    protectorIntegration: {
      allowed: true,
      permittedPowers: [
        "Approve amendments to bylaws or articles",
        "Remove or replace directors/trustees",
        "Resolve disputes over governance",
        "Monitor compliance with charitable purposes"
      ],
      statutoryLimits: "Trust Protector powers must not conflict with Texas nonprofit law requirements for board authority and fiduciary duties.",
      bestPractices: "Protector should complement, not replace, board authority. Clearly define trigger events and scope of authority."
    },

    reviewValidation: {
      finalChecks: [
        "Minimum 3 directors specified",
        "Quorum requirements met",
        "Notice periods reasonable",
        "Amendment procedure defined",
        "Dissolution provisions included"
      ],
      stateSpecificValidation: "Ensure bylaws comply with BOC Chapter 22 requirements and are consistent with articles of incorporation.",
      nextStepsGuidance: "Adopt bylaws by board resolution or written consent. File annual reports with Texas Secretary of State."
    }
  },

  irsGuidance: {
    purposeLanguage: {
      required: "For 501(c)(3) organizations, bylaws must include language consistent with exempt purposes.",
      suggestions: [
        "The corporation is organized exclusively for charitable, religious, educational, and scientific purposes",
        "No part of the net earnings shall inure to the benefit of any private individual",
        "No substantial part of activities shall be carrying on propaganda or attempting to influence legislation"
      ],
      warnings: "Purpose language should match IRS determination letter. Consult counsel for complex organizations."
    },
    dissolutionLanguage: {
      required: "Required for 501(c)(3) organizations to protect charitable assets.",
      suggestions: [
        "Upon dissolution, assets shall be distributed for exempt purposes to organizations described in Section 501(c)(3) of the Internal Revenue Code"
      ],
      stateConsiderations: "Texas law requires specific procedures for nonprofit dissolution (BOC § 22.501 et seq.)."
    },
    prohibitedActivities: {
      list: [
        "Private inurement or private benefit",
        "Substantial lobbying activities",
        "Political campaign activities",
        "Excess business holdings (if applicable)"
      ],
      examples: "Board members receiving unreasonable compensation, organization engaging in partisan political activities, or unrelated business income without proper excise taxes."
    }
  },

  bankingNotes: {
    accountOpening: [
      "Texas banks require bylaws for nonprofit account opening",
      "Officer resolutions appointing signers",
      "Articles of incorporation (filed with Secretary of State)",
      "EIN confirmation from IRS"
    ],
    requiredDocuments: [
      "Adopted bylaws with board resolution",
      "Officer appointment resolutions",
      "Articles of incorporation",
      "EIN confirmation",
      "Board meeting minutes (if applicable)"
    ],
    officerRequirements: "Banks typically require at least President, Secretary, and Treasurer. Additional officers may be required for larger organizations."
  },

  legalNotes: {
    generalDisclaimer: "This guidance is for educational purposes only and does not constitute legal advice. Texas nonprofit law is complex and varies by specific circumstances.",
    stateSpecificWarnings: [
      "Texas has specific rules for religious corporations that may differ from standard nonprofits",
      "Director indemnification has limits under Texas law",
      "Annual reports must be filed with Secretary of State"
    ],
    counselRecommendations: "Consult Texas nonprofit law counsel for complex governance structures, related organizations, or unusual circumstances."
  }
};

// Delaware Nonstock Corporation Help Content
const delawareHelp: StateHelpContent = {
  state: "DE",
  stateName: "Delaware",
  entityForm: "nonprofit_corp",

  overview: {
    summary: "Delaware nonstock corporations are governed by the Delaware General Corporation Law (DGCL). Bylaws provide internal governance rules and can modify statutory defaults. Delaware is known for corporate law predictability and flexibility.",
    keyRequirements: [
      "Bylaws may be adopted by incorporators or board",
      "Board manages affairs unless members specified",
      "Flexible governance structure permitted",
      "Annual meetings required"
    ],
    commonPitfalls: [
      "Overly restrictive bylaws limiting board authority",
      "Failing to specify meeting procedures",
      "Inadequate notice provisions",
      "Missing indemnification provisions"
    ]
  },

  steps: {
    entityGatekeeper: {
      stateNotes: "Delaware is a leading jurisdiction for nonprofit organizations due to its well-developed corporate law and Chancery Court expertise.",
      entityFormGuidance: {
        nonprofit_corp: "Delaware nonstock corporations offer maximum flexibility in governance structure while maintaining legal predictability."
      }
    },

    stateSelection: {
      whyRulesMatter: "Delaware provides extensive statutory defaults but allows bylaws to modify most provisions. Understanding DGCL requirements ensures optimal governance structure.",
      stateAdvantages: [
        "Well-established case law and judicial precedent",
        "Flexible bylaws structure",
        "Business-friendly jurisdiction",
        "International recognition"
      ],
      complianceNotes: "Delaware requires annual reports and franchise tax payments. Bylaws are internal documents not filed with the state."
    },

    coreClauses: {
      namePurpose: {
        requirements: "DGCL requires corporation name in bylaws. Purpose must align with certificate of incorporation and exempt purposes.",
        irsGuidance: "Purpose clause should clearly state tax-exempt purposes and compliance with IRC requirements.",
        stateSpecific: "Bylaws must be consistent with certificate of incorporation (DGCL § 102(b))."
      }
    },

    boardGovernance: {
      directorMinimums: "Delaware allows bylaws to specify any number of directors (no statutory minimum for nonstock corporations).",
      quorumRules: "DGCL provides majority quorum unless bylaws specify otherwise. Bylaws may set higher thresholds.",
      stateDefaults: "Delaware provides extensive defaults but bylaws can modify most provisions for optimal governance."
    },

    officerRoles: {
      requiredOfficers: "DGCL does not require specific officers. Bylaws typically specify President, Secretary, and Treasurer.",
      stateRequirements: "Officers are elected by board annually unless bylaws provide otherwise (DGCL § 142).",
      bankingNotes: "Delaware banks follow standard nonprofit banking practices. Officer titles should match bylaws."
    },

    meetingsVoting: {
      statutoryMinimums: "DGCL requires annual board meetings. Special meetings may be called as provided in bylaws.",
      noticeRequirements: "Reasonable notice required unless bylaws specify otherwise. Written notice typical for nonstock corporations.",
      quorumDefaults: "Majority constitutes quorum unless bylaws provide otherwise (DGCL § 141)."
    },

    committeesPolicies: {
      delegationLimits: "Board may delegate authority to committees, but retains ultimate responsibility (DGCL § 141(c)).",
      indemnificationPermitted: "Delaware permits broad indemnification of directors and officers (DGCL § 145).",
      stateSpecificPolicies: [
        "Advance notice provisions for meetings",
        "Action by written consent procedures",
        "Executive committee authority limits"
      ]
    },

    protectorIntegration: {
      allowed: true,
      permittedPowers: [
        "Approve fundamental changes",
        "Resolve governance disputes",
        "Monitor compliance with purposes",
        "Remove or appoint directors"
      ],
      statutoryLimits: "Protector powers must not violate Delaware fiduciary duty requirements or board authority under DGCL.",
      bestPractices: "Delaware courts respect carefully drafted protector provisions. Clearly define scope and limitations."
    },

    reviewValidation: {
      finalChecks: [
        "Board size and composition specified",
        "Meeting procedures defined",
        "Officer election process clear",
        "Amendment procedure provided",
        "Indemnification provisions included"
      ],
      stateSpecificValidation: "Ensure bylaws leverage Delaware's flexibility while maintaining proper governance structure.",
      nextStepsGuidance: "File annual reports with Delaware Secretary of State. Consider registered agent services."
    }
  },

  irsGuidance: {
    purposeLanguage: {
      required: "Bylaws must support tax-exempt purposes stated in certificate of incorporation.",
      suggestions: [
        "The corporation is organized and operated exclusively for exempt purposes",
        "No private shareholder or individual shall be entitled to share in corporate earnings"
      ],
      warnings: "Delaware allows broad purposes but IRS exemption requires specific charitable, educational, or religious purposes."
    },
    dissolutionLanguage: {
      required: "Required for asset protection in exempt organizations.",
      suggestions: [
        "Upon dissolution, the corporation shall distribute its assets to one or more organizations described in Section 501(c)(3)"
      ],
      stateConsiderations: "Delaware dissolution follows DGCL Chapter 1, Subchapter IX."
    },
    prohibitedActivities: {
      list: [
        "Activities not in furtherance of exempt purposes",
        "Private benefit transactions",
        "Excessive lobbying or political activities"
      ],
      examples: "Self-dealing transactions, unrelated business activities without proper reporting, or legislative activities exceeding permitted limits."
    }
  },

  bankingNotes: {
    accountOpening: [
      "Delaware banks require bylaws for nonprofit accounts",
      "Officer resolutions and signatures",
      "Certificate of incorporation",
      "IRS determination letter (if applicable)"
    ],
    requiredDocuments: [
      "Adopted bylaws",
      "Board resolutions",
      "Certificate of incorporation",
      "EIN confirmation",
      "Registered agent information"
    ],
    officerRequirements: "Standard nonprofit officer requirements. Delaware banks are familiar with nonstock corporation structures."
  },

  legalNotes: {
    generalDisclaimer: "This guidance is educational only. Delaware corporate law is sophisticated and requires experienced counsel.",
    stateSpecificWarnings: [
      "Delaware allows significant bylaws flexibility but poor drafting can create governance issues",
      "Director fiduciary duties are rigorously enforced",
      "Annual franchise tax requirements must be met"
    ],
    counselRecommendations: "Delaware nonprofit organizations should engage counsel familiar with DGCL and IRS exemption requirements."
  }
};

// California Nonprofit Corporation Help Content
const californiaHelp: StateHelpContent = {
  state: "CA",
  stateName: "California",
  entityForm: "nonprofit_corp",

  overview: {
    summary: "California nonprofit corporations are governed by the California Corporations Code. Religious corporations have special provisions. Bylaws must comply with statutory requirements and can modify defaults.",
    keyRequirements: [
      "Minimum 2 directors for standard nonprofits",
      "Annual meetings required",
      "Bylaws must be consistent with articles",
      "Special rules for religious corporations"
    ],
    commonPitfalls: [
      "Inadequate director indemnification",
      "Missing religious purpose provisions",
      "Improper doctrinal oversight provisions",
      "Failure to meet annual filing requirements"
    ]
  },

  steps: {
    entityGatekeeper: {
      stateNotes: "California has specific provisions for religious corporations under Corporations Code § 9110 et seq.",
      entityFormGuidance: {
        nonprofit_corp: "Standard public benefit corporations under Corporations Code § 5110 et seq.",
        religious_corp: "Special provisions for churches and religious organizations with doctrinal considerations."
      }
    },

    stateSelection: {
      whyRulesMatter: "California provides statutory defaults but requires bylaws to address specific governance matters. Religious corporations have additional requirements.",
      stateAdvantages: [
        "Clear statutory framework",
        "Special religious corporation provisions",
        "Established nonprofit sector",
        "Business-friendly environment"
      ],
      complianceNotes: "California requires annual filings and bylaws must be available for inspection. Religious corporations have specific formation and governance requirements."
    },

    coreClauses: {
      namePurpose: {
        requirements: "California requires corporation name and purposes in bylaws. Must align with articles of incorporation.",
        irsGuidance: "Purpose clause must support tax-exempt status and comply with IRC requirements.",
        stateSpecific: "Purposes must comply with California nonprofit law and public policy requirements."
      },
      religiousPurpose: {
        requirements: "Religious corporations must clearly state religious purposes and faith tradition.",
        statutoryReference: "California Corporations Code § 9112(b)",
        doctrinalNotes: "Religious purpose should reference specific faith teachings while maintaining legal compliance."
      }
    },

    boardGovernance: {
      directorMinimums: "California requires minimum 2 directors for nonprofit corporations, 3 for public benefit corporations.",
      quorumRules: "Majority quorum unless bylaws specify otherwise. Religious corporations may have special requirements.",
      stateDefaults: "California provides specific defaults for meetings, notice, and board authority."
    },

    officerRoles: {
      requiredOfficers: "California does not require specific officers but bylaws typically specify President, Secretary, Treasurer.",
      stateRequirements: "Officers elected by board unless bylaws provide otherwise. Serve at board pleasure.",
      bankingNotes: "California banks require standard officer structure. Religious corporations may need additional documentation."
    },

    meetingsVoting: {
      statutoryMinimums: "California requires annual board meetings. Special meetings permitted as provided in bylaws.",
      noticeRequirements: "Reasonable notice required, typically 10 days minimum for board meetings.",
      quorumDefaults: "Majority constitutes quorum unless bylaws specify otherwise."
    },

    committeesPolicies: {
      delegationLimits: "Board may delegate to committees but retains ultimate authority.",
      indemnificationPermitted: "California permits indemnification subject to statutory limits (Corporations Code § 7237).",
      stateSpecificPolicies: [
        "Inspection rights provisions",
        "Conflict of interest policies",
        "Doctrinal oversight for religious corps"
      ]
    },

    protectorIntegration: {
      allowed: true,
      permittedPowers: [
        "Approve significant changes",
        "Monitor religious compliance",
        "Resolve governance disputes",
        "Protect organizational purposes"
      ],
      statutoryLimits: "Protector provisions must comply with California nonprofit law and not interfere with board fiduciary duties.",
      bestPractices: "For religious corporations, protector should respect ecclesiastical governance structures."
    },

    reviewValidation: {
      finalChecks: [
        "Minimum director requirements met",
        "Religious purpose clearly stated (if applicable)",
        "Meeting requirements specified",
        "Amendment procedure defined",
        "Indemnification provisions appropriate"
      ],
      stateSpecificValidation: "Ensure compliance with California Corporations Code requirements and religious corporation provisions.",
      nextStepsGuidance: "File with California Secretary of State. Maintain bylaws at principal office for inspection."
    }
  },

  irsGuidance: {
    purposeLanguage: {
      required: "Bylaws must support tax-exempt purposes and California public policy requirements.",
      suggestions: [
        "The corporation is organized and operated exclusively for charitable and educational purposes",
        "No private individual shall be entitled to share in corporate earnings"
      ],
      warnings: "California has strong public policy requirements. Ensure purposes align with both state and federal law."
    },
    dissolutionLanguage: {
      required: "Critical for asset protection in California nonprofit law.",
      suggestions: [
        "Upon dissolution, assets shall be distributed to organizations qualified under Section 501(c)(3) of the Code"
      ],
      stateConsiderations: "California requires Attorney General approval for dissolution of public benefit corporations."
    },
    prohibitedActivities: {
      list: [
        "Private inurement",
        "Activities contrary to public policy",
        "Excessive unrelated business activities",
        "Improper political activities"
      ],
      examples: "Distributions to private individuals, activities that violate California public policy, or business activities that jeopardize exempt status."
    }
  },

  bankingNotes: {
    accountOpening: [
      "California banks require bylaws for nonprofit accounts",
      "Officer resolutions and authority documentation",
      "Articles of incorporation on file",
      "Statement of Information filed with Secretary of State"
    ],
    requiredDocuments: [
      "Adopted bylaws with board resolution",
      "Officer appointment documentation",
      "Articles of incorporation",
      "EIN confirmation",
      "Statement of Information"
    ],
    officerRequirements: "Standard nonprofit requirements. Religious corporations may need additional documentation about ecclesiastical authority."
  },

  legalNotes: {
    generalDisclaimer: "California nonprofit law is complex with special provisions for religious corporations. This guidance is educational only.",
    stateSpecificWarnings: [
      "California has strict rules for religious corporations",
      "Attorney General oversight for public benefit corporations",
      "Annual filing requirements are mandatory",
      "Indemnification has specific statutory limits"
    ],
    counselRecommendations: "California nonprofit organizations should engage counsel familiar with Corporations Code and Attorney General regulations."
  }
};

// Export help content
export const STATE_HELP_CONTENT: Record<string, StateHelpContent> = {
  "TX-nonprofit_corp": texasHelp,
  "DE-nonprofit_corp": delawareHelp,
  "CA-nonprofit_corp": californiaHelp,
  "CA-religious_corp": { ...californiaHelp, entityForm: "religious_corp" }
};

// Helper functions
export function getStateHelp(state: string, entityForm: string): StateHelpContent | null {
  const key = `${state}-${entityForm}`;
  return STATE_HELP_CONTENT[key] || null;
}

export function getAvailableHelpStates(): string[] {
  return [...new Set(Object.values(STATE_HELP_CONTENT).map(h => h.state))];
}

export function getHelpForStep(
  state: string,
  entityForm: string,
  stepId: string
): any {
  const help = getStateHelp(state, entityForm);
  if (!help) return null;

  return help.steps[stepId as keyof typeof help.steps] || null;
}








