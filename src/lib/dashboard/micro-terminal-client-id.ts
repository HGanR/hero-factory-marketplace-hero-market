/**
 * Resolves which CRM `clients.id` Micro Terminal should fetch.
 * When `hf:selected-client-id` was updated (e.g. after POST /clients/new) but
 * `smart_trust_platform_binding_v1` still holds an older `clientId`, prefer the
 * selected id so GET /api/clients/:id matches the newly created row.
 */
export function resolveMicroTerminalClientIdForFetch(
  bindingClientId: string | null | undefined,
  selectedClientIdFromStorage: string | null | undefined
): string {
  const b = bindingClientId?.trim() || "";
  const s = selectedClientIdFromStorage?.trim() || "";
  if (b && s && b !== s) return s;
  return b || s;
}
