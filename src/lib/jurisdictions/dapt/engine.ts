// lib/jurisdictions/dapt/engine.ts
import { DAPT_JURISDICTIONS } from "./data";
import type { DaptJurisdiction, JurisdictionTier } from "./schema";

export type TrustObjective = "ASSET_PROTECTION" | "STATE_TAX_MINIMIZATION" | "DIGITAL_ASSET_FIDUCIARY_ACCESS";

export type JurisdictionFilterInput = {
  selfSettled: boolean;        // true for DAPT use-cases
  hasDigitalAssets: boolean;   // true if trust will hold crypto / online accounts
  objective: TrustObjective;   // guides ranking
};

export type JurisdictionResult = DaptJurisdiction & {
  score: number;
  reasons: string[];
  eligible: boolean;
  ineligibleReason?: string;
};

function tierWeight(tier: JurisdictionTier): number {
  if (tier === "TOP_TIER") return 30;
  if (tier === "ADVISORY_ONLY") return 15;
  return 0; // RESTRICTED
}

function hasNoStateIncomeTax(j: DaptJurisdiction): boolean {
  return j.stateTaxStatus.trim().startsWith("0%") || j.tags.includes("NO_STATE_INCOME_TAX");
}

function rufadaaPresent(j: DaptJurisdiction): boolean {
  return Boolean(j.rufadaaStatute && j.rufadaaStatute.trim().length > 0);
}

export function listDaptJurisdictions(input: JurisdictionFilterInput): JurisdictionResult[] {
  const rows: JurisdictionResult[] = DAPT_JURISDICTIONS.map((j) => {
    const reasons: string[] = [];
    let score = 0;

    // Eligibility gates
    if (!input.selfSettled) {
      // If not self-settled, DAPT list may still be shown but not required.
      // Keep eligible = true, but low scoring.
      reasons.push("Not a self-settled profile; DAPT is optional.");
      score += 1;
    } else {
      // For self-settled, all entries are DAPT-capable by definition.
      reasons.push("DAPT-capable jurisdiction.");
      score += 10;
    }

    if (input.hasDigitalAssets) {
      if (!rufadaaPresent(j)) {
        return {
          ...j,
          eligible: false,
          score: 0,
          reasons: [],
          ineligibleReason: "Digital assets selected; our current dataset does not include a RUFADAA authority reference for this jurisdiction."
        };
      }
      reasons.push("RUFADAA authority present for digital asset fiduciary access.");
      score += 10;
    }

    // Tier
    score += tierWeight(j.tier);
    reasons.push(`Tier: ${j.tier.replace("_", " ")}`);

    // Objective ranking
    if (input.objective === "STATE_TAX_MINIMIZATION") {
      if (hasNoStateIncomeTax(j)) {
        score += 25;
        reasons.push("Favorable state tax profile.");
      } else {
        score += 5;
        reasons.push("State tax may apply; may be less optimal for tax minimization.");
      }
    }

    if (input.objective === "DIGITAL_ASSET_FIDUCIARY_ACCESS") {
      if (rufadaaPresent(j)) {
        score += 25;
        reasons.push("Strong fit for digital asset authority objective.");
      }
    }

    if (input.objective === "ASSET_PROTECTION") {
      if (j.tags.includes("TOP_TIER_DAPT")) {
        score += 25;
        reasons.push("Flagged as strong asset protection profile.");
      } else if (j.tier === "RESTRICTED") {
        score += 5;
        reasons.push("Restricted—requires review and may not be optimal.");
      } else {
        score += 12;
        reasons.push("Generally suitable, subject to specifics.");
      }
    }

    return { ...j, eligible: true, score, reasons };
  });

  // Order: eligible first, then highest score
  return rows.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.score - a.score;
  });
}