"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";

const ROLLOUT_TYPES = ["blended", "autonomous", "cadence", "notifications"] as const;
const STRATEGY_PRESETS: RolloutStrategyPreset[] = ["conservative", "balanced", "aggressive", "pilot_first"];

export function BentleyPolicyRolloutClient() {
  const searchParams = useSearchParams();
  const urlPlanId = searchParams.get("planId")?.trim() ?? "";
  const urlScenarioId = searchParams.get("scenarioId")?.trim() ?? "";

  const [clientId, setClientId] = useState("");
  const [trustId, setTrustId] = useState("");
  const [strategyPreset, setStrategyPreset] = useState<RolloutStrategyPreset>("balanced");
  const [planName, setPlanName] = useState("Staged rollout plan");
  const [rolloutType, setRolloutType] = useState<(typeof ROLLOUT_TYPES)[number]>("blended");
  const [sourceScenarioId, setSourceScenarioId] = useState("");

  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [currentPayload, setCurrentPayload] = useState<unknown>(null);
  const [simulationPayload, setSimulationPayload] = useState<unknown>(null);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [monitorPayload, setMonitorPayload] = useState<unknown>(null);
  const [checkPayload, setCheckPayload] = useState<unknown>(null);
  const [persistChecks, setPersistChecks] = useState(false);

  useEffect(() => {
    if (urlPlanId && !selectedPlanId) setSelectedPlanId(urlPlanId);
    if (urlScenarioId && !sourceScenarioId) setSourceScenarioId(urlScenarioId);
  }, [urlPlanId, urlScenarioId, selectedPlanId, sourceScenarioId]);

  const loadCurrent = useCallback(async () => {
    const qs = new URLSearchParams();
    if (clientId.trim()) qs.set("clientId", clientId.trim());
    if (trustId.trim()) qs.set("trustId", trustId.trim());
    qs.set("strategyPreset", strategyPreset);
    const res = await fetch(`/api/revenue-os/policy-rollout/current?${qs.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && typeof data === "object" && "signedOut" in data) {
      setSignedOut(Boolean((data as { signedOut?: boolean }).signedOut));
    }
    if (res.ok) setCurrentPayload(data);
  }, [clientId, trustId, strategyPreset]);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/revenue-os/policy-rollout/plans?limit=80", { cache: "no-store" });
    const data = (await res.json()) as {
      plans?: Array<{ id: string; name: string }>;
      signedOut?: boolean;
    };
    if (res.ok && data.plans) setPlans(data.plans);
    setSignedOut(Boolean(data.signedOut));
  }, []);

  useEffect(() => {
    void loadCurrent();
    void loadPlans();
  }, [loadCurrent, loadPlans]);

  const loadMonitor = useCallback(async () => {
    const pid = selectedPlanId.trim();
    if (!pid) {
      setError("Select a saved rollout plan first.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/revenue-os/policy-rollout/monitor?planId=${encodeURIComponent(pid)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Monitor failed");
      setMonitorPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monitor failed");
    } finally {
      setBusy(false);
    }
  }, [selectedPlanId]);

  const savePlan = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const scopeJson: Record<string, unknown> = {};
      if (clientId.trim()) scopeJson.clientId = clientId.trim();
      if (trustId.trim()) scopeJson.trustId = trustId.trim();
      const res = await fetch("/api/revenue-os/policy-rollout/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planName.trim() || "Staged rollout plan",
          rolloutType,
          sourceScenarioId: sourceScenarioId.trim() || null,
          strategyPreset,
          scopeJson: Object.keys(scopeJson).length ? scopeJson : null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; plan?: { id: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      setOkMsg("Rollout plan saved.");
      if (data.plan?.id) setSelectedPlanId(data.plan.id);
      await loadPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const simulate = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setSimulationPayload(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollout/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim() || undefined,
          trustId: trustId.trim() || undefined,
          strategyPreset,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Simulate failed");
      setSimulationPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setBusy(false);
    }
  };

  const runIdFromMonitor = (): string | null => {
    if (!monitorPayload || typeof monitorPayload !== "object") return null;
    const run = (monitorPayload as { run?: { id?: string } | null }).run;
    const id = run?.id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  };

  const advance = async () => {
    const planId = selectedPlanId.trim();
    if (!planId) {
      setError("Select a plan id.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollout/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, runId: runIdFromMonitor() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Advance failed");
      setOkMsg("Stage advanced (dry-run governance — see monitor for state).");
      await loadMonitor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advance failed");
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    const runId = runIdFromMonitor();
    if (!runId) {
      setError("Load monitor first — no active run id.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollout/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Pause failed");
      setOkMsg("Rollout paused.");
      await loadMonitor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pause failed");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    const runId = runIdFromMonitor();
    if (!runId) {
      setError("Load monitor first — no active run id.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Complete failed");
      setOkMsg("Rollout marked complete.");
      await loadMonitor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete failed");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    const planId = selectedPlanId.trim();
    if (!planId) {
      setError("Select a plan id.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setCheckPayload(null);
    try {
      const res = await fetch("/api/revenue-os/policy-rollout/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          persist: persistChecks,
          runId: runIdFromMonitor(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Check failed");
      setCheckPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Policy rollout</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Staged rollout coaching, simulation, and saved plans — advance/monitor paths are governed dry-run unless your
              deployment enables live policy writes elsewhere.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/dashboard/bentley/policy-workbench" className="text-cyan-400 hover:underline">
              Policy workbench
            </Link>
            <Link href="/dashboard/bentley/policy-deployments" className="text-cyan-400 hover:underline">
              Deployments
            </Link>
            <Link href="/dashboard/bentley/policy-rollback" className="text-cyan-400 hover:underline">
              Rollback
            </Link>
          </div>
        </div>

        {signedOut ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
            Sign in to load rollout coaching and save plans. You can still read public marketing pages from the home route.
          </div>
        ) : null}

        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Scope &amp; strategy</h2>
          <label className="block text-xs text-zinc-500">Client id (optional)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="scopes operator overview"
          />
          <label className="block text-xs text-zinc-500">Trust id (optional)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={trustId}
            onChange={(e) => setTrustId(e.target.value)}
          />
          <label className="block text-xs text-zinc-500">Strategy preset</label>
          <select
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={strategyPreset}
            onChange={(e) => setStrategyPreset(e.target.value as RolloutStrategyPreset)}
          >
            {STRATEGY_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadCurrent()}
              className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Refresh coaching
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void simulate()}
              className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
            >
              Simulate stages (dry run)
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Save rollout plan</h2>
          <label className="block text-xs text-zinc-500">Plan name</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
          />
          <label className="block text-xs text-zinc-500">Rollout type</label>
          <select
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={rolloutType}
            onChange={(e) => setRolloutType(e.target.value as (typeof ROLLOUT_TYPES)[number])}
          >
            {ROLLOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="block text-xs text-zinc-500">Source scenario id (optional)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-xs"
            value={sourceScenarioId}
            onChange={(e) => setSourceScenarioId(e.target.value)}
            placeholder="links to saved policy scenario"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void savePlan()}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Save plan
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Saved plans &amp; monitor</h2>
          <label className="block text-xs text-zinc-500">Active plan id</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-xs"
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            placeholder="choose or paste uuid"
            list="bentley-rollout-plan-ids"
          />
          <datalist id="bentley-rollout-plan-ids">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </datalist>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadMonitor()}
              className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Load monitor
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void advance()}
              className="rounded border border-cyan-600/60 px-3 py-1.5 text-sm text-cyan-100 disabled:opacity-50"
            >
              Advance stage
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pause()}
              className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
            >
              Pause
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void complete()}
              className="rounded border border-emerald-700/60 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-50"
            >
              Complete
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={persistChecks} onChange={(e) => setPersistChecks(e.target.checked)} />
            Persist monitoring check (writes run + notifications when enabled)
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void check()}
            className="rounded border border-amber-600/50 px-3 py-1.5 text-sm text-amber-100 disabled:opacity-50"
          >
            Run monitoring check
          </button>
        </section>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}

        {currentPayload ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">Coaching &amp; UI payload</h2>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
              {JSON.stringify(currentPayload, null, 2)}
            </pre>
          </section>
        ) : null}

        {simulationPayload ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">Simulation</h2>
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
              {JSON.stringify(simulationPayload, null, 2)}
            </pre>
          </section>
        ) : null}

        {monitorPayload ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">Monitor</h2>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
              {JSON.stringify(monitorPayload, null, 2)}
            </pre>
          </section>
        ) : null}

        {checkPayload ? (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">Check result</h2>
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
              {JSON.stringify(checkPayload, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
