/**
 * Pure Content360 schedule guards (no `server-only` / provider imports) — safe for `node:test`.
 */

export function assertCampaignClientMatchesRequest(params: {
  campaignClientId: string | null | undefined;
  requestClientId: string;
}): { ok: true } | { ok: false; error: string; status: number } {
  const campClient = String(params.campaignClientId ?? "").trim();
  if (!campClient) {
    return {
      ok: false,
      error: "Campaign must be attributed to a client before Content360 scheduling.",
      status: 400,
    };
  }
  if (campClient !== params.requestClientId.trim()) {
    return { ok: false, error: "clientId does not match this campaign's client.", status: 403 };
  }
  return { ok: true };
}
