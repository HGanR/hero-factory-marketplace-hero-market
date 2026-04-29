/** Shared Tier 7 message format (client + server). */
const CHAIN_ID = 137;
const DOMAIN = "troothhertz.app";

export function buildTier7Message(params: {
  wallet: string;
  nonce: string;
  action: "GENERATE" | "PUBLISH";
  worldId: string;
  issuedAt: string;
}): string {
  return `TROOTHHERTZ Oasis Tier7 Access

Wallet: ${params.wallet}
Nonce: ${params.nonce}
Action: ${params.action}
WorldId: ${params.worldId}
ChainId: ${CHAIN_ID}
Domain: ${DOMAIN}
IssuedAt: ${params.issuedAt}`;
}
