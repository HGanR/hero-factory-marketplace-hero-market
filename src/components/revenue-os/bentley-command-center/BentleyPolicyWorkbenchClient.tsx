"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import {
  buildProposedPolicySnapshotFromForm,
  buildAutonomousPatchFromForm,
  defaultPolicyWorkbenchFormState,
  type PolicyWorkbenchFormState,
} from "@/lib/revenue-os/policy-workbench-form";
import {
  buildAutonomousUpsertPayloadFromPatch,
  buildAutomationUpsertPayloadFromCadenceForm,
  buildNotificationPolicyUpsertPayloadFromForm,
  isCadenceLikeAutomationPolicy,
} from "@/lib/revenue-os/policy-workbench-ui";
import { applyWorkbenchPresetToForm, type WorkbenchRecommendationPreset } from "@/lib/revenue-os/policy-workbench-presets";
import type { AutomationPolicyRow } from "@/lib/revenue-os/automation-policies-db";
import type { NotificationPolicyRow } from "@/lib/revenue-os/notification-db";
import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import { BentleyScenarioCompareMatrix, type RichMatrixUiPayload } from "@/components/revenue-os/bentley-command-center/BentleyScenarioCompareMatrix";
import { BentleyPolicyApplyReviewPanel } from "@/components/revenue-os/bentley-command-center/BentleyPolicyApplyReviewPanel";
import { BentleyPolicyWorkbenchGuidanceSummary } from "@/components/revenue-os/bentley-command-center/BentleyPolicyWorkbenchGuidanceSummary";
import { buildPolicyDeploymentsWorkbenchHref } from "@/lib/revenue-os/policy-deployments-navigation";

type ScenarioType = "autonomous" | "cadence" | "notifications" | "blended";

type PolicyListRow = {
  id: string;
  clientId: string;
  trustId: string;
  actionType: string;
  isEnabled: boolean;
  requiresApprovalAboveSeverity: string;
  maxDailyExecutions: number | null;
  cooldownMinutes: number | null;
};

type WorkbenchRun = {
  comparison?: {
    addedAutoActions?: number;
    removedAutoActions?: number;
    addedApprovals?: number;
    removedApprovals?: number;
    changedNotifications?: number | null;
    changedQueueStates?: number | null;
    summaryDelta?: string;
  };
  autonomous?: { riskFlags?: string[]; simulationSummary?: string } | null;
  cadence?: {
    staleDraftsEligibleCurrent?: number;
    staleDraftsEligibleProposed?: number;
    promoteWithoutApprovalDelta?: number;
  } | null;
  notifications?: {
    eventsCurrent?: number;
    eventsProposed?: number;
    droppedBySeverityFilter?: number;
  } | null;
  riskSummary?: { lines?: string[]; riskFlags?: string[] };
  recommendation?: { title?: string; body?: string; humanReviewAdvised?: boolean };
  deltaSummary?: string;
};

export function BentleyPolicyWorkbenchClient() {
  const [clientId, setClientId] = useState("");
  const [trustId, setTrustId] = useState("");
  const [scenarioType, setScenarioType] = useState<ScenarioType>("blended");
  const [form, setForm] = useState<PolicyWorkbenchFormState>(() => defaultPolicyWorkbenchFormState());
  const [advancedJson, setAdvancedJson] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [saveName, setSaveName] = useState("My scenario");
  const [current, setCurrent] = useState<unknown>(null);
  const [workbenchUi, setWorkbenchUi] = useState<{
    guidedPairs?: unknown;
    recommendationPresets?: Array<{ id: string; label: string; rationale: string }>;
    growthGuidance?: GrowthGuidance | null;
  } | null>(null);
  const [policies, setPolicies] = useState<PolicyListRow[]>([]);
  const [automationPolicies, setAutomationPolicies] = useState<AutomationPolicyRow[]>([]);
  const [notificationPolicies, setNotificationPolicies] = useState<NotificationPolicyRow[]>([]);
  const [run, setRun] = useState<WorkbenchRun | null>(null);
  const [scenarios, setScenarios] = useState<unknown[]>([]);
  const [compare, setCompare] = useState<unknown>(null);
  const [compareUi, setCompareUi] = useState<{ richMatrix?: RichMatrixUiPayload } | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [lastSavedScenarioId, setLastSavedScenarioId] = useState<string | null>(null);
  const [confirmAutonomous, setConfirmAutonomous] = useState(false);
  const [confirmCadence, setConfirmCadence] = useState(false);
  const [confirmNotif, setConfirmNotif] = useState(false);
  const [applyOk, setApplyOk] = useState<string | null>(null);
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyCadenceOk, setApplyCadenceOk] = useState<string | null>(null);
  const [applyCadenceErr, setApplyCadenceErr] = useState<string | null>(null);
  const [applyNotifOk, setApplyNotifOk] = useState<string | null>(null);
  const [applyNotifErr, setApplyNotifErr] = useState<string | null>(null);
  const skipPrefill = useRef(false);

  const q = () => {
    const sp = new URLSearchParams();
    if (clientId.trim()) sp.set("clientId", clientId.trim());
    if (trustId.trim()) sp.set("trustId", trustId.trim());
    return sp.toString();
  };

  const buildProposed = useCallback((): Record<string, unknown> => {
    if (advancedJson && rawJson.trim()) {
      try {
        return JSON.parse(rawJson) as Record<string, unknown>;
      } catch {
        return buildProposedPolicySnapshotFromForm(form);
      }
    }
    return buildProposedPolicySnapshotFromForm(form);
  }, [advancedJson, rawJson, form]);

  const proposedPreview = useMemo(() => JSON.stringify(buildProposed(), null, 2), [buildProposed]);

  const setAdvancedJsonMode = (v: boolean) => {
    setAdvancedJson(v);
    if (v) {
      setRawJson(JSON.stringify(buildProposedPolicySnapshotFromForm(form), null, 2));
    }
  };

  const loadCurrent = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/revenue-os/policy-workbench/current?${q()}`, { cache: "no-store" });
    const data = (await res.json()) as {
      signedOut?: boolean;
      workbench?: unknown;
      ui?: {
        guidedPairs?: unknown;
        recommendationPresets?: Array<{ id: string; label: string; rationale: string }>;
        growthGuidance?: GrowthGuidance | null;
      };
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    setSignedOut(Boolean(data.signedOut));
    setCurrent(data.workbench ?? null);
    setWorkbenchUi(data.ui ?? null);
  }, [clientId, trustId]);

  const loadPolicies = useCallback(async () => {
    const res = await fetch(`/api/revenue-os/autonomous/policies?${q()}`, { cache: "no-store" });
    const data = (await res.json()) as { policies?: PolicyListRow[]; signedOut?: boolean };
    if (res.ok && data.policies) setPolicies(data.policies);
  }, [clientId, trustId]);

  const loadAutomationPolicies = useCallback(async () => {
    const res = await fetch(`/api/revenue-os/automations/policies?${q()}`, { cache: "no-store" });
    const data = (await res.json()) as { policies?: AutomationPolicyRow[] };
    if (res.ok && data.policies) setAutomationPolicies(data.policies);
  }, [clientId, trustId]);

  const loadNotificationPolicies = useCallback(async () => {
    const res = await fetch(`/api/revenue-os/notifications/policies?${q()}`, { cache: "no-store" });
    const data = (await res.json()) as { policies?: NotificationPolicyRow[] };
    if (res.ok && data.policies) setNotificationPolicies(data.policies);
  }, [clientId, trustId]);

  const loadScenarios = useCallback(async () => {
    const res = await fetch(`/api/revenue-os/policy-workbench/scenarios?${q()}`, { cache: "no-store" });
    const data = (await res.json()) as { scenarios?: unknown[] };
    if (res.ok && data.scenarios) setScenarios(data.scenarios);
  }, [clientId, trustId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadCurrent();
        await loadPolicies();
        await loadAutomationPolicies();
        await loadNotificationPolicies();
        await loadScenarios();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCurrent, loadPolicies, loadAutomationPolicies, loadNotificationPolicies, loadScenarios]);

  useEffect(() => {
    if (!form.includeAutonomousPatch) return;
    if (skipPrefill.current) {
      skipPrefill.current = false;
      return;
    }
    const p = policies.find((x) => x.id === form.autonomousPolicyId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      patchIsEnabled: p.isEnabled,
      patchRequiresApprovalAboveSeverity: p.requiresApprovalAboveSeverity as PolicyWorkbenchFormState["patchRequiresApprovalAboveSeverity"],
      patchMaxDailyExecutions: p.maxDailyExecutions != null ? String(p.maxDailyExecutions) : "",
      patchCooldownMinutes: p.cooldownMinutes != null ? String(p.cooldownMinutes) : "",
    }));
  }, [form.autonomousPolicyId, form.includeAutonomousPatch, policies]);

  const runSimulateRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | undefined>(undefined);

  const runSimulate = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setBusy(true);
      } else {
        setPreviewBusy(true);
      }
      if (!silent) setError(null);
      if (!silent) setSaveOk(null);
      try {
        let proposed: Record<string, unknown>;
        try {
          proposed = buildProposed();
        } catch {
          throw new Error("Invalid proposal — check advanced JSON.");
        }
        const res = await fetch("/api/revenue-os/policy-workbench/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: true,
            clientId: clientId.trim() || undefined,
            trustId: trustId.trim() || undefined,
            scenarioType,
            proposedPolicySnapshotJson: proposed,
          }),
        });
        const data = (await res.json()) as { run?: WorkbenchRun; error?: string; signedOut?: boolean };
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        setSignedOut(Boolean(data.signedOut));
        setRun(data.run ?? null);
        setApplyOk(null);
        setApplyErr(null);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Simulate failed");
      } finally {
        if (!silent) setBusy(false);
        else setPreviewBusy(false);
      }
    },
    [buildProposed, clientId, trustId, scenarioType]
  );

  runSimulateRef.current = runSimulate;

  useEffect(() => {
    if (signedOut || loading) return;
    const t = window.setTimeout(() => {
      void runSimulateRef.current?.({ silent: true });
    }, 650);
    return () => window.clearTimeout(t);
  }, [form, scenarioType, clientId, trustId, advancedJson, rawJson, signedOut, loading]);

  const simulate = () => void runSimulate({ silent: false });

  const saveScenario = async () => {
    setBusy(true);
    setError(null);
    setSaveOk(null);
    try {
      const proposed = buildProposed();
      const res = await fetch("/api/revenue-os/policy-workbench/save-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim() || "Untitled scenario",
          clientId: clientId.trim() || undefined,
          trustId: trustId.trim() || undefined,
          scenarioType,
          proposedPolicySnapshotJson: proposed,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; scenario?: { id?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      const sid = data.scenario?.id?.trim() ?? null;
      setLastSavedScenarioId(sid);
      setSaveOk("Scenario saved (dry-run output stored — live policies unchanged).");
      await loadScenarios();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const compareSaved = async () => {
    setBusy(true);
    setError(null);
    try {
      const ids = scenarios
        .map((s) => {
          const row = s as { scenario?: { id?: string } };
          return row.scenario?.id;
        })
        .filter(Boolean) as string[];
      const res = await fetch("/api/revenue-os/policy-workbench/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioIds: ids.slice(0, 12),
          pairedScenarioMode: ids.length === 2,
        }),
      });
      const data = (await res.json()) as {
        compare?: unknown;
        ui?: { richMatrix?: RichMatrixUiPayload };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCompare(data.compare ?? null);
      setCompareUi(data.ui ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setBusy(false);
    }
  };

  const selectedPolicy = policies.find((p) => p.id === form.autonomousPolicyId);
  const canApplyAutonomous =
    !signedOut &&
    form.includeAutonomousPatch &&
    Boolean(selectedPolicy) &&
    Boolean(buildAutonomousPatchFromForm(form));

  const applyAutonomousPolicy = async () => {
    if (!canApplyAutonomous || !confirmAutonomous || !selectedPolicy) return;
    setBusy(true);
    setApplyErr(null);
    setApplyOk(null);
    try {
      const patch = buildAutonomousPatchFromForm(form);
      if (!patch) throw new Error("No patch to apply.");
      const body = buildAutonomousUpsertPayloadFromPatch({
        policy: selectedPolicy as unknown as AutonomousPolicyRow,
        patch,
      });
      const res = await fetch("/api/revenue-os/autonomous/policies/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Apply failed");
      setApplyOk("Autonomous policy updated.");
      setConfirmAutonomous(false);
      skipPrefill.current = true;
      await loadPolicies();
      await loadCurrent();
      await runSimulate({ silent: false });
    } catch (e) {
      setApplyErr(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const selectedAutomationPolicy = automationPolicies.find((p) => p.id === form.cadenceAutomationPolicyId);
  const canApplyCadence =
    form.includeCadenceAutomationApply &&
    Boolean(selectedAutomationPolicy && isCadenceLikeAutomationPolicy(selectedAutomationPolicy));

  const applyCadencePolicy = async () => {
    if (!canApplyCadence || !confirmCadence || !selectedAutomationPolicy) return;
    setBusy(true);
    setApplyCadenceErr(null);
    setApplyCadenceOk(null);
    try {
      const d = form.staleDraftDaysForAutomation.trim();
      const n = d === "" ? null : Number(d);
      const body = buildAutomationUpsertPayloadFromCadenceForm({
        policy: selectedAutomationPolicy,
        staleDraftDaysProposed: n != null && Number.isFinite(n) ? n : null,
      });
      const res = await fetch("/api/revenue-os/automations/policies/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Apply failed");
      setApplyCadenceOk("Automation policy updated.");
      setConfirmCadence(false);
      await loadAutomationPolicies();
      await loadCurrent();
      await runSimulate({ silent: false });
    } catch (e) {
      setApplyCadenceErr(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const selectedNotificationPolicy = notificationPolicies.find((p) => p.id === form.notificationPolicyId);
  const canApplyNotification = form.includeNotificationApply && Boolean(selectedNotificationPolicy);

  const applyNotificationPolicy = async () => {
    if (!canApplyNotification || !confirmNotif || !selectedNotificationPolicy) return;
    setBusy(true);
    setApplyNotifErr(null);
    setApplyNotifOk(null);
    try {
      const body = buildNotificationPolicyUpsertPayloadFromForm({
        policy: selectedNotificationPolicy,
        minimumSeverity: form.notificationMinSeverityApply,
      });
      const res = await fetch("/api/revenue-os/notifications/policies/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Apply failed");
      setApplyNotifOk("Notification policy updated.");
      setConfirmNotif(false);
      await loadNotificationPolicies();
      await loadCurrent();
      await runSimulate({ silent: false });
    } catch (e) {
      setApplyNotifErr(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const applyReviewSections = [
    {
      id: "autonomous",
      badge: "Autonomous",
      title: "Autonomous action policy",
      route: "/api/revenue-os/autonomous/policies/upsert",
      description: `Patch for ${selectedPolicy?.actionType ?? "policy"}.`,
      preview: canApplyAutonomous
        ? buildAutonomousUpsertPayloadFromPatch({
            policy: selectedPolicy as unknown as AutonomousPolicyRow,
            patch: buildAutonomousPatchFromForm(form)!,
          })
        : {},
      confirm: confirmAutonomous,
      onConfirmChange: setConfirmAutonomous,
      onApply: applyAutonomousPolicy,
      canApply: Boolean(canApplyAutonomous && run),
      blockedReason:
        !form.includeAutonomousPatch
          ? null
          : !run
            ? "Run a simulation first."
            : !selectedPolicy
              ? "Select an autonomous policy."
              : null,
      busy,
      ok: applyOk,
      err: applyErr,
      accent: "rose" as const,
    },
    {
      id: "cadence_automation",
      badge: "Automation",
      title: "Cadence / stale automation policy",
      route: "/api/revenue-os/automations/policies/upsert",
      description: "Updates policyConfigJson.staleDraftDaysThreshold when a day count is set.",
      preview: canApplyCadence && selectedAutomationPolicy
        ? buildAutomationUpsertPayloadFromCadenceForm({
            policy: selectedAutomationPolicy,
            staleDraftDaysProposed:
              form.staleDraftDaysForAutomation.trim() === ""
                ? null
                : Number(form.staleDraftDaysForAutomation),
          })
        : {},
      confirm: confirmCadence,
      onConfirmChange: setConfirmCadence,
      onApply: applyCadencePolicy,
      canApply: Boolean(canApplyCadence && run),
      blockedReason: !form.includeCadenceAutomationApply
        ? null
        : !run
          ? "Run a simulation first."
          : !selectedAutomationPolicy
            ? "Select a stale backlog or daily cadence automation policy."
            : !isCadenceLikeAutomationPolicy(selectedAutomationPolicy as AutomationPolicyRow)
              ? "Pick a stale_backlog_cleanup or daily_cadence_run policy."
              : null,
      busy,
      ok: applyCadenceOk,
      err: applyCadenceErr,
      accent: "amber" as const,
    },
    {
      id: "notification",
      badge: "Notification",
      title: "Notification routing policy",
      route: "/api/revenue-os/notifications/policies/upsert",
      description: "Updates minimumSeverity for the selected routing policy.",
      preview:
        canApplyNotification && selectedNotificationPolicy
          ? buildNotificationPolicyUpsertPayloadFromForm({
              policy: selectedNotificationPolicy,
              minimumSeverity: form.notificationMinSeverityApply,
            })
          : {},
      confirm: confirmNotif,
      onConfirmChange: setConfirmNotif,
      onApply: applyNotificationPolicy,
      canApply: Boolean(canApplyNotification && run),
      blockedReason: !form.includeNotificationApply
        ? null
        : !run
          ? "Run a simulation first."
          : !selectedNotificationPolicy
            ? "Select a notification policy (requires channel routing in scope)."
            : null,
      busy,
      ok: applyNotifOk,
      err: applyNotifErr,
      accent: "cyan" as const,
    },
  ];

  if (loading && !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading policy workbench…
      </div>
    );
  }

  const workbench = current as { currentPoliciesSummary?: string; empty?: boolean } | null;
  const cmp = run?.comparison;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2 border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Bentley</p>
          <h1 className="text-2xl font-semibold text-white">Policy tuning workbench</h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Form-based proposals with live dry-run preview. Saving persists scenario output only — it does{" "}
            <span className="text-amber-200/90">not</span> change live policies. Applying an autonomous patch uses the
            standard upsert API after explicit confirmation.
          </p>
          <p className="text-sm">
            <Link
              href="/dashboard/bentley/policy-rollout"
              className="text-amber-200/90 underline-offset-4 hover:text-amber-100 hover:underline"
            >
              Policy rollout workbench
            </Link>
            <span className="text-zinc-600"> · </span>
            <Link
              href={buildPolicyDeploymentsWorkbenchHref({
                scenarioId: lastSavedScenarioId ?? undefined,
                clientId: clientId.trim() || undefined,
                trustId: trustId.trim() || undefined,
              })}
              className="text-emerald-300/90 underline-offset-4 hover:text-emerald-200 hover:underline"
            >
              Policy deployments
            </Link>
            <span className="text-zinc-600"> · </span>
            <Link
              href="/dashboard/bentley/social-command-center"
              className="text-cyan-400/90 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              ← Social Command Center
            </Link>
          </p>
        </header>

        {!signedOut ? <BentleyPolicyWorkbenchGuidanceSummary growthGuidance={workbenchUi?.growthGuidance} /> : null}

        {signedOut ? (
          <p className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-400">
            Sign in to load policies and run simulations.
          </p>
        ) : null}

        <section className="grid gap-4 rounded-xl border border-white/10 bg-black/30 p-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-500">Client id (scope)</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Trust id (scope)</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={trustId}
              onChange={(e) => setTrustId(e.target.value)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-500">Scenario type</span>
            <select
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value as ScenarioType)}
            >
              <option value="autonomous">Autonomous</option>
              <option value="cadence">Cadence</option>
              <option value="notifications">Notifications</option>
              <option value="blended">Blended</option>
            </select>
          </label>
        </section>

        <section className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
          <h2 className="text-sm font-medium text-zinc-200">Current policies (summary)</h2>
          <p className="text-sm text-zinc-400">{workbench?.currentPoliciesSummary ?? "—"}</p>
          {workbench?.empty ? (
            <p className="text-xs text-amber-200/80">Empty scope — add policies or widen workspace filters.</p>
          ) : null}
        </section>

        {workbenchUi?.recommendationPresets?.length ? (
          <section className="rounded-xl border border-white/10 bg-black/25 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Recommendation presets</h2>
            <p className="text-xs text-zinc-500">Adjust the form toward a strategy — then review dry-run deltas.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {workbenchUi.recommendationPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={signedOut}
                  onClick={() =>
                    setForm((prev) => applyWorkbenchPresetToForm(p.id as WorkbenchRecommendationPreset, prev))
                  }
                  className="rounded-full border border-white/15 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-500/40 disabled:opacity-40"
                  title={p.rationale}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {Array.isArray(workbenchUi?.guidedPairs) && (workbenchUi!.guidedPairs as unknown[]).length > 0 ? (
          <section className="rounded-xl border border-white/10 bg-black/25 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Guided paired simulations</h2>
            <p className="text-xs text-zinc-500">
              Compare meaningful baselines vs contrasts — copy JSON into Advanced mode or tune the form to match.
            </p>
            <div className="mt-3 space-y-2">
              {(workbenchUi!.guidedPairs as Array<{ id: string; label: string; rationale: string; left: unknown; right: unknown }>).map(
                (pair) => (
                  <details key={pair.id} className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
                    <summary className="cursor-pointer text-zinc-300">{pair.label}</summary>
                    <p className="mt-2 text-zinc-500">{pair.rationale}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <pre className="max-h-32 overflow-auto rounded bg-black/50 p-2 text-[10px] text-zinc-500">
                        {JSON.stringify(pair.left, null, 2)}
                      </pre>
                      <pre className="max-h-32 overflow-auto rounded bg-black/50 p-2 text-[10px] text-zinc-500">
                        {JSON.stringify(pair.right, null, 2)}
                      </pre>
                    </div>
                  </details>
                )
              )}
            </div>
          </section>
        ) : null}

        <section className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-200">Proposal (structured)</h2>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={advancedJson}
                onChange={(e) => setAdvancedJsonMode(e.target.checked)}
              />
              Advanced: edit raw JSON
            </label>
          </div>

          {!advancedJson ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-white/5 bg-zinc-900/40 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cadence</h3>
                <label className="block text-xs text-zinc-400">
                  Stale days (current)
                  <input
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    inputMode="numeric"
                    value={form.staleDaysCurrent}
                    onChange={(e) => setForm((f) => ({ ...f, staleDaysCurrent: e.target.value }))}
                    placeholder="optional"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  Stale days (proposed)
                  <input
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    inputMode="numeric"
                    value={form.staleDaysProposed}
                    onChange={(e) => setForm((f) => ({ ...f, staleDaysProposed: e.target.value }))}
                    placeholder="e.g. 21"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.promotedWinnersSkippingApproval}
                    onChange={(e) => setForm((f) => ({ ...f, promotedWinnersSkippingApproval: e.target.checked }))}
                  />
                  Count hypothetical winner approval bypass
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-white/5 bg-zinc-900/40 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notifications</h3>
                <label className="block text-xs text-zinc-400">
                  Minimum severity (proposed)
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                    value={form.minSeverityProposed}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        minSeverityProposed: e.target.value as PolicyWorkbenchFormState["minSeverityProposed"],
                      }))
                    }
                  >
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-amber-900/30 bg-amber-950/10 p-3 md:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Autonomous policy patch</h3>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.includeAutonomousPatch}
                    onChange={(e) => setForm((f) => ({ ...f, includeAutonomousPatch: e.target.checked }))}
                  />
                  Include patch for one autonomous policy (required for live apply)
                </label>
                <label className="block text-xs text-zinc-400">
                  Policy
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                    disabled={!form.includeAutonomousPatch}
                    value={form.autonomousPolicyId}
                    onChange={(e) => setForm((f) => ({ ...f, autonomousPolicyId: e.target.value }))}
                  >
                    <option value="">Select policy…</option>
                    {policies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.actionType} ({p.id.slice(0, 8)}…)
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={form.patchIsEnabled}
                      disabled={!form.includeAutonomousPatch}
                      onChange={(e) => setForm((f) => ({ ...f, patchIsEnabled: e.target.checked }))}
                    />
                    Enabled
                  </label>
                  <label className="block text-xs text-zinc-400">
                    Approvals above severity
                    <select
                      className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                      disabled={!form.includeAutonomousPatch}
                      value={form.patchRequiresApprovalAboveSeverity}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          patchRequiresApprovalAboveSeverity: e.target
                            .value as PolicyWorkbenchFormState["patchRequiresApprovalAboveSeverity"],
                        }))
                      }
                    >
                      <option value="none">none</option>
                      <option value="info">info</option>
                      <option value="warning">warning</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="block text-xs text-zinc-400">
                    Max daily executions
                    <input
                      className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                      disabled={!form.includeAutonomousPatch}
                      inputMode="numeric"
                      value={form.patchMaxDailyExecutions}
                      onChange={(e) => setForm((f) => ({ ...f, patchMaxDailyExecutions: e.target.value }))}
                      placeholder="empty = unchanged"
                    />
                  </label>
                  <label className="block text-xs text-zinc-400">
                    Cooldown (minutes)
                    <input
                      className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                      disabled={!form.includeAutonomousPatch}
                      inputMode="numeric"
                      value={form.patchCooldownMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, patchCooldownMinutes: e.target.value }))}
                      placeholder="empty = unchanged"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-amber-900/25 bg-amber-950/10 p-3 md:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                  Cadence automation apply (optional)
                </h3>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.includeCadenceAutomationApply}
                    onChange={(e) => setForm((f) => ({ ...f, includeCadenceAutomationApply: e.target.checked }))}
                  />
                  Prepare reviewed apply for automation policy (stale backlog / daily cadence)
                </label>
                <label className="block text-xs text-zinc-400">
                  Automation policy
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                    disabled={!form.includeCadenceAutomationApply}
                    value={form.cadenceAutomationPolicyId}
                    onChange={(e) => setForm((f) => ({ ...f, cadenceAutomationPolicyId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {automationPolicies
                      .filter((p) => p.policyType === "stale_backlog_cleanup" || p.policyType === "daily_cadence_run")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.policyType} ({p.id.slice(0, 8)}…)
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-xs text-zinc-400">
                  Stale draft days threshold (stored in policyConfigJson)
                  <input
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                    disabled={!form.includeCadenceAutomationApply}
                    inputMode="numeric"
                    value={form.staleDraftDaysForAutomation}
                    onChange={(e) => setForm((f) => ({ ...f, staleDraftDaysForAutomation: e.target.value }))}
                    placeholder="e.g. 21"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-cyan-900/25 bg-cyan-950/10 p-3 md:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
                  Notification policy apply (optional)
                </h3>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.includeNotificationApply}
                    onChange={(e) => setForm((f) => ({ ...f, includeNotificationApply: e.target.checked }))}
                  />
                  Prepare reviewed apply for notification routing policy
                </label>
                <label className="block text-xs text-zinc-400">
                  Notification policy
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                    disabled={!form.includeNotificationApply}
                    value={form.notificationPolicyId}
                    onChange={(e) => setForm((f) => ({ ...f, notificationPolicyId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {notificationPolicies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.eventType} · {p.minimumSeverity} ({p.id.slice(0, 8)}…)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-zinc-400">
                  Minimum severity (apply)
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
                    disabled={!form.includeNotificationApply}
                    value={form.notificationMinSeverityApply}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        notificationMinSeverityApply: e.target.value as PolicyWorkbenchFormState["notificationMinSeverityApply"],
                      }))
                    }
                  >
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
              </div>
            </div>
          ) : (
            <textarea
              className="min-h-[220px] w-full rounded-lg border border-white/10 bg-zinc-900/80 p-3 font-mono text-xs text-zinc-200"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              spellCheck={false}
            />
          )}

          <div className="rounded-lg border border-white/5 bg-black/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-500">Payload preview {previewBusy ? "(updating…)" : ""}</p>
              <button
                type="button"
                disabled={busy || signedOut}
                onClick={simulate}
                className="rounded-md bg-emerald-700/90 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                Run simulation now
              </button>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto text-[11px] text-zinc-500">{proposedPreview}</pre>
          </div>
        </section>

        {run ? (
          <section className="space-y-4 rounded-xl border border-cyan-900/40 bg-cyan-950/15 p-4">
            <h2 className="text-sm font-medium text-cyan-100">Delta preview (dry-run)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
                <p className="font-medium text-zinc-400">Comparison</p>
                <ul className="mt-2 space-y-1 text-zinc-300">
                  <li>Added auto actions: {cmp?.addedAutoActions ?? "—"}</li>
                  <li>Removed approvals (fewer approval steps): {cmp?.removedApprovals ?? "—"}</li>
                  <li>Added approvals: {cmp?.addedApprovals ?? "—"}</li>
                  <li>Notification delta: {cmp?.changedNotifications ?? "—"}</li>
                  <li>Queue heuristic delta: {cmp?.changedQueueStates ?? "—"}</li>
                </ul>
              </div>
              <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
                <p className="font-medium text-zinc-400">Risk & notes</p>
                <p className="mt-2 text-zinc-400">{run.deltaSummary ?? cmp?.summaryDelta ?? "—"}</p>
                {run.riskSummary?.riskFlags?.length ? (
                  <ul className="mt-2 list-disc pl-4 text-amber-200/90">
                    {run.riskSummary.riskFlags.slice(0, 6).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {run.notifications ? (
              <p className="text-xs text-zinc-500">
                Notifications: {run.notifications.eventsCurrent} → {run.notifications.eventsProposed} events (
                {run.notifications.droppedBySeverityFilter} dropped by severity filter)
              </p>
            ) : null}
            {run.cadence ? (
              <p className="text-xs text-zinc-500">
                Stale drafts eligible: {run.cadence.staleDraftsEligibleCurrent} → {run.cadence.staleDraftsEligibleProposed}{" "}
                · promote bypass count {run.cadence.promoteWithoutApprovalDelta ?? 0}
              </p>
            ) : null}
          </section>
        ) : null}

        {!signedOut ? <BentleyPolicyApplyReviewPanel sections={applyReviewSections} /> : null}

        <section className="flex flex-wrap gap-3">
          <input
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Scenario name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || signedOut}
            onClick={() => void saveScenario()}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Save scenario
          </button>
          <button
            type="button"
            disabled={busy || signedOut}
            onClick={() => void compareSaved()}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Compare saved scenarios
          </button>
          {saveOk ? <p className="w-full text-xs text-emerald-300">{saveOk}</p> : null}
          {lastSavedScenarioId && !signedOut ? (
            <p className="w-full text-xs text-zinc-500">
              <Link
                href={buildPolicyDeploymentsWorkbenchHref({
                  scenarioId: lastSavedScenarioId,
                  clientId: clientId.trim() || undefined,
                  trustId: trustId.trim() || undefined,
                })}
                className="text-emerald-300/90 underline-offset-4 hover:underline"
              >
                Open Policy Deployments with this scenario
              </Link>
            </p>
          ) : null}
        </section>

        {!signedOut && Array.isArray(scenarios) && scenarios.length > 0 ? (
          <section className="space-y-2 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4">
            <h2 className="text-sm font-medium text-emerald-100">Saved scenarios → coordinated deployment</h2>
            <p className="text-xs text-zinc-500">
              Prepare and save change sets server-side — does not apply live policies until you confirm on the deployments
              page.
            </p>
            <ul className="space-y-2">
              {(scenarios as Array<{ scenario: { id: string; name: string } }>).map(({ scenario }) => (
                <li
                  key={scenario.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">{scenario.name}</span>
                  <Link
                    href={buildPolicyDeploymentsWorkbenchHref({
                      scenarioId: scenario.id,
                      clientId: clientId.trim() || undefined,
                      trustId: trustId.trim() || undefined,
                    })}
                    className="text-xs text-emerald-300/90 underline-offset-4 hover:underline"
                  >
                    Policy deployments →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        {run ? (
          <section className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Full simulation payload (debug)</h2>
            <pre className="max-h-[280px] overflow-auto text-xs text-zinc-500">{JSON.stringify(run, null, 2)}</pre>
          </section>
        ) : null}

        {compareUi?.richMatrix ? (
          <section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Scenario comparison matrix</h2>
            <BentleyScenarioCompareMatrix payload={compareUi.richMatrix} />
            <details className="text-xs text-zinc-600">
              <summary className="cursor-pointer">Raw compare JSON</summary>
              <pre className="mt-2 max-h-[200px] overflow-auto">{JSON.stringify(compare, null, 2)}</pre>
            </details>
          </section>
        ) : null}
      </div>
    </div>
  );
}
