"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, DollarSign, Zap } from "lucide-react";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  date: string;
  recipient: string;
  reference: string;
};

export default function SecuritiesPaymentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "odl">("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "TXN001",
      type: "ACH",
      amount: 50000,
      status: "completed",
      date: "2025-11-28",
      recipient: "Trust Account - Primary",
      reference: "Monthly Distribution",
    },
    {
      id: "TXN002",
      type: "Wire",
      amount: 250000,
      status: "pending",
      date: "2025-11-28",
      recipient: "Investment Account",
      reference: "Capital Deployment",
    },
    {
      id: "TXN003",
      type: "Ripple ODL",
      amount: 100000,
      status: "completed",
      date: "2025-11-28",
      recipient: "XRPL Gateway",
      reference: "On-Demand Liquidity Transfer",
    },
  ]);

  const [newPayment, setNewPayment] = useState({
    paymentMethod: "ACH",
    amount: "",
    recipientName: "",
    reference: "",
  });

  const [odlForm, setOdlForm] = useState({
    sourceCurrency: "USD",
    destinationCurrency: "MXN",
    amount: "",
    sourceAddress: "",
    destinationAddress: "",
  });

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  const stats = useMemo(() => {
    const totalProcessed = transactions.reduce((s, t) => s + (t.status === "completed" ? t.amount : 0), 0);
    const achCount = transactions.filter((t) => t.type === "ACH").length;
    const wireCount = transactions.filter((t) => t.type === "Wire").length;
    const rippleODLCount = transactions.filter((t) => t.type === "Ripple ODL").length;
    const pendingAmount = transactions.reduce((s, t) => s + (t.status === "pending" ? t.amount : 0), 0);
    return { totalProcessed, achCount, wireCount, rippleODLCount, pendingAmount };
  }, [transactions]);

  const submitPayment = () => {
    const amount = Number(newPayment.amount);
    if (!newPayment.recipientName.trim() || !isFinite(amount) || amount <= 0) {
      alert("Please fill in recipient + amount.");
      return;
    }
    const id = `TXN${String(transactions.length + 1).padStart(3, "0")}`;
    const next: Transaction = {
      id,
      type: newPayment.paymentMethod,
      amount,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      recipient: newPayment.recipientName.trim(),
      reference: newPayment.reference.trim() || "—",
    };
    setTransactions((prev) => [next, ...prev]);
    setNewPayment({ paymentMethod: "ACH", amount: "", recipientName: "", reference: "" });
    setActiveTab("history");
  };

  const submitODL = () => {
    const amount = Number(odlForm.amount);
    if (!odlForm.destinationAddress.trim() || !isFinite(amount) || amount <= 0) {
      alert("Please fill in destination address + amount.");
      return;
    }
    const id = `TXN${String(transactions.length + 1).padStart(3, "0")}`;
    const next: Transaction = {
      id,
      type: "Ripple ODL",
      amount,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      recipient: odlForm.destinationAddress.trim(),
      reference: `ODL: ${odlForm.sourceCurrency} → ${odlForm.destinationCurrency}`,
    };
    setTransactions((prev) => [next, ...prev]);
    setOdlForm({ sourceCurrency: "USD", destinationCurrency: "MXN", amount: "", sourceAddress: "", destinationAddress: "" });
    setActiveTab("history");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-cyan-200">Payment Processing</h1>
            <p className="text-sm text-slate-300 mt-1">
              ACH/Wire/Ripple ODL flows (demo).
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/securities" className="text-slate-300 hover:text-white underline">
              Back to Securities
            </Link>
            <Link href="/accounting" className="text-slate-300 hover:text-white underline">
              Accounting
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="grid gap-4 md:grid-cols-5">
          <Metric title="Total Processed" value={`$${stats.totalProcessed.toLocaleString()}`} icon={<DollarSign className="h-5 w-5 text-cyan-200" />} />
          <Metric title="ACH" value={String(stats.achCount)} icon={<CheckCircle className="h-5 w-5 text-blue-200" />} />
          <Metric title="Wire" value={String(stats.wireCount)} icon={<CheckCircle className="h-5 w-5 text-green-200" />} />
          <Metric title="Ripple ODL" value={String(stats.rippleODLCount)} icon={<Zap className="h-5 w-5 text-cyan-200" />} />
          <Metric title="Pending" value={`$${stats.pendingAmount.toLocaleString()}`} icon={<Clock className="h-5 w-5 text-yellow-200" />} />
        </div>

        <div className="flex gap-2 border-b border-white/10 flex-wrap">
          <Tab active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</Tab>
          <Tab active={activeTab === "odl"} onClick={() => setActiveTab("odl")}>Ripple ODL</Tab>
          <Tab active={activeTab === "history"} onClick={() => setActiveTab("history")}>History</Tab>
        </div>

        {activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="font-semibold text-lg">New Payment</div>
              <div className="grid gap-4 mt-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Method</label>
                  <select
                    value={newPayment.paymentMethod}
                    onChange={(e) => setNewPayment((p) => ({ ...p, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                  >
                    <option>ACH</option>
                    <option>Wire</option>
                    <option>USPS EPS</option>
                    <option>Ripple ODL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Amount</label>
                  <input
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Recipient</label>
                  <input
                    value={newPayment.recipientName}
                    onChange={(e) => setNewPayment((p) => ({ ...p, recipientName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Reference</label>
                  <input
                    value={newPayment.reference}
                    onChange={(e) => setNewPayment((p) => ({ ...p, reference: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                  />
                </div>
                <button
                  onClick={submitPayment}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
                >
                  Submit Payment
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-3">
              <div className="font-semibold text-lg">Payment Methods</div>
              <div className="text-sm text-slate-300">
                ACH and Wire can be wired to your real processors later. This page currently mirrors OLDSITE structure with demo data.
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                <div className="font-semibold text-blue-200">ACH</div>
                <div className="text-sm text-slate-300">Domestic payments (1–3 business days).</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                <div className="font-semibold text-green-200">Wire</div>
                <div className="text-sm text-slate-300">Higher limits; same/next-day settlement.</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                <div className="font-semibold text-cyan-200 inline-flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Ripple ODL
                </div>
                <div className="text-sm text-slate-300">Cross-border liquidity workflow.</div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "odl" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold text-lg">Ripple ODL (demo)</div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Source Currency</label>
                <input
                  value={odlForm.sourceCurrency}
                  onChange={(e) => setOdlForm((p) => ({ ...p, sourceCurrency: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Destination Currency</label>
                <input
                  value={odlForm.destinationCurrency}
                  onChange={(e) => setOdlForm((p) => ({ ...p, destinationCurrency: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Amount</label>
                <input
                  type="number"
                  value={odlForm.amount}
                  onChange={(e) => setOdlForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Destination Address</label>
                <input
                  value={odlForm.destinationAddress}
                  onChange={(e) => setOdlForm((p) => ({ ...p, destinationAddress: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
            </div>
            <button
              onClick={submitODL}
              className="mt-4 px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Initiate ODL
            </button>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold text-lg">Transaction History</div>
            <div className="mt-4 space-y-3">
              {transactions.map((t) => (
                <div key={t.id} className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-semibold">{t.id} • {t.type}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {t.date} • {t.recipient}
                      </div>
                      <div className="text-sm text-slate-300 mt-2">{t.reference}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">${t.amount.toLocaleString()}</div>
                      <div className="text-xs text-slate-300">status: {t.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors border-b-2 ${
        active ? "text-cyan-200 border-cyan-200" : "text-slate-300 border-transparent hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-300">{title}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
