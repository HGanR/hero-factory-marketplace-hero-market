/**
 * Server-side Tier 7 verification: signature + nonce then chain check.
 */
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";
import { recoverMessageAddress } from "viem";

const HERO_1155 = "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a" as const;
const TIER_7_TOKEN_ID = 7n;

const abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const client = createPublicClient({
  chain: polygon,
  transport: http(),
});

import { buildTier7Message } from "./tier7-message";

export { buildTier7Message };

export async function verifyTier7(walletAddress: string): Promise<boolean> {
  try {
    const addr = walletAddress as `0x${string}`;
    const balance = (await client.readContract({
      address: HERO_1155,
      abi,
      functionName: "balanceOf",
      args: [addr, TIER_7_TOKEN_ID],
    })) as bigint;
    return balance > 0n;
  } catch {
    return false;
  }
}

export type VerifySignatureParams = {
  walletAddress: string;
  signature: string;
  nonce: string;
  action: "GENERATE" | "PUBLISH";
  worldId: string;
  issuedAt: string;
};

export async function verifySignature(params: VerifySignatureParams): Promise<boolean> {
  const { walletAddress, signature, nonce, action, worldId, issuedAt } = params;
  const message = buildTier7Message({ wallet: walletAddress, nonce, action, worldId, issuedAt });
  try {
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}
