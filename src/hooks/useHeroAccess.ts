"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";

/**
 * Hero access control hook that checks for Hero ERC-1155 NFT ownership on Polygon.
 * Grants access when user owns approved Hero NFTs.
 */
export function useHeroAccess() {
  const { isConnected, address } = useAccount();
  const [chainId, setChainId] = useState<number | null>(null);
  const [isCheckingTokens, setIsCheckingTokens] = useState(false);
  const [passesTokenGate, setPassesTokenGate] = useState(false);
  const [tokenGateError, setTokenGateError] = useState<string | null>(null);

  // Hero ERC-1155 contract details
  const HERO_1155_CONTRACT = "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a" as `0x${string}`;
  const HERO_1155_TOKEN_ID = 0n;

  // ERC-1155 ABI for balanceOf function
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

  // Check Hero NFT balance on Polygon
  const {
    data: heroBalance,
    isLoading: isLoadingBalance,
    error: balanceError
  } = useReadContract({
    address: HERO_1155_CONTRACT,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address ? [address, HERO_1155_TOKEN_ID] : undefined,
    chainId: 137, // Polygon
    query: {
      enabled: Boolean(isConnected && address && chainId === 137),
      refetchInterval: 30000, // Refetch every 30 seconds
      retry: 3, // Retry failed requests up to 3 times
      retryDelay: 1000, // Wait 1 second between retries
    },
  });

  useEffect(() => {
    if (!isConnected) {
      setIsCheckingTokens(false);
      setPassesTokenGate(false);
      setTokenGateError(null);
      return;
    }

    // Start checking tokens
    setIsCheckingTokens(true);
    setTokenGateError(null);

    // If not on Polygon, can't check tokens
    if (chainId !== 137) {
      setPassesTokenGate(false);
      setIsCheckingTokens(false);
      setTokenGateError("Please switch to Polygon network to check NFT access");
      return;
    }

    // If still loading balance, wait
    if (isLoadingBalance) {
      return;
    }

    // Handle balance check errors
    if (balanceError) {
      console.error("Token gate balance check error:", balanceError);
      setPassesTokenGate(false);
      setIsCheckingTokens(false);
      setTokenGateError("Failed to check NFT balance. Please try again.");
      return;
    }

    // Check if user has Hero NFTs (balance > 0)
    const hasHeroNFT = heroBalance && heroBalance > 0n;
    setPassesTokenGate(!!hasHeroNFT);
    setIsCheckingTokens(false);
    setTokenGateError(null);
  }, [isConnected, chainId, heroBalance, isLoadingBalance, balanceError]);

  const onPolygon = useMemo(() => chainId === 137, [chainId]);

  return {
    passesTokenGate,
    isCheckingTokens,
    isWalletConnected: isConnected,
    onPolygon,
    tokenGateError,
  };
}


