export type TrustType =
  | "revocable_living_trust"
  | "irrevocable_trust"
  | "testamentary_trust"
  | "special_purpose_trust";

/** Aligns with `trusts.trustCategory` — used by eligibility / API validation. */
export type TrustCategory = "private" | "charitable" | "statutory";

/** Aligns with `trusts.formationMode`. */
export type FormationMode = "express" | "resulting" | "constructive";

/** Aligns with `trusts.governanceMode`. */
export type GovernanceMode = "simple" | "complex";

/** Aligns with `trusts.trustSubtype`. */
export type TrustSubtype = "standard" | "grantor" | "QSST" | "ESBT";

/**
 * Taxonomy snapshot for validation helpers (mirrors `trusts` columns consumed by
 * `entityEligibility` / `trustValidation`).
 */
export interface TrustClassification {
  trustCategory: TrustCategory;
  formationMode: FormationMode;
  governanceMode: GovernanceMode;
  trustSubtype: TrustSubtype;
  commercialEnabled: boolean;
  sCorpEligible: boolean;
  irsElectionConfirmed: boolean;
}

/**
 * Minimal default clause set resolver.
 * For MVP we return a stable list of clause IDs keyed by trust_type + jurisdiction.
 * This can later be replaced by a real clause engine/table without changing the API shape.
 */
export function getDefaultClauseSet(input: { trustType: TrustType; jurisdictionState: string }): string[] {
  const st = (input.jurisdictionState || "").toUpperCase();
  const key = `${input.trustType}:${st}`;

  // Very small seed set; extend as needed.
  // IDs are intentionally opaque so you can swap bodies without breaking references.
  const base = ["definitions.core", "parties.core", "beneficiaries.core", "trustee.powers.core", "administration.core"];

  switch (key) {
    case "revocable_living_trust:TX":
      return [...base, "revocation.tx", "community_property.tx"];
    default:
      return base;
  }
}



