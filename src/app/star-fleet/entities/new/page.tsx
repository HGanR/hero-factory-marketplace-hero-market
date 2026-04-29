"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { createStarFleetEntity, loadStarFleetEntities } from "@/lib/starfleet";

export default function StarFleetNewEntityPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    jurisdiction: "Delaware",
    businessPurpose: "",
    walletAddress: "",
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

  const isNameAvailable = useMemo(() => {
    const name = form.name.trim().toLowerCase();
    if (name.length < 3) return true;
    const existing = loadStarFleetEntities();
    return !existing.some((e) => e.name.trim().toLowerCase() === name);
  }, [form.name]);

  const submit = () => {
    setError("");
    const name = form.name.trim();
    if (name.length < 3) {
      setError("Entity name must be at least 3 characters.");
      return;
    }
    if (!isNameAvailable) {
      setError("That entity name is already taken.");
      return;
    }

    const created = createStarFleetEntity({
      name,
      jurisdiction: form.jurisdiction,
      businessPurpose: form.businessPurpose.trim() || undefined,
      walletAddress: form.walletAddress.trim() || undefined,
    });

    router.push(`/star-fleet/entities/${created.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-cyan-300" />
            <div>
              <h1 className="text-2xl font-bold">Create New Entity</h1>
              <p className="text-sm text-slate-300">Form a new Series LLC (Star Fleet)</p>
            </div>
          </div>
          <Link href="/star-fleet" className="text-slate-300 hover:text-white underline">
            Back to Star Fleet
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-4 text-sm">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-3 py-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= (n as 1 | 2 | 3)
                    ? "bg-cyan-500 text-black"
                    : "bg-white/10 text-slate-200"
                }`}
              >
                {step > (n as 1 | 2 | 3) ? <CheckCircle2 className="h-5 w-5" /> : n}
              </div>
              {n < 3 ? <div className="h-1 w-10 bg-white/10" /> : null}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Entity Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Acme Series 1"
              />
              {form.name.trim().length >= 3 ? (
                <div className={`text-xs mt-2 ${isNameAvailable ? "text-green-300" : "text-red-300"}`}>
                  {isNameAvailable ? "✓ Name is available" : "✗ Name is already taken"}
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Jurisdiction</label>
              <input
                value={form.jurisdiction}
                disabled
                className="w-full px-4 py-3 rounded-lg bg-slate-950/20 border border-white/10 text-slate-300"
              />
              <div className="text-xs text-slate-400 mt-1">Defaulting to Delaware.</div>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Business Purpose (optional)</label>
              <textarea
                value={form.businessPurpose}
                onChange={(e) => setForm((p) => ({ ...p, businessPurpose: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                rows={4}
                placeholder="Describe the primary business purpose..."
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!form.name.trim() || !isNameAvailable}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Wallet Address (optional)</label>
              <input
                value={form.walletAddress}
                onChange={(e) => setForm((p) => ({ ...p, walletAddress: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="0x..."
              />
              <div className="text-xs text-slate-400 mt-1">You can connect a wallet later.</div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
            <div className="text-sm text-slate-300">
              Review your details before creating the entity.
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4 space-y-2 text-sm">
              <div><span className="text-slate-400">Name:</span> <span className="text-white font-semibold">{form.name.trim() || "—"}</span></div>
              <div><span className="text-slate-400">Jurisdiction:</span> <span className="text-white">{form.jurisdiction}</span></div>
              {form.businessPurpose.trim() ? (
                <div><span className="text-slate-400">Purpose:</span> <span className="text-white">{form.businessPurpose.trim()}</span></div>
              ) : null}
              {form.walletAddress.trim() ? (
                <div><span className="text-slate-400">Wallet:</span> <span className="text-white font-mono">{form.walletAddress.trim()}</span></div>
              ) : null}
              <div><span className="text-slate-400">Status:</span> <span className="text-yellow-200">pending</span></div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={submit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
              >
                Create Entity <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


