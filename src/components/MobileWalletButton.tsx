"use client";

import { useConnect } from "wagmi";
import { injected } from "@wagmi/core";

export default function MobileWalletButton() {
  const { connectAsync, connectors, isPending } = useConnect();

  const handleConnect = async () => {
    try {
      const preferred =
        connectors.find((c) => c.id === "injected" && c.ready) ||
        connectors.find((c) => c.ready) ||
        connectors[0];

      if (!preferred) {
        alert("No wallet connector found. Please install MetaMask or another EVM wallet.");
        return;
      }

      await connectAsync({ connector: preferred });
    } catch (err: any) {
      console.error("Wallet connect failed", err);
      if (err?.name === "ConnectorAlreadyConnectedError") {
        // Ignore harmless double-connect attempts
        return;
      }
      alert(err?.message || "Failed to connect wallet. Please try again.");
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}


