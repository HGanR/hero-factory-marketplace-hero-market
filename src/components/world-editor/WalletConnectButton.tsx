"use client";

import { useConnect, useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";

/**
 * Compact wallet connect button for the World Editor nav bar.
 */
export function WalletConnectButton() {
  const { connectAsync, connectors, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const handleConnect = async () => {
    try {
      const connector = connectors.find((c) => c.id === "metaMask" && c.ready) || connectors.find((c) => c.ready);
      if (!connector) {
        alert("No wallet found. Please install MetaMask.");
        return;
      }
      await connectAsync({ connector });
      await switchChainAsync?.({ chainId: polygon.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      alert(msg.includes("rejected") ? "Connection rejected." : msg);
    }
  };

  if (isConnected && address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            color: "rgba(224,244,255,0.8)",
            fontFamily: "monospace",
          }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            background: "rgba(239,68,68,0.2)",
            border: "1px solid rgba(239,68,68,0.5)",
            borderRadius: 6,
            color: "#fca5a5",
            cursor: "pointer",
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isPending}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        background: "rgba(16,185,129,0.3)",
        border: "1px solid #10b981",
        borderRadius: 6,
        color: "#6ee7b7",
        cursor: isPending ? "wait" : "pointer",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
