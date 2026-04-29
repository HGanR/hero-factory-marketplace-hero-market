const KNOWN_MODULE_TYPES = new Set([
  "constitution_dao_token_voting",
  "revocable_living_trust",
  "private_express_trust",
  "irrevocable_trust",
  "religious_foundation",
  "family_office",
  "parent_company",
  "testamentary_trust",
  "special_purpose_trust",
]);

const TRUST_TYPE_TO_MODULE: Record<string, string> = {
  revocable: "revocable_living_trust",
  irrevocable: "irrevocable_trust",
  revocable_living_trust: "revocable_living_trust",
  private_express_trust: "private_express_trust",
  irrevocable_trust: "irrevocable_trust",
  religious_foundation: "religious_foundation",
  family_office: "family_office",
  parent_company: "parent_company",
  testamentary_trust: "testamentary_trust",
  special_purpose_trust: "special_purpose_trust",
};

function normalizeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function resolveKnown(value: unknown): string | null {
  const v = normalizeValue(value);
  if (!v) return null;
  return KNOWN_MODULE_TYPES.has(v) ? v : null;
}

function resolveFromTrustType(value: unknown): string | null {
  const v = normalizeValue(value);
  if (!v) return null;
  return TRUST_TYPE_TO_MODULE[v] ?? null;
}

export type ResolveAgentModuleTypeInput = {
  explicitModuleType?: unknown;
  draftModuleType?: unknown;
  entityType?: unknown;
  trustType?: unknown;
  constitutionSubtype?: unknown;
  governanceDocs?: unknown;
  source?: "trust-records" | "smart-trust" | "ecclesiastical";
};

export function resolveAgentModuleType(input: ResolveAgentModuleTypeInput): string {
  const chain: Array<string | null> = [
    resolveKnown(input.explicitModuleType),
    resolveKnown(input.draftModuleType),
    resolveKnown(input.entityType),
    resolveFromTrustType(input.trustType),
    input.constitutionSubtype === "dao_token_voting" ? "constitution_dao_token_voting" : null,
    Array.isArray(input.governanceDocs) && input.governanceDocs.includes("constitution")
      ? "constitution_dao_token_voting"
      : null,
  ];

  for (const candidate of chain) {
    if (candidate) return candidate;
  }

  if (input.source === "ecclesiastical") return "religious_foundation";
  if (input.source === "trust-records") return "special_purpose_trust";
  return "revocable_living_trust";
}
