export type CompileResult = {
  normalized: Record<string, any>;
  missingFields: { field: string; reason: string }[];
  warnings: string[];
  agentNotes: string[];
};

export function compileFilingPacket(orderType: string, intake: Record<string, any>): CompileResult {
  const missingFields: CompileResult["missingFields"] = [];
  const warnings: string[] = [];
  const agentNotes: string[] = [];

  function req(path: string, label: string) {
    const val = path.split(".").reduce<any>((o, k) => (o ? o[k] : undefined), intake);
    if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
      missingFields.push({ field: path, reason: `${label} is required.` });
    }
    return val;
  }

  // Common requirements
  req("company.legalName", "Legal company name");
  req("company.ein", "EIN");
  req("company.usAddress", "U.S. address (as used on filings)");
  req("taxYear", "Tax year");

  if (orderType === "FOREIGN_OWNED_SMLLC_5472") {
    req("owner.isForeign", "Owner foreign status");
    req("owner.fullNameOrEntityName", "Owner name");
    req("owner.country", "Owner country");
    req("transactions.hasReportableTransactions", "Reportable transactions flag");
    // If reportable transactions, require details
    if (intake?.transactions?.hasReportableTransactions === true) {
      req("transactions.details", "Reportable transactions details");
    } else {
      warnings.push("Marked 'no reportable transactions'. Ensure records support this statement.");
    }
  }

  if (orderType === "PARTNERSHIP_1065") {
    req("partners", "Partners list");
    if (!Array.isArray(intake.partners) || intake.partners.length < 2) {
      missingFields.push({ field: "partners", reason: "Partnership filings require at least 2 partners." });
    }
    req("activity.description", "Business activity description");
  }

  // Normalized output for templates
  const normalized = {
    ...intake,
    compiledAt: new Date().toISOString(),
    orderType,
  };

  if (missingFields.length === 0) {
    agentNotes.push("Packet appears complete for first-pass preparation. Agent should verify addresses and EIN formatting.");
  }

  return { normalized, missingFields, warnings, agentNotes };
}


