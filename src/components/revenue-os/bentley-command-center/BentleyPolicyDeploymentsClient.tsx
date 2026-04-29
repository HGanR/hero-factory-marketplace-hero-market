"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function BentleyPolicyDeploymentsClient() {
  const searchParams = useSearchParams();
  const [scenarioId, setScenarioId] = useState("");
  const [rollbackPackageId, setRollbackPackageId] = useState("");
  const [rolloutPlanId, setRolloutPlanId] = useState("");
  const [clientId, setClientId] = useState("");
  const [trustId, setTrustId] = useState("");
  const [name, setName] = useState("Coordinated deployment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [changeSetId, setChangeSetId] = useState("");
  const [history, setHistory] = useState<unknown>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [urlBanner, setUrlBanner] = useState<string | null>(null);

  useEffect(() => {
    const sid = searchParams.get("scenarioId")?.trim() ?? "";
    const rid = searchParams.get("rollbackPackageId")?.trim() ?? "";
    const pid = searchParams.get("rolloutPlanId")?.trim() ?? "";
    const cid = searchParams.get("clientId")?.trim() ?? "";
    const tid = searchParams.get("trustId")?.trim() ?? "";
    if (sid) setScenarioId(sid);
    if (rid) setRollbackPackageId(rid);
    if (pid) setRolloutPlanId(pid);
    if (cid) setClientId(cid);
    if (tid) setTrustId(tid);
    if (rid) {
      setUrlBanner("Preparing deployment from rollback package — review items, then save or apply with confirmation.");
      setName((n) => (n === "Coordinated deployment" ? `Deployment — rollback package ${rid.slice(0, 8)}…` : n));
    } else if (sid) {
      setUrlBanner("Preparing deployment from scenario — uses the saved proposed snapshot; no live changes until apply.");
      setName((n) => (n === "Coordinated deployment" ? `Deployment — scenario ${sid.slice(0, 8)}…` : n));
    } else if (pid) {
      setUrlBanner(
        "Rollout plan linked — staged deployment ordering can align with this plan; prepare/save still do not mutate live policy."
      );
      setName((n) => (n === "Coordinated deployment" ? `Deployment — rollout plan ${pid.slice(0, 8)}…` : n));
    } else {
      setUrlBanner(null);
    }
  }, [searchParams]);

  const loadCurrent = useCallback(async () => {
    const res = await fetch("/api/revenue-os/policy-deployments/current", { cache: "no-store" });
    const data = (await res.json()) as { changeSet?: { id: string } | null; error?: string };
    if (res.status === 401) return;
    if (res.ok && data.changeSet?.id) setChangeSetId(data.changeSet.id);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/revenue-os/policy-deployments?limit=30", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setHistory(data);
  }, []);

  useEffect(() => {
    void loadCurrent();
    void loadHistory();
  }, [loadCurrent, loadHistory]);

  const prepareBody = () => ({
    name: name.trim() || "Coordinated deployment",
    scenarioId: scenarioId.trim() || null,
    rollbackPackageId: rollbackPackageId.trim() || null,
    rolloutPlanId: rolloutPlanId.trim() || null,
    clientId: clientId.trim() || null,
    trustId: trustId.trim() || null,
    scopeMode: "single_workspace" as const,
  });

  const prepare = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setPreview(null);
    try {
      const res = await fetch("/api/revenue-os/policy-deployments/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepareBody()),
      });
      const data = (await res.json()) as { error?: string };
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
      const res = await fetch("/api/revenue-os/policy-deployments/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeSetId: changeSetId.trim() || null,
          ...prepareBody(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; changeSetId?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      if (data.changeSetId) setChangeSetId(data.changeSetId);
      setOkMsg("Change set saved — apply still requires explicit confirmation.");
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!changeSetId.trim()) {
      setError("Save a change set first (or paste a change set id).");
      return;
    }
    if (!confirmApply) {
      setError("Check the confirmation box to apply live policy upserts.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/revenue-os/policy-deployments/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeSetId: changeSetId.trim(), confirm: true as const }),
      });
      const data = (await res.json()) as { error?: string; applied?: number; failed?: number };
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setOkMsg(
        `Apply finished — applied ${data.applied ?? 0}, failed ${data.failed ?? 0}. See audit for details.`
      );
      setConfirmApply(false);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Policy deployments</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cross-family change sets, staged ordering, and history — prepare/save do not mutate live policy
            </p>
          </div>
          <Link href="/dashboard/bentley/policy-workbench" className="text-sm text-cyan-400 hover:underline">
            Policy workbench
          </Link>
          <Link href="/dashboard/bentley/policy-rollback" className="text-sm text-cyan-400 hover:underline">
            Policy rollback
          </Link>
          <Link href="/dashboard/bentley/policy-rollout" className="text-sm text-cyan-400 hover:underline">
            Policy rollout
          </Link>
        </div>

        {urlBanner ? (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/95">
            {urlBanner}
          </div>
        ) : null}

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Sources</h2>
          <label className="block text-xs text-zinc-500">Client id (optional scope)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="from workbench / rollout when linked"
          />
          <label className="block text-xs text-zinc-500">Trust id (optional scope)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={trustId}
            onChange={(e) => setTrustId(e.target.value)}
          />
          <label className="block text-xs text-zinc-500">Scenario id (forward deploy)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            placeholder="optional — uses proposed snapshot from saved scenario"
          />
          <label className="block text-xs text-zinc-500">Rollout plan id (staged deploy context)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={rolloutPlanId}
            onChange={(e) => setRolloutPlanId(e.target.value)}
            placeholder="optional — from rollout workbench"
          />
          <label className="block text-xs text-zinc-500">Rollback package id (rollback deploy)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={rollbackPackageId}
            onChange={(e) => setRollbackPackageId(e.target.value)}
            placeholder="optional — builds from rollback target snapshot"
          />
          <label className="block text-xs text-zinc-500">Name</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="block text-xs text-zinc-500">Change set id (after save)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-xs"
            value={changeSetId}
            onChange={(e) => setChangeSetId(e.target.value)}
            placeholder="populated after save"
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void prepare()}
              className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Prepare
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
            >
              Save draft
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Apply (governed)</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={confirmApply}
              onChange={(e) => setConfirmApply(e.target.checked)}
            />
            I confirm coordinated upserts to live policies for this change set
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply()}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Apply change set
          </button>
        </section>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}

        {preview ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-2">Prepare preview</h2>
            <pre className="max-h-[420px] overflow-auto text-xs text-zinc-400 whitespace-pre-wrap">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </section>
        ) : null}

        {history ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-2">Recent deployments</h2>
            <pre className="max-h-[320px] overflow-auto text-xs text-zinc-400 whitespace-pre-wrap">
              {JSON.stringify(history, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
