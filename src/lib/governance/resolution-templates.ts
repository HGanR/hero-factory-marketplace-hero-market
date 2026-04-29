export type TemplateVars = {
  ENTITY_NAME: string;
  ENTITY_TYPE: string;
  JURISDICTION: string;
  ACTION_DATE: string;
  LOCATION?: string;
  CHAIR_OR_TRUSTEE: string;
  BANK_NAME?: string;
  ACCOUNT_PURPOSE?: string;
  AUTHORIZED_SIGNERS?: string[];
  MAX_AMOUNT?: string;
  COUNTERPARTY?: string;
  CONTRACT_NAME?: string;
  EFFECTIVE_DATE: string;
  ASSET_DESCRIPTION?: string;
  APPOINTEES?: string[];
  OFFICERS_LIST?: string[];
  // Complex Trust specific
  TRUST_NAME?: string;
  BENEFICIARY_NAME?: string;
  AMOUNT?: string;
  PURPOSE?: string;
  PERIOD_END_DATE?: string;
  LLC_NAME?: string;
  PERSON_NAME?: string;
  AMOUNT_OR_ASSET?: string;
};

function replaceVars(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    if (Array.isArray(value)) {
      result = result.replace(placeholder, value.join("\n"));
    } else {
      result = result.replace(new RegExp(placeholder, "g"), value || "");
    }
  }
  return result;
}

// Trust Templates
export const TRUST_TEMPLATES = {
  TrusteeAcceptance: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION OF TRUSTEE ACCEPTANCE

The undersigned, {{CHAIR_OR_TRUSTEE}}, hereby acknowledges appointment and accepts the office of Trustee of {{ENTITY_NAME}} (the "Trust"), organized under the laws and/or recognized governance of {{JURISDICTION}}, effective as of {{EFFECTIVE_DATE}}.

The Trustee affirms that all actions taken shall be in furtherance of the Trust's purposes and in accordance with the Trust instrument and applicable fiduciary standards.

Adopted as of {{ACTION_DATE}}.`,
      vars
    ),

  BankingAuthority: (vars: TemplateVars) =>
    replaceVars(
      `BANKING AUTHORITY RESOLUTION

RESOLVED, that the Trustee(s) of {{ENTITY_NAME}} are authorized to open and maintain deposit and/or treasury accounts at {{BANK_NAME}} for {{ACCOUNT_PURPOSE}}; and

FURTHER RESOLVED, that the following persons are designated as authorized signers and agents of the Trust with authority to execute banking documents and transact on the accounts within their delegated authority:
{{AUTHORIZED_SIGNERS}}

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),

  AssetTransfer: (vars: TemplateVars) =>
    replaceVars(
      `TRUST FUNDING AND ASSET TRANSFER RESOLUTION

RESOLVED, that the Trustee acknowledges receipt and/or acceptance for administration of the following asset(s) to be held in Trust pursuant to the Trust instrument:
{{ASSET_DESCRIPTION}}

FURTHER RESOLVED, that the Trustee is authorized to execute any documents necessary to evidence title, custody, or administration of said asset(s) in the name of the Trust.

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),

  // Complex Trust Specific Templates
  DiscretionaryDistribution: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION OF TRUSTEE
DISCRETIONARY DISTRIBUTION

WHEREAS, the Trustee(s) of {{TRUST_NAME}} have authority under the Trust instrument to make discretionary distributions to or for the benefit of beneficiaries; and

WHEREAS, the Trustee(s) have considered the purpose of the Trust, the interests of all beneficiaries, and the financial condition of the Trust;

NOW, THEREFORE, BE IT RESOLVED, that the Trustee(s) approve a discretionary distribution in the amount of {{AMOUNT}} to {{BENEFICIARY_NAME}}, for the purpose of {{PURPOSE}}, effective {{EFFECTIVE_DATE}};

FURTHER RESOLVED, that the Trustee(s) determine that such distribution is consistent with fiduciary duties of care, loyalty, and impartiality.

Adopted as of {{ACTION_DATE}}.`,
      vars
    ),

  IncomeAccumulation: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION OF TRUSTEE
INCOME ACCUMULATION

WHEREAS, the Trust has generated income during the period ending {{PERIOD_END_DATE}}; and

WHEREAS, the Trustee(s) have discretion to accumulate income rather than distribute it;

NOW, THEREFORE, BE IT RESOLVED, that the Trustee(s) approve the accumulation of trust income for the stated period, determining that such accumulation is prudent and consistent with the long-term purposes of the Trust.

Adopted as of {{ACTION_DATE}}.`,
      vars
    ),

  LLCManagerAppointment: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION OF TRUSTEE
LLC MANAGER APPOINTMENT

WHEREAS, {{TRUST_NAME}} is the sole/member shareholder of {{LLC_NAME}}; and

WHEREAS, the Trustee(s) have authority to appoint managers to entities owned by the Trust;

NOW, THEREFORE, BE IT RESOLVED, that {{PERSON_NAME}} is appointed as Manager of {{LLC_NAME}}, with authority as set forth in the Operating Agreement, subject at all times to the oversight and authority of the Trustee(s).

Adopted as of {{ACTION_DATE}}.`,
      vars
    ),

  CapitalContribution: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION OF TRUSTEE
CAPITAL CONTRIBUTION

WHEREAS, the Trust owns an interest in {{LLC_NAME}}; and

WHEREAS, the Trustee(s) have determined that a capital contribution is in the best interests of the Trust;

NOW, THEREFORE, BE IT RESOLVED, that the Trustee(s) approve a capital contribution of {{AMOUNT_OR_ASSET}} to {{LLC_NAME}}, effective {{EFFECTIVE_DATE}}.

Adopted as of {{ACTION_DATE}}.`,
      vars
    ),

  AnnualFiduciaryReview: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION OF TRUSTEE
ANNUAL FIDUCIARY REVIEW

WHEREAS, the Trustee(s) have conducted an annual review of the Trust's assets, income, distributions, and governance actions;

NOW, THEREFORE, BE IT RESOLVED, that the Trustee(s) acknowledge fulfillment of fiduciary review obligations for the period ending {{PERIOD_END_DATE}}.

Adopted as of {{ACTION_DATE}}.`,
      vars
    ),
};

// LLC Templates
export const LLC_TEMPLATES = {
  OperatingAgreementAdoption: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION ADOPTING OPERATING AGREEMENT

RESOLVED, that the Operating Agreement of {{ENTITY_NAME}}, an LLC organized under the laws of {{JURISDICTION}}, is hereby adopted and approved, and shall govern the rights, duties, and authority of Members and/or Managers.

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),

  ManagerAppointment: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION APPOINTING MANAGER

RESOLVED, that the following person(s) are appointed as Manager(s) of {{ENTITY_NAME}} with authority as set forth in the Operating Agreement:
{{APPOINTEES}}

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),

  ContractApproval: (vars: TemplateVars) =>
    replaceVars(
      `RESOLUTION APPROVING CONTRACT

RESOLVED, that {{ENTITY_NAME}} is authorized to enter into the following agreement: {{CONTRACT_NAME}} with {{COUNTERPARTY}}, on terms substantially consistent with the draft presented; and

FURTHER RESOLVED, that an authorized Manager/Member is authorized to execute and deliver the agreement and take all actions necessary to perform thereunder, provided that total obligations shall not exceed {{MAX_AMOUNT}} without additional approval.

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),
};

// C-Corp Templates
export const CORP_TEMPLATES = {
  BylawsAdoption: (vars: TemplateVars) =>
    replaceVars(
      `BOARD RESOLUTION ADOPTING BYLAWS

RESOLVED, that the Bylaws presented to the Board of Directors of {{ENTITY_NAME}}, a corporation organized under the laws of {{JURISDICTION}}, are hereby adopted as the Bylaws of the Corporation.

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),

  OfficerElection: (vars: TemplateVars) =>
    replaceVars(
      `BOARD RESOLUTION ELECTING OFFICERS

RESOLVED, that the following persons are elected to the offices indicated, to serve pursuant to the Bylaws and at the pleasure of the Board:
{{OFFICERS_LIST}}

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),

  BankingResolution: (vars: TemplateVars) =>
    replaceVars(
      `BOARD BANKING RESOLUTION

RESOLVED, that the Corporation is authorized to open and maintain accounts at {{BANK_NAME}}; and

FURTHER RESOLVED, that the following officers and/or authorized agents are authorized signers:
{{AUTHORIZED_SIGNERS}}

Effective as of {{EFFECTIVE_DATE}}.`,
      vars
    ),
};

export function getTemplateForResolution(
  entityType: string,
  resolutionType: string
): ((vars: TemplateVars) => string) | null {
  if (entityType === "Trust") {
    if (resolutionType === "Organizational") return TRUST_TEMPLATES.TrusteeAcceptance;
    if (resolutionType === "Banking") return TRUST_TEMPLATES.BankingAuthority;
    if (resolutionType === "AssetAcquisition") return TRUST_TEMPLATES.AssetTransfer;
    // Complex Trust specific
    if (resolutionType === "DISCRETIONARY_DISTRIBUTION") return TRUST_TEMPLATES.DiscretionaryDistribution;
    if (resolutionType === "INCOME_ACCUMULATION") return TRUST_TEMPLATES.IncomeAccumulation;
    if (resolutionType === "LLC_MANAGER_APPOINTMENT") return TRUST_TEMPLATES.LLCManagerAppointment;
    if (resolutionType === "CAPITAL_CONTRIBUTION") return TRUST_TEMPLATES.CapitalContribution;
    if (resolutionType === "ANNUAL_FIDUCIARY_REVIEW") return TRUST_TEMPLATES.AnnualFiduciaryReview;
  } else if (entityType === "LLC") {
    if (resolutionType === "Organizational") return LLC_TEMPLATES.OperatingAgreementAdoption;
    if (resolutionType === "ManagerAppointment") return LLC_TEMPLATES.ManagerAppointment;
    if (resolutionType === "ContractApproval") return LLC_TEMPLATES.ContractApproval;
  } else if (entityType === "C-Corp") {
    if (resolutionType === "Organizational") return CORP_TEMPLATES.BylawsAdoption;
    if (resolutionType === "OfficerAppointment") return CORP_TEMPLATES.OfficerElection;
    if (resolutionType === "Banking") return CORP_TEMPLATES.BankingResolution;
  }
  return null;
}
