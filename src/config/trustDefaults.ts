export type TrustType =
  | "revocable_living_trust"
  | "irrevocable_trust"
  | "testamentary_trust"
  | "special_purpose_trust";

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



