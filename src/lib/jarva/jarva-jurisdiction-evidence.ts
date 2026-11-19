/** Read-only bridge to the existing curated DAPT jurisdiction dataset.
 * This is NOT a general legal research engine or a verification of current law.
 * Do not use a DAPT ranking to answer general trustee-duty questions.
 */
import { DAPT_JURISDICTIONS } from "@/lib/jurisdictions/dapt/data";

export type JarvaJurisdictionEvidence = {
  jurisdiction: string;
  scope: "DAPT_ONLY";
  verification: "UNVERIFIED_CURATED_DATA";
  authorities: string[];
  summary: string;
};

export function getJarvaDaptEvidence(message: string, jurisdiction?: string): JarvaJurisdictionEvidence | null {
  if (!/\b(self[ -]?settled|domestic asset protection trust|dapt|spendthrift asset protection)\b/i.test(message)) return null;
  const selected = [message, jurisdiction ?? ""].join(" ");
  const matches = DAPT_JURISDICTIONS.filter(row =>
    new RegExp("\\b" + row.stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(selected) ||
    new RegExp("\\b" + row.stateCode + "\\b", "i").test(selected)
  );
  if (matches.length !== 1) return null;
  const row = matches[0];
  return {
    jurisdiction: row.stateName,
    scope: "DAPT_ONLY",
    verification: "UNVERIFIED_CURATED_DATA",
    authorities: [row.protectionStatute, row.rufadaaStatute].filter(Boolean),
    summary: row.daptLegislation + ". " + row.residencyRequirement +
      ". Internal advisory tier: " + row.tier + ".",
  };
}
