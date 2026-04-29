// lib/jurisdictions/dapt/memo.ts
import { DAPT_JURISDICTIONS } from "./data";
import type { JurisdictionTier } from "./schema";

export interface JurisdictionMemoData {
  trustId: string;
  situsStateCode: string;
  objective: "ASSET_PROTECTION" | "STATE_TAX_MINIMIZATION" | "DIGITAL_ASSET_FIDUCIARY_ACCESS";
  hasDigitalAssets: boolean;
  selfSettled: boolean;
  score: number;
  reasons: string[];
  selectedAt: Date;
  selectedByUserId: number;
  trustName?: string;
}

export function generateJurisdictionMemo(data: JurisdictionMemoData): string {
  const jurisdiction = DAPT_JURISDICTIONS.find(j => j.stateCode === data.situsStateCode);
  if (!jurisdiction) {
    throw new Error(`Jurisdiction ${data.situsStateCode} not found`);
  }

  const tierLabel = jurisdiction.tier === "TOP_TIER" ? "Top Tier" :
                   jurisdiction.tier === "ADVISORY_ONLY" ? "Advisory Only" : "Restricted";

  const objectiveLabel = data.objective === "ASSET_PROTECTION" ? "Asset Protection" :
                        data.objective === "STATE_TAX_MINIMIZATION" ? "State Tax Minimization" :
                        "Digital Asset Fiduciary Access";

  const memo = `# Situs and Jurisdiction Determination

**Trust:** ${data.trustName || data.trustId}  
**Date:** ${data.selectedAt.toLocaleDateString()}  
**Selected By:** User ID ${data.selectedByUserId}

## Selected Jurisdiction

**State:** ${jurisdiction.stateName} (${jurisdiction.stateCode})  
**Tier:** ${tierLabel}  
**Primary Objective:** ${objectiveLabel}  
**Trust Characteristics:** ${data.selfSettled ? "Self-settled" : "Non-self-settled"}${data.hasDigitalAssets ? ", Digital assets included" : ""}

## Statutory Citations

**DAPT Legislation:** ${jurisdiction.daptLegislation}  
**Protection Statute:** ${jurisdiction.protectionStatute}

${jurisdiction.rufadaaStatute ? `**RUFADAA Authority:** ${jurisdiction.rufadaaStatute}` : "**RUFADAA Authority:** Not included in current dataset"}

## Nexus Requirements

**Trustee Residency:** ${jurisdiction.residencyRequirement}

## Tax Profile

**State Income Tax Status:** ${jurisdiction.stateTaxStatus}  
**Withdrawal Treatment:** ${jurisdiction.withdrawalProfile}

## Selection Rationale

**Score:** ${data.score}/100

**Key Factors Considered:**
${data.reasons.slice(0, 6).map(reason => `- ${reason}`).join('\n')}

## Additional Notes

${jurisdiction.notes || "No additional jurisdiction-specific notes."}

---

*This jurisdiction determination was made using automated analysis of statutory frameworks and should be reviewed by qualified legal counsel for applicability to specific circumstances.*`;

  return memo;
}

export function generateJurisdictionResolution(data: JurisdictionMemoData): {
  title: string;
  resolutionType: string;
  text: string;
} {
  const jurisdiction = DAPT_JURISDICTIONS.find(j => j.stateCode === data.situsStateCode);
  if (!jurisdiction) {
    throw new Error(`Jurisdiction ${data.situsStateCode} not found`);
  }

  const resolution = `WHEREAS, the Trust requires establishment of a situs jurisdiction for governance and administration;

WHEREAS, after consideration of asset protection, tax, and operational requirements, the jurisdiction of ${jurisdiction.stateName} has been selected as the situs for the Trust;

WHEREAS, ${jurisdiction.stateName} provides appropriate statutory frameworks under ${jurisdiction.daptLegislation} and ${jurisdiction.protectionStatute};

NOW, THEREFORE, BE IT RESOLVED that the situs of the Trust shall be established in ${jurisdiction.stateName}, and the Trustee is authorized to take all necessary actions to effectuate this situs selection in accordance with applicable law.`;

  return {
    title: `Establishment of Trust Situs in ${jurisdiction.stateName}`,
    resolutionType: "Organizational",
    text: resolution
  };
}