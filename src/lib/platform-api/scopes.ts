/**
 * Platform API Scopes
 * Format: read:resource | write:resource
 */

export const SCOPES = [
  "read:trusts",
  "write:trusts",
  "read:assets",
  "write:assets",
  "read:instruments",
  "write:instruments",
  "read:events",
  "read:workflows",
  "write:workflows",
  "read:accounting",
  "write:accounting",
  "read:worlds",
  "write:worlds",
  "read:apps",
  "write:apps",
  "read:commerce",
  "write:commerce",
] as const;

export type Scope = (typeof SCOPES)[number];

/** Legacy scope names map to new scopes for backward compatibility */
export const LEGACY_SCOPE_MAP: Record<string, Scope[]> = {
  trust_records: ["read:trusts", "read:assets", "read:instruments"],
  accounting: ["read:accounting"],
};

export function resolveScopes(scopesJson: string | null): Scope[] {
  if (!scopesJson) return [];
  try {
    const arr = JSON.parse(scopesJson) as string[];
    const resolved: Scope[] = [];
    for (const s of arr) {
      const legacy = LEGACY_SCOPE_MAP[s];
      if (legacy) resolved.push(...legacy);
      else if (SCOPES.includes(s as Scope)) resolved.push(s as Scope);
    }
    return [...new Set(resolved)];
  } catch {
    return [];
  }
}

export function hasScope(userScopes: Scope[], required: Scope): boolean {
  return userScopes.includes(required);
}
