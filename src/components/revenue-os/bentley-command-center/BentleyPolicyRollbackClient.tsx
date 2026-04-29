"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { buildPolicyDeploymentsWorkbenchHref } from "@/lib/revenue-os/policy-deployments-navigation";

const ROLLBACK_TYPES = ["blended", "autonomous", "cadence", "notifications"] as const;

export function BentleyPolicyRollbackClient() {
  const searchParams = useSearchParams();
  const urlPlanId = searchParams.get("planId")?.trim() ?? "";
  const urlScenarioId = searchParams.get("scenarioId")?.trim() ?? "";

  const [clientId, setClientId] = useState("");
  const [trustId, setTrustId] = useState("");
  const [planId, setPlanId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [rollbackType, setRollbackType] = useState<(typeof ROLLBACK_TYPES)[number]>("blended");
  const [packageName, setPackageName] = useState("Rollback package");
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [packages, setPackages] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPkg, setSelectedPkg] = useState<string>("");
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => {
    if (urlPlanId && !planId) setPlanId(urlPlanId);
    if (urlScenarioId && !scenarioId) setScenarioId(urlScenarioId);
  }, [urlPlanId, urlScenarioId, planId, scenarioId]);

  const loadPackages = useCallback(async () => {
    const res = await fetch("/api/revenue-os/policy-rollback/packages", { cache: "no-store" });
    const data = (await res.json()) as { packages?: Array<{ id: string; name: string }>; signedOut?: boolean };
    if (res.ok && data.packages) setPackages(data.packages);
    setSignedOut(Boolean(data.signedOut));
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const prepare = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setPreview(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollback/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planId.trim() || null,
          scenarioId: scenarioId.trim() || null,
          clientId: clientId.trim() || null,
          trustId: trustId.trim() || null,
          rollbackType,
          name: packageName.trim() || "Rollback package",
        }),
      });
      const data = (await res.json()) as { error?: string; ui?: unknown };
      if (!res.ok) throw new Error(data.error ?? "Prepare failed");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollback/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planId.trim() || null,
          scenarioId: scenarioId.trim() || null,
          clientId: clientId.trim() || null,
          trustId: trustId.trim() || null,
          rollbackType,
          name: packageName.trim() || "Rollback package",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; package?: { id: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      setOkMsg("Package saved — apply still requires explicit confirmation below.");
      setSelectedPkg(data.package?.id ?? "");
      await loadPackages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!confirmApply || !selectedPkg.trim()) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollback/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollbackPackageId: selectedPkg.trim(),
          confirm: true as const,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; summary?: { headline: string } };
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setOkMsg(data.summary?.headline ?? (data.ok ? "Apply completed." : "Apply finished with issues."));
      setConfirmApply(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const ui = preview as { ui?: { confirmationPreviews?: unknown[]; checklist?: unknown[] } } | null;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2 border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Bentley</p>
          <h1 className="text-2xl font-semibold text-white">Policy rollback workbench</h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            Prepare explicit rollback packages from a saved scenario baseline or rollout plan. Review upsert payloads, then
            apply with confirmation.{" "}
            <span className="text-amber-200/90">Rollback is operator-approved — Bentley never auto-reverts live policies.</span>
          </p>
          <p className="text-sm">
            <Link href="/dashboard/bentley/policy-rollout" className="text-cyan-400/90 underline-offset-4 hover:underline">
              Policy rollout workbench
            </Link>
            <span className="text-zinc-600"> · </span>
            <Link href="/dashboard/bentley/policy-workbench" className="text-cyan-400/90 underline-offset-4 hover:underline">
              Policy tuning workbench
            </Link>
            <span className="text-zinc-600"> · </span>
            <Link
              href={buildPolicyDeploymentsWorkbenchHref({
                rollbackPackageId: selectedPkg.trim() || undefined,
                scenarioId: scenarioId.trim() || undefined,
                clientId: clientId.trim() || undefined,
                trustId: trustId.trim() || undefined,
              })}
              className="text-emerald-300/90 underline-offset-4 hover:underline"
            >
              Policy deployments
            </Link>
          </p>
        </header>

        {signedOut ? (
          <p className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-400">Sign in to use rollback.</p>
        ) : null}

        <section className="grid gap-4 rounded-xl border border-white/10 bg-black/30 p-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-500">Package name</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Client id (optional scope)</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Trust id (optional scope)</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={trustId}
              onChange={(e) => setTrustId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Source rollout plan id</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              placeholder="Optional if scenario set"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Source scenario id</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              placeholder="Uses scenario baseline as target"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-500">Rollback type</span>
            <select
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={rollbackType}
              onChange={(e) => setRollbackType(e.target.value as (typeof ROLLBACK_TYPES)[number])}
            >
              {ROLLBACK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={signedOut || busy}
              onClick={() => void prepare()}
              className="rounded-lg bg-violet-700/80 px-4 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-40"
            >
              Prepare (dry)
            </button>
            <button
              type="button"
              disabled={signedOut || busy}
              onClick={() => void save()}
              className="rounded-lg border border-violet-500/40 px-4 py-2 text-sm text-violet-100 hover:bg-violet-500/10 disabled:opacity-40"
            >
              Save package
            </button>
          </div>
        </section>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {okMsg ? <p className="text-sm text-emerald-300">{okMsg}</p> : null}

        <section className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h2 className="text-sm font-medium text-zinc-200">Saved packages</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              className="rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={selectedPkg}
              onChange={(e) => setSelectedPkg(e.target.value)}
            >
              <option value="">— Select package to apply —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={confirmApply} onChange={(e) => setConfirmApply(e.target.checked)} />
              I confirm rollback apply for the selected package
            </label>
            <button
              type="button"
              disabled={signedOut || busy || !selectedPkg || !confirmApply}
              onClick={() => void apply()}
              className="rounded-lg bg-rose-700/80 px-4 py-2 text-sm text-white hover:bg-rose-600 disabled:opacity-40"
            >
              Apply rollback bundle
            </button>
            {selectedPkg.trim() ? (
              <Link
                href={buildPolicyDeploymentsWorkbenchHref({
                  rollbackPackageId: selectedPkg.trim(),
                  scenarioId: scenarioId.trim() || undefined,
                  clientId: clientId.trim() || undefined,
                  trustId: trustId.trim() || undefined,
                })}
                className="inline-flex items-center rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200/90 hover:bg-emerald-500/10"
              >
                Open in Policy Deployments (rollback change set)
              </Link>
            ) : null}
          </div>
        </section>

        {preview ? (
          <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <h2 className="text-sm font-medium text-violet-100">Prepare result (review)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Confirmation previews: {ui?.confirmationPreviews?.length ?? 0} upsert-shaped payload(s). Save the package before
              apply, or load a saved package above.
            </p>
            <pre className="mt-3 max-h-[28rem] overflow-auto rounded bg-black/40 p-3 text-xs text-zinc-400">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
