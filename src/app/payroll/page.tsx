"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Workspace = { id: string; name?: string; clientId?: string; trustId?: string; workspaceId?: string; status?: string };
type Worker = { id: string; name: string; type: string; email?: string; residentState?: string; workState?: string; status?: string };
type CalcResult = {
  gross: number;
  grossCents: number;
  net: number;
  netCents: number;
  taxes: { jurisdiction: string; name: string; amount: number; amountCents: number }[];
};
type PayStub = { workerName: string; payDate: string; periodStart: string; periodEnd: string; result: CalcResult; engineKind: string };

function formatMoney(n: number) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
}

export default function PayrollPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<{ clientId?: string; trustId?: string; workspaceId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [grossPay, setGrossPay] = useState<string>("");
  const [payDate, setPayDate] = useState<string>("");
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [payStub, setPayStub] = useState<PayStub | null>(null);

  useEffect(() => {
    setPayDate(new Date().toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  const fetchWorkspaces = useCallback(async () => {
    const res = await fetch("/api/payroll/workspaces", { credentials: "include" });
    if (res.status === 401) {
      setAuthStatus("unauthenticated");
      setWorkspaces([]);
      return;
    }
    if (!res.ok) return;
    const j = await res.json();
    const raw = j.workspaces ?? [];
    const safe = Array.isArray(raw)
      ? raw.filter((w: unknown) => w && typeof (w as any).id === "string")
      : [];
    setWorkspaces(safe);
    setAuthStatus("authenticated");
  }, []);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeWorkspace?.clientId) params.set("clientId", activeWorkspace.clientId);
      if (activeWorkspace?.trustId) params.set("trustId", activeWorkspace.trustId);
      if (activeWorkspace?.workspaceId) params.set("workspaceId", activeWorkspace.workspaceId);
      const res = await fetch(`/api/payroll/workers?${params}`, { credentials: "include" });
      if (res.status === 401) {
        setWorkers([]);
        return;
      }
      if (!res.ok) return;
      const j = await res.json();
      const raw = j.workers ?? [];
      const safe = Array.isArray(raw)
        ? raw.filter((w: unknown) => w && typeof (w as any).id === "string")
        : [];
      setWorkers(safe);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    setLoading(true);
    fetchWorkspaces().finally(() => setLoading(false));
  }, [fetchWorkspaces]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers, activeWorkspace]);

  const runCalculate = useCallback(async () => {
    const worker = workers.find((w) => w.id === selectedWorkerId);
    const gross = parseFloat(grossPay);
    if (!worker || !Number.isFinite(gross) || gross < 0) {
      setCalcError("Select a worker and enter a valid gross pay amount.");
      return;
    }
    setCalcError(null);
    setCalcLoading(true);
    try {
      const today = payDate || new Date().toISOString().split("T")[0];
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          worker: {
            workerId: worker.id,
            type: worker.type || "employee",
            residentAddress: { state: worker.residentState || "CA", line1: "", city: "", postal: "", country: "US" },
            workAddress: { state: worker.workState || worker.residentState || "CA", line1: "", city: "", postal: "", country: "US" },
          },
          earnings: [{ code: "regular", amount: gross }],
          payDate: today,
          periodStart: today,
          periodEnd: today,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setCalcError(j?.error || "Calculation failed");
        return;
      }
      setPayStub({
        workerName: worker.name,
        payDate: today,
        periodStart: today,
        periodEnd: today,
        result: j.result,
        engineKind: j.engineKind ?? "manual",
      });
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : "Calculation failed");
    } finally {
      setCalcLoading(false);
    }
  }, [workers, selectedWorkerId, grossPay, payDate]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Payroll</h1>
            <p className="mt-1 text-sm text-slate-400">
              Workers, pay runs, tax documents. Scoped by user and workspace (Client ID, Trust ID).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/dashboard"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Dashboard
            </Link>
            <Link href="/" className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
              Home
            </Link>
          </div>
        </div>

        {authStatus === "unauthenticated" && (
          <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-200">
            Log in to save and manage payroll data. Data is stored per user, workspace (Client ID, Trust ID).
          </div>
        )}

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <h2 className="font-semibold">Workspace</h2>
            <p className="text-xs text-slate-400">Client ID, Trust ID, Workspace ID</p>
            {loading && workspaces.length === 0 ? (
              <div className="mt-2 text-slate-500">Loading…</div>
            ) : workspaces.length === 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-500">No workspaces. Create one from a Client + Trust context.</span>
                {authStatus === "authenticated" && (
                  <button
                    onClick={() => {
                      const clientId = prompt("Client ID (optional):")?.trim() || undefined;
                      const trustId = prompt("Trust ID (optional):")?.trim() || undefined;
                      const name = prompt("Workspace name:")?.trim() || "Default";
                      fetch("/api/payroll/workspaces", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ clientId: clientId || null, trustId: trustId || null, name }),
                      })
                        .then((r) => r.json())
                        .then(() => fetchWorkspaces())
                        .catch(console.error);
                    }}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm hover:bg-cyan-500"
                  >
                    + Create workspace
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveWorkspace(null)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${!activeWorkspace ? "bg-cyan-600 text-white" : "bg-slate-700 hover:bg-slate-600"}`}
                >
                  All
                </button>
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() =>
                      setActiveWorkspace({
                        clientId: w.clientId ?? undefined,
                        trustId: w.trustId ?? undefined,
                        workspaceId: w.workspaceId ?? undefined,
                      })
                    }
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      activeWorkspace?.workspaceId === w.workspaceId ? "bg-cyan-600 text-white" : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    {w.name || w.workspaceId || (typeof w.id === "string" ? w.id.slice(0, 8) : "—")}
                    {w.clientId && typeof w.clientId === "string" && <span className="ml-1 text-xs opacity-75">({w.clientId.slice(0, 6)}…)</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Workers</h2>
                <p className="text-xs text-slate-400">Home/work address for state-specific tax logic</p>
              </div>
              {authStatus === "authenticated" && (
                <button
                  onClick={() => {
                    const name = prompt("Worker name?");
                    if (!name?.trim()) return;
                    fetch("/api/payroll/workers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        name: name.trim(),
                        type: "employee",
                        clientId: activeWorkspace?.clientId,
                        trustId: activeWorkspace?.trustId,
                        workspaceId: activeWorkspace?.workspaceId,
                      }),
                    })
                      .then((r) => r.json())
                      .then(() => fetchWorkers())
                      .catch(console.error);
                  }}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium hover:bg-cyan-500"
                >
                  + Add worker
                </button>
              )}
            </div>
            {workers.length === 0 ? (
              <div className="mt-2 text-slate-500">No workers yet.</div>
            ) : (
              <ul className="mt-2 space-y-2">
                {workers.map((w) => (
                  <li key={w.id} className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2">
                    <span>{w.name}</span>
                    <span className="text-xs text-slate-400">
                      {w.type} • {w.residentState || w.workState || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <h2 className="font-semibold">Pay Runs</h2>
            <p className="text-xs text-slate-400">Calculate gross-to-net and generate a paycheck stub (TaxEngine).</p>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Worker</label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm min-w-[180px]"
                  >
                    <option value="">— Select —</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Gross pay ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={grossPay}
                    onChange={(e) => setGrossPay(e.target.value)}
                    placeholder="0.00"
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm w-32"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pay date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={runCalculate}
                  disabled={calcLoading || !selectedWorkerId || !grossPay}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {calcLoading ? "Calculating…" : "Calculate & show stub"}
                </button>
              </div>
              {calcError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {calcError}
                </div>
              )}
            </div>

            {payStub && payStub.result && (
              <div className="mt-6 rounded-xl border border-slate-600 bg-slate-900/80 p-4">
                <h3 className="font-semibold text-cyan-300">Paycheck stub</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {payStub.workerName} • Pay date: {payStub.payDate} • Engine: {payStub.engineKind}
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross pay</span>
                    <span className="font-medium">{formatMoney(payStub.result.gross ?? 0)}</span>
                  </div>
                  {Array.isArray(payStub.result.taxes) && payStub.result.taxes.length > 0 && (
                    <>
                      <div className="border-t border-slate-700 mt-2 pt-2">
                        <div className="text-slate-400 mb-2">Deductions</div>
                        {payStub.result.taxes.map((t, i) => (
                          <div key={i} className="flex justify-between text-slate-300 py-0.5">
                            <span>{t.name}</span>
                            <span>-{formatMoney(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-2 font-medium">
                        <span>Total taxes</span>
                        <span>-{formatMoney(payStub.result.taxes?.reduce((s, t) => s + (t?.amount ?? 0), 0) ?? 0)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t-2 border-slate-600 pt-3 text-lg font-semibold text-cyan-300">
                    <span>Net pay</span>
                    <span>{formatMoney(payStub.result.net ?? 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {workers.length === 0 && (
              <div className="mt-4 text-slate-500 text-sm">Add workers above to calculate paychecks.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
