import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { Button } from "@/components/ui/button";

const PAYMENT_ABI = [
  {
    inputs: [
      { internalType: "string", name: "elementId", type: "string" },
      { internalType: "address", name: "buyer", type: "address" },
    ],
    name: "purchaseElement",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

export type PaymentElement = {
  id: string;
  name: string;
  priceEth: string;
  description?: string | null;
};

export default function Web3PaymentSystem({
  element,
  onPaid,
  disabled = false,
}: {
  element: PaymentElement;
  onPaid?: (txHash: string) => void;
  disabled?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const [status, setStatus] = useState<string>("");

  const contractAddress = (process.env.NEXT_PUBLIC_OASIS_PAYMENT_CONTRACT || "") as `0x${string}` | "";

  async function handlePurchase() {
    if (!contractAddress) {
      setStatus("Missing payment contract address.");
      return;
    }
    if (!isConnected || !address) {
      setStatus("Connect your wallet to continue.");
      return;
    }

    try {
      setStatus("Awaiting wallet confirmation...");
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PAYMENT_ABI,
        functionName: "purchaseElement",
        args: [element.id, address],
        value: parseEther(element.priceEth || "0"),
      });
      const txHash = typeof hash === "string" ? hash : "";
      setStatus(txHash ? `Payment sent. Tx: ${txHash.slice(0, 10)}...` : "Payment sent. Waiting for confirmation...");
      if (txHash && onPaid) onPaid(txHash);
    } catch (err: any) {
      setStatus(err?.shortMessage || err?.message || "Payment failed.");
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-slate-100">Web3 Payment</div>
      <div className="mt-2 text-xs text-slate-400">Chain: {chainId || "Not connected"}</div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold">{element.name}</div>
        {element.description ? <div className="text-xs text-slate-400 mt-1">{element.description}</div> : null}
        <div className="mt-2 text-sm text-cyan-200">{element.priceEth} ETH</div>
      </div>

      <Button onClick={handlePurchase} className="mt-3 w-full" disabled={isPending || disabled}>
        {isPending ? "Processing..." : "Purchase"}
      </Button>

      {status ? <div className="mt-2 text-xs text-slate-300">{status}</div> : null}
    </div>
  );
}
