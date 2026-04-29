"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEther } from "viem";
import MobileWalletButton from "@/components/MobileWalletButton";
import { createStarFleetEntity } from "@/lib/starfleet";
import {
  Rocket,
  Building2,
  FileText,
  Coins,
  ShieldCheck,
  ArrowLeft,
  CreditCard,
  CircleDollarSign,
} from "lucide-react";

function ServiceCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold break-words">{title}</div>
          <div className="text-sm text-slate-300 mt-2">{description}</div>
        </div>
        <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </Link>
  );
}

type Network = "POL" | "ETH" | "XRP" | "SOL";
type JurisdictionCategory = "States" | "International";
type JurisdictionOption = {
  id: "DE" | "WY" | "UNA_DUNA" | "SWISS_ASSOC";
  label: string;
  priceUsd: number;
  category: JurisdictionCategory;
};

const JURISDICTIONS: JurisdictionOption[] = [
  { id: "UNA_DUNA", label: "UNA/DUNA", priceUsd: 499, category: "International" },
  { id: "SWISS_ASSOC", label: "Swiss Association", priceUsd: 299, category: "International" },
  { id: "DE", label: "Delaware", priceUsd: 99, category: "States" },
  { id: "WY", label: "Wyoming", priceUsd: 99, category: "States" },
];

const NETWORKS: Array<{ id: Network; label: string; chainHint: string }> = [
  { id: "POL", label: "POL (Polygon)", chainHint: "Pay in MATIC" },
  { id: "ETH", label: "ETH (Ethereum)", chainHint: "Pay in ETH" },
  { id: "XRP", label: "XRP (XRPL)", chainHint: "Pay in XRP" },
  { id: "SOL", label: "SOL (Solana)", chainHint: "Pay in SOL" },
];

const EVM_TREASURY = "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF" as `0x${string}`;
const SOL_TREASURY = "FP7idjzyVLRWeQ86M6ncLC7WmZaiccSBeVTUdufDppJY";
const XRP_TREASURY = "rGPqFJKVwkRfUzSVHHxPnFKRyF7yJJJvnQ"; // placeholder (update to your XRPL receiving address)

declare global {
  interface Window {
    solana?: any;
  }
}

export default function LiftOffPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, isPending: connectPending } = useConnect();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();

  // App-session gate (match other pages)
  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  // Launch shell state
  const [entityName, setEntityName] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState<JurisdictionOption["id"]>("DE");
  const [network, setNetwork] = useState<Network>("POL");
  const [nativeAmount, setNativeAmount] = useState<string>(""); // user-entered for now (no oracle)
  const [rates, setRates] = useState<{ ETH: number; MATIC: number; SOL: number; XRP: number } | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [ratesTs, setRatesTs] = useState<number | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentTx, setPaymentTx] = useState<string | null>(null);
  const [xumm, setXumm] = useState<{
    uuid: string;
    nextUrl?: string;
    qrPng?: string;
    status: "created" | "signed" | "cancelled" | "expired";
    txid?: string;
  } | null>(null);

  const selectedJurisdiction = useMemo(
    () => JURISDICTIONS.find((j) => j.id === jurisdictionId) || JURISDICTIONS[0],
    [jurisdictionId]
  );

  const isEvmNetwork = network === "ETH" || network === "POL";
  const desiredChainId = network === "ETH" ? 1 : network === "POL" ? 137 : null;
  const nativeSymbol = network === "ETH" ? "ETH" : network === "POL" ? "MATIC" : network === "SOL" ? "SOL" : "XRP";
  const usdPrice = selectedJurisdiction?.priceUsd ?? 0;

  // Price feed (USD rates) for automatic USD→native conversion.
  useEffect(() => {
    let mounted = true;
    async function loadRates() {
      setRatesError(null);
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load prices");
        if (!mounted) return;
        setRates(data?.usd || null);
        setRatesTs(typeof data?.ts === "number" ? data.ts : null);
      } catch (e) {
        if (!mounted) return;
        setRates(null);
        setRatesTs(null);
        setRatesError(e instanceof Error ? e.message : "Failed to load prices");
      }
    }
    loadRates();
    const t = window.setInterval(loadRates, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, []);

  // Auto-calculate native amount from USD using price feed (adds 2% buffer).
  useEffect(() => {
    if (!rates || !usdPrice) return;
    const tokenUsd =
      nativeSymbol === "ETH"
        ? rates.ETH
        : nativeSymbol === "MATIC"
          ? rates.MATIC
          : nativeSymbol === "SOL"
            ? rates.SOL
            : rates.XRP;
    if (!Number.isFinite(tokenUsd) || tokenUsd <= 0) return;
    const raw = usdPrice / tokenUsd;
    const buffered = raw * 1.02;
    const decimals = nativeSymbol === "XRP" ? 2 : 6;
    setNativeAmount(buffered.toFixed(decimals));
  }, [rates, usdPrice, nativeSymbol]);

  const smartContractNeeded = useMemo(() => {
    switch (network) {
      case "POL":
      case "ETH":
        return {
          title: "EVM EntityFactory (Solidity)",
          body:
            "Deploy an EntityFactory + EntityProxy pattern.\n" +
            "Inputs: entity name, jurisdiction, admin wallet.\n" +
            "Outputs: entity contract address + registry record.\n" +
            "Status: shell-only (deployment wiring coming next).",
        };
      case "SOL":
        return {
          title: "Solana Program (Anchor)",
          body:
            "Deploy an Anchor program with an Entity account.\n" +
            "Inputs: entity name, jurisdiction, authority pubkey.\n" +
            "Outputs: PDA addresses for entity + registry.\n" +
            "Status: shell-only (wallet + program deploy wiring coming next).",
        };
      case "XRP":
        return {
          title: "XRPL (Issued Currency / hooks placeholder)",
          body:
            "XRPL does not deploy smart contracts like EVM.\n" +
            "Typically: configure issuer + trust lines + optional hooks/sidechain.\n" +
            "Status: shell-only (payment + issuance wiring coming next).",
        };
      default:
        return { title: "—", body: "" };
    }
  }, [network]);

  async function ensureEvmWalletConnected() {
    if (isConnected && address?.startsWith("0x")) return;
    await connect({ connector: injected() });
  }

  async function finalizeAfterPayment(opts: {
    paymentNetwork: Network;
    paymentRef: string; // tx hash / signature / xumm uuid / xrpl txid
    walletAddress?: string;
  }) {
    const name = entityName.trim();
    const jurisdiction = selectedJurisdiction?.label || "Unknown";
    const purpose =
      `Lift Off Launch\n` +
      `Network: ${network}\n` +
      `Jurisdiction: ${jurisdiction}\n` +
      `Price USD: $${usdPrice}\n` +
      `Paid in: ${nativeSymbol}\n` +
      `Amount: ${nativeAmount}\n` +
      `Payment Ref: ${opts.paymentRef}\n`;

    const created = createStarFleetEntity({
      name,
      jurisdiction,
      businessPurpose: purpose,
      walletAddress: opts.walletAddress || (isEvmNetwork && address ? address : undefined),
      status: "pending",
    });

    router.push(`/star-fleet/entities/${created.id}`);
  }

  async function pay() {
    setPaymentError(null);
    setPaymentTx(null);

    // Shell: require selection
    if (!entityName.trim()) {
      setPaymentError("Please enter an Entity Name.");
      return;
    }

    if (!selectedJurisdiction) {
      setPaymentError("Please select a jurisdiction.");
      return;
    }

    if (!nativeAmount.trim()) {
      setPaymentError(
        `Enter the amount to pay in ${nativeSymbol}.`
      );
      return;
    }

    setPaymentBusy(true);
    try {
      if (network === "ETH" || network === "POL") {
        await ensureEvmWalletConnected();

        if (!desiredChainId) throw new Error("Missing chain id for selected network.");
        try {
          await switchChainAsync?.({ chainId: desiredChainId });
        } catch (e: any) {
          throw new Error("Please switch your wallet to the selected network to complete payment.");
        }

        const mm = (typeof window !== "undefined" && (window as any).ethereum) || null;
        if (!mm) throw new Error("No EVM wallet detected (MetaMask).");

        const value = parseEther(nativeAmount as `${number}` | string);
        const txHash = (await mm.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: EVM_TREASURY,
              value: `0x${value.toString(16)}`,
            },
          ],
        })) as string;

        setPaymentTx(txHash);
        await finalizeAfterPayment({ paymentNetwork: network, paymentRef: txHash, walletAddress: address || undefined });
        return;
      }

      if (network === "SOL") {
        const sol = window.solana;
        if (!sol?.isPhantom) {
          throw new Error("Phantom wallet not detected. Please install/enable Phantom.");
        }

        await sol.connect();
        const payerPk = sol.publicKey;
        if (!payerPk) throw new Error("Phantom did not provide a public key.");

        const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } =
          await import("@solana/web3.js");
        const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

        const toPk = new PublicKey(SOL_TREASURY);
        const lamports = Math.max(
          1,
          Math.round(parseFloat(nativeAmount) * Number(LAMPORTS_PER_SOL))
        );

        const { blockhash } = await conn.getLatestBlockhash("finalized");
        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: payerPk,
        }).add(
          SystemProgram.transfer({
            fromPubkey: payerPk,
            toPubkey: toPk,
            lamports,
          })
        );

        const signed = await sol.signAndSendTransaction(tx);
        const sig = signed?.signature || signed;
        if (!sig) throw new Error("Failed to submit Solana transaction.");
        setPaymentTx(String(sig));
        await finalizeAfterPayment({
          paymentNetwork: "SOL",
          paymentRef: String(sig),
          walletAddress: String(payerPk?.toBase58?.() || payerPk),
        });
        return;
      }

      if (network === "XRP") {
        // Create XUMM payload and open signing link; poll until resolved.
        setXumm(null);
        const memo = `Lift Off: ${entityName.trim()} • ${selectedJurisdiction?.label} • $${usdPrice} • ${nativeAmount} XRP`;

        const createResp = await fetch("/api/payments/xumm/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: XRP_TREASURY,
            amountXrp: nativeAmount,
            memo,
            returnUrl: typeof window !== "undefined" ? `${window.location.origin}/lift-off` : undefined,
          }),
        });

        const createData = await createResp.json().catch(() => ({}));
        if (!createResp.ok) throw new Error(createData?.error || "Failed to create XUMM payload");

        const uuid = String(createData?.uuid || createData?.refs?.uuid || "");
        const nextUrl = String(createData?.next?.always || createData?.next?.no_push || "");
        const qrPng = String(createData?.refs?.qr_png || "");
        if (!uuid) throw new Error("XUMM payload did not return a uuid");

        setXumm({
          uuid,
          nextUrl: nextUrl || undefined,
          qrPng: qrPng || undefined,
          status: "created",
        });

        if (nextUrl) {
          window.open(nextUrl, "_blank", "noopener,noreferrer");
        }

        // Poll status
        const start = Date.now();
        const timeoutMs = 2 * 60 * 1000;
        while (Date.now() - start < timeoutMs) {
          await new Promise((r) => setTimeout(r, 2500));
          const st = await fetch(`/api/payments/xumm/status?uuid=${encodeURIComponent(uuid)}`, { cache: "no-store" });
          const sd = await st.json().catch(() => ({}));
          if (!st.ok) continue;
          if (sd?.cancelled) {
            setXumm((p) => (p ? { ...p, status: "cancelled" } : p));
            throw new Error("XUMM signing was cancelled.");
          }
          if (sd?.resolved && sd?.signed) {
            const txid = sd?.txid ? String(sd.txid) : "";
            setXumm((p) => (p ? { ...p, status: "signed", txid: txid || undefined } : p));
            setPaymentTx(txid || uuid);
            await finalizeAfterPayment({
              paymentNetwork: "XRP",
              paymentRef: txid || uuid,
              walletAddress: undefined,
            });
            return;
          }
        }

        setXumm((p) => (p ? { ...p, status: "expired" } : p));
        throw new Error("XUMM signing timed out. Please try again.");
      }
    } catch (e: any) {
      setPaymentError(e instanceof Error ? e.message : String(e));
    } finally {
      setPaymentBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight break-words">Lift Off</h1>
              <p className="text-sm text-slate-300 break-words">Star Fleet services hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/star-fleet" className="text-slate-300 hover:text-white underline">
              Back to Star Fleet
            </Link>
            <Link href="/dashboard" className="text-slate-300 hover:text-white underline">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Launch shell */}
        <div className="rounded-2xl border border-cyan-400/40 bg-slate-950 p-6 hover:border-cyan-300 transition-[border-color,box-shadow] hover:shadow-[0_0_28px_rgba(0,209,255,0.25)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-cyan-300" />
                Launch an Entity (Shell)
              </div>
              <div className="text-sm text-slate-300 mt-2">
                Choose a jurisdiction + target network, then complete payment in the <b>native currency</b> of that network.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Inputs */}
            <div className="lg:col-span-2 space-y-5">
              <div>
                <div className="text-sm font-medium">Entity Name</div>
                <input
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Enter entity name"
                  className="mt-2 w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <div className="text-sm font-medium">Jurisdiction</div>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["States", "International"] as const).map((cat) => (
                    <div key={cat} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-400">{cat}</div>
                      <div className="mt-3 space-y-2">
                        {JURISDICTIONS.filter((j) => j.category === cat).map((j) => (
                          <label
                            key={j.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 hover:bg-slate-950/60 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="radio"
                                name="jurisdiction"
                                checked={jurisdictionId === j.id}
                                onChange={() => setJurisdictionId(j.id)}
                                className="h-4 w-4 accent-cyan-400"
                              />
                              <span className="truncate">{j.label}</span>
                            </div>
                            <span className="shrink-0 rounded-full border border-cyan-400/40 px-3 py-1 text-sm text-slate-200">
                              ${j.priceUsd}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Network (deployment target)</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {NETWORKS.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setNetwork(n.id)}
                      className={`px-3 py-2 rounded-xl border text-sm transition-colors ${
                        network === n.id
                          ? "border-cyan-300 bg-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-semibold">{n.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{n.chainHint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Payment Amount (native)</div>
                <div className="text-xs text-slate-400 mt-1">
                  Shell step: you enter the amount to send in{" "}
                  <b>{nativeSymbol}</b>. Amount auto-fills from USD using a live price feed (includes 2% buffer).
                </div>
                <input
                  value={nativeAmount}
                  onChange={(e) => setNativeAmount(e.target.value)}
                  placeholder={nativeSymbol === "ETH" ? "0.01" : nativeSymbol === "MATIC" ? "1.0" : nativeSymbol === "SOL" ? "0.1" : "10"}
                  className="mt-2 w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  inputMode="decimal"
                />
                <div className="mt-2 text-xs text-slate-400">
                  {rates ? (
                    <>
                      USD price: <span className="text-slate-200 font-semibold">${usdPrice}</span> • Rate: 1 {nativeSymbol} ≈ $
                      {(
                        nativeSymbol === "ETH"
                          ? rates.ETH
                          : nativeSymbol === "MATIC"
                            ? rates.MATIC
                            : nativeSymbol === "SOL"
                              ? rates.SOL
                              : rates.XRP
                      ).toFixed(4)}{" "}
                      • Updated {ratesTs ? new Date(ratesTs).toLocaleTimeString() : "—"}
                    </>
                  ) : ratesError ? (
                    <>Price feed unavailable: {ratesError}. You can still enter an amount manually.</>
                  ) : (
                    <>Loading price feed…</>
                  )}
                </div>
              </div>
            </div>

            {/* Summary / Pay */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Summary</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Entity</span>
                    <span className="font-semibold truncate max-w-[60%]">{entityName || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Jurisdiction</span>
                    <span className="font-semibold">{selectedJurisdiction?.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Price (USD)</span>
                    <span className="font-semibold">${selectedJurisdiction?.priceUsd}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Network</span>
                    <span className="font-semibold">{network}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Pay in</span>
                    <span className="font-semibold">
                      {nativeSymbol}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400">Wallet</div>
                  {isEvmNetwork ? (
                    <div className="mt-2 text-sm text-slate-200">
                      {isConnected && address ? (
                        <div className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <MobileWalletButton />
                          <span className="text-xs text-slate-400">{connectPending ? "Opening wallet…" : "Connect MetaMask"}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-300">
                      {network === "SOL" ? "Phantom (coming next)" : "XRPL wallet (coming next)"}
                    </div>
                  )}
                </div>

                {paymentError ? (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {paymentError}
                  </div>
                ) : null}

                {paymentTx ? (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    Payment submitted. Tx: <span className="font-mono break-all">{paymentTx}</span>
                  </div>
                ) : null}

                {xumm && network === "XRP" ? (
                  <div className="mt-4 rounded-xl border border-cyan-400/20 bg-slate-950/40 p-3">
                    <div className="text-xs uppercase tracking-wider text-slate-400">XUMM</div>
                    <div className="mt-2 text-sm text-slate-200">
                      Status:{" "}
                      <span className="font-semibold">
                        {xumm.status === "created"
                          ? "Awaiting signature"
                          : xumm.status === "signed"
                            ? "Signed"
                            : xumm.status === "cancelled"
                              ? "Cancelled"
                              : "Timed out"}
                      </span>
                    </div>
                    {xumm.qrPng ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={xumm.qrPng}
                        alt="XUMM QR"
                        className="mt-3 w-40 h-40 rounded-lg border border-white/10 bg-white/5"
                      />
                    ) : null}
                    {xumm.nextUrl ? (
                      <a
                        href={xumm.nextUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-sm text-cyan-300 underline hover:text-cyan-200"
                      >
                        Open signing request
                      </a>
                    ) : null}
                    <div className="mt-2 text-[11px] text-slate-400 break-all">uuid: {xumm.uuid}</div>
                    {xumm.txid ? (
                      <div className="mt-1 text-[11px] text-slate-400 break-all">txid: {xumm.txid}</div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={pay}
                  disabled={paymentBusy || switchPending}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-3 disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {paymentBusy ? "Processing…" : "Pay & Continue"}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Smart Contract Needed</div>
                <div className="mt-2 text-sm font-semibold">{smartContractNeeded.title}</div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-300 rounded-xl border border-white/10 bg-slate-950/40 p-3">
{smartContractNeeded.body}
                </pre>
                <div className="mt-2 text-xs text-slate-400">
                  Treasury address:
                  <span className="ml-1 font-mono break-all">
                    {isEvmNetwork ? EVM_TREASURY : network === "SOL" ? SOL_TREASURY : XRP_TREASURY}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Services</div>
          <div className="text-sm text-slate-300 mt-2">
            This is the Lift Off services area for Star Fleet.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ServiceCard
            title="Entities"
            description="Create and manage entities (Star Fleet)."
            href="/star-fleet/entities"
            icon={<Building2 className="h-5 w-5 text-cyan-300" />}
          />
          <ServiceCard
            title="Create New Entity"
            description="Launch a new entity creation flow."
            href="/star-fleet/entities/new"
            icon={<Rocket className="h-5 w-5 text-cyan-300" />}
          />
          <ServiceCard
            title="Files & Templates"
            description="Store and review entity documents (see entity detail)."
            href="/star-fleet/entities"
            icon={<FileText className="h-5 w-5 text-cyan-300" />}
          />
          <ServiceCard
            title="Plugins"
            description="Enable add-on capabilities for an entity."
            href="/star-fleet/plugins"
            icon={<ShieldCheck className="h-5 w-5 text-cyan-300" />}
          />
          <ServiceCard
            title="Token Minting"
            description="Mint a token for an entity (demo flow)."
            href="/star-fleet/plugins/token-minting"
            icon={<Coins className="h-5 w-5 text-cyan-300" />}
          />
        </div>
      </div>
    </div>
  );
}
