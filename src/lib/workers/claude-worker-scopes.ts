/** Single scope granted to Claude worker desk keys in the Site Builder fulfillment slice. */
export const CLAUDE_WORKER_HANDOFF_SCOPE = "fulfillment:handoff:submit" as const;

export const CLAUDE_WORKER_DEFAULT_SCOPES: readonly string[] = [CLAUDE_WORKER_HANDOFF_SCOPE];

export function parseClaudeWorkerScopesJson(scopesJson: string): string[] {
  try {
    const parsed = JSON.parse(scopesJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  } catch {
    return [];
  }
}

export function scopesIncludeHandoffSubmit(scopes: readonly string[]): boolean {
  return scopes.includes(CLAUDE_WORKER_HANDOFF_SCOPE);
}

export function serializeClaudeWorkerScopes(scopes: readonly string[]): string {
  return JSON.stringify([...scopes]);
}
