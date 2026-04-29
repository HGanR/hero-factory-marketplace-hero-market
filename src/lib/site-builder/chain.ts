import { createPublicClient, fallback, getAddress, http } from "viem";
import { mainnet, polygon, polygonAmoy, sepolia } from "viem/chains";

const OWNER_OF_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const RPC_CANDIDATES_BY_CHAIN: Record<number, string[]> = {
  1: [
    (process.env.NEXT_PUBLIC_ETH_RPC || "").trim(),
    "https://rpc.ankr.com/eth",
    "https://eth.llamarpc.com",
  ].filter(Boolean),
  137: [
    (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
    "https://polygon-bor-rpc.publicnode.com",
    "https://rpc.ankr.com/polygon",
    "https://polygon-rpc.com",
  ].filter(Boolean),
  80002: [
    (process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC || "").trim(),
    "https://rpc.ankr.com/polygon_amoy",
  ].filter(Boolean),
  11155111: [
    (process.env.NEXT_PUBLIC_SEPOLIA_RPC || "").trim(),
    "https://rpc.sepolia.org",
  ].filter(Boolean),
};

function resolveChain(chainId: number) {
  if (chainId === 1) return mainnet;
  if (chainId === 137) return polygon;
  if (chainId === 80002) return polygonAmoy;
  if (chainId === 11155111) return sepolia;
  return null;
}

export async function verifyNftOwnership(params: {
  chainId: number;
  contract: string;
  tokenId: string;
  expectedOwner: string;
}): Promise<{ ok: boolean; owner?: string; reason?: string }> {
  const { chainId, contract, tokenId, expectedOwner } = params;
  const chain = resolveChain(chainId);
  if (!chain) return { ok: false, reason: "Unsupported chainId" };
  const rpcCandidates = RPC_CANDIDATES_BY_CHAIN[chainId] ?? [];
  if (rpcCandidates.length === 0) return { ok: false, reason: "No RPC configured for chain" };

  try {
    const client = createPublicClient({
      chain,
      transport: fallback(rpcCandidates.map((url) => http(url))),
    });
    const owner = (await client.readContract({
      address: getAddress(contract),
      abi: OWNER_OF_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    })) as string;

    const normalizedOwner = getAddress(owner);
    const normalizedExpected = getAddress(expectedOwner);
    return {
      ok: normalizedOwner.toLowerCase() === normalizedExpected.toLowerCase(),
      owner: normalizedOwner,
      reason:
        normalizedOwner.toLowerCase() === normalizedExpected.toLowerCase()
          ? undefined
          : `ownerOf(${tokenId}) is ${normalizedOwner}, expected ${normalizedExpected}`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Failed to verify ownerOf",
    };
  }
}
