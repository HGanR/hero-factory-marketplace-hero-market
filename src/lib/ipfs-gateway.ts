/** IPFS gateways that support CORS for browser GLB loading. Order: try first, then fallbacks. */
export const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

const ENV_GATEWAY = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_IPFS_GATEWAY?.trim();

/**
 * Convert ipfs://CID or ipfs://CID/path to a gateway URL.
 * Uses NEXT_PUBLIC_IPFS_GATEWAY if set, otherwise cloudflare-ipfs.com (reliable CORS).
 */
export function ipfsToGatewayUrl(ipfsUri: string, index = 0): string {
  if (!ipfsUri || !ipfsUri.startsWith("ipfs://")) return ipfsUri;
  const path = ipfsUri.replace("ipfs://", "");
  const base =
    ENV_GATEWAY ||
    IPFS_GATEWAYS[index ?? 0] ||
    IPFS_GATEWAYS[0];
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/** Primary gateway URL (for components that need a single URL). */
export function toGatewayUrl(ipfsUri: string): string {
  return ipfsToGatewayUrl(ipfsUri, 0);
}
