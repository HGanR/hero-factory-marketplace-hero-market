"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";

/** Hero ERC-1155 token ID for Tier 7 (AI World Generator exclusive). */
export const TIER_7_TOKEN_ID = 7n;

const HERO_1155_CONTRACT = "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a" as `0x${string}`;

const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Tier 7 access: Hero token ID 7 on Polygon.
 * Required for AI World Generator (modeling page) and generate/publish APIs.
 */
export function useTier7Access() {
  const { isConnected, address } = useAccount();
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function readChain() {
      try {
        const eth = (window as any)?.ethereum;
        if (!eth?.request) return;
        const hex = await eth.request({ method: "eth_chainId" });
        const parsed = typeof hex === "string" ? parseInt(hex, 16) : null;
        if (mounted) setChainId(Number.isFinite(parsed) ? parsed : null);
      } catch {
        // ignore
      }
    }
    readChain();
    const eth = (window as any)?.ethereum;
    const handler = (hex: string) => {
      const parsed = typeof hex === "string" ? parseInt(hex, 16) : null;
      setChainId(Number.isFinite(parsed) ? parsed : null);
    };
    eth?.on?.("chainChanged", handler);
    return () => {
      mounted = false;
      eth?.removeListener?.("chainChanged", handler);
    };
  }, []);

  const {
    data: tier7Balance,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useReadContract({
    address: HERO_1155_CONTRACT,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address ? [address, TIER_7_TOKEN_ID] : undefined,
    chainId: 137,
    query: {
      enabled: Boolean(isConnected && address && chainId === 137),
      refetchInterval: 30000,
      retry: 3,
      retryDelay: 1000,
    },
  });

  const passesTier7 = !!(tier7Balance && tier7Balance > 0n);
  const onPolygon = chainId === 137;

  return {
    passesTier7,
    isLoading: isLoadingBalance,
    isWalletConnected: isConnected,
    onPolygon,
    walletAddress: address,
    error: balanceError,
  };
}
