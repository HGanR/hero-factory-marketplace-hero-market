import { getOwnedClientRow, assertValidClientId } from "@/lib/revenue-os/client-hub-queries";

/**
 * Resolves a campaign `clientId` for create/update. Empty string = unattributed (legacy / allowed).
 * Non-empty values must be a valid UUID and owned by `userId` via `client_accounts`.
 */
export async function resolveClientIdForCampaignOrReject(
  userId: number,
  raw: string | null | undefined,
): Promise<{ clientId: string; error?: never } | { error: string; status: 400 | 403 }> {
  const t = (raw ?? "").trim();
  if (!t) {
    return { clientId: "" };
  }
  try {
    assertValidClientId(t);
  } catch {
    return { error: "clientId must be a valid client UUID or omitted", status: 400 };
  }
  const row = await getOwnedClientRow(userId, t);
  if (!row) {
    return { error: "Client not found or access denied", status: 403 };
  }
  return { clientId: t };
}
