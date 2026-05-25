"use client";

import { useCallback, useEffect, useState } from "react";

type TestPayload = {
  connected?: boolean;
  configured?: boolean;
  probePath?: string;
  account?: Record<string, unknown>;
  providerStatus?: string;
  error?: string;
  code?: string;
  httpStatus?: number;
  message?: string;
};

type PanelPayload = {
  schedulerHealth?: {
    content360EnabledFlag?: boolean;
    revenueOsEnv?: unknown;
    platformApiKeyConfigured?: boolean;
  };
  providerJobs?: {
    last24hPublished: number;
    last24hFailed: number;
    lastJobStatus: string | null;
    lastJobUpdatedAt: string | null;
  } | null;
  availablePlatforms?: string[];
  apiHealth?: string;
};

const cred = { credentials: "include" as const };

export function Content360ConnectionCard() {
  const [test, setTest] = useState<TestPayload | null>(null);
  const [panel, setPanel] = useState<PanelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [tRes, pRes] = await Promise.all([
        fetch("/api/admin/content360/test", { ...cred, cache: "no-store" }),
        fetch("/api/admin/content360/panel", { ...cred, cache: "no-store" }),
      ]);
      const tJson = (await tRes.json().catch(() => ({}))) as TestPayload;
      const pJson = (await pRes.json().catch(() => ({}))) as PanelPayload;
      if (tRes.status === 401 || tRes.status === 403) {
        setErr(tJson.error || "Admin session required.");
        setTest(null);
        setPanel(null);
        return;
      }
      if (pRes.status === 401 || pRes.status === 403) {
        setErr((pJson as { error?: string }).error || "Admin session required.");
        setTest(null);
        setPanel(null);
        return;
      }
      setTest(tJson);
      setPanel(pJson);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load Content360 status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mb-8 rounded-xl border border-slate-700/80 bg-slate-900/60 p-5 text-left shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Content360 (platform)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Admin-only connection to the centralized Content360 API. No API keys are shown in the browser.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-lg border border-cyan-600/50 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-900/50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <p className="mt-3 text-sm text-amber-200">{err}</p>
      ) : null}

      {!err && (
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Live probe</div>
            {loading && !test ? (
              <p className="mt-2 text-slate-400">Loading…</p>
            ) : (
              <>
                <p className="mt-2 text-slate-200">
                  Status:{" "}
                  <span className={test?.connected ? "text-emerald-400" : "text-amber-300"}>
                    {test?.connected ? "Connected" : test?.configured === false ? "Not configured" : "Not connected"}
                  </span>
                </p>
                {test?.probePath ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Probe: <code className="text-slate-400">{test.probePath}</code>
                  </p>
                ) : null}
                {test?.providerStatus ? (
                  <p className="mt-1 text-xs text-slate-400">Provider: {test.providerStatus}</p>
                ) : null}
                {test?.account && Object.keys(test.account).length > 0 ? (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-950/80 p-2 text-[11px] text-slate-300">
                    {JSON.stringify(test.account, null, 2)}
                  </pre>
                ) : null}
                {test?.error ? <p className="mt-2 text-xs text-red-300">{test.error}</p> : null}
              </>
            )}
          </div>

          <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Scheduler & jobs</div>
            {loading && !panel ? (
              <p className="mt-2 text-slate-400">Loading…</p>
            ) : (
              <>
                <p className="mt-2 text-slate-200">
                  API credentials:{" "}
                  <span
                    className={
                      panel?.schedulerHealth?.platformApiKeyConfigured ? "text-emerald-400" : "text-amber-300"
                    }
                  >
                    {panel?.schedulerHealth?.platformApiKeyConfigured ? "Present (server)" : "Missing"}
                  </span>
                </p>
                <p className="mt-1 text-slate-300">
                  CONTENT360_ENABLED:{" "}
                  <span className="text-slate-400">
                    {panel?.schedulerHealth?.content360EnabledFlag ? "true" : "false / unset"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">API health: {panel?.apiHealth ?? "—"}</p>
                {panel?.providerJobs ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    <li>Published (24h): {panel.providerJobs.last24hPublished}</li>
                    <li>Failed (24h): {panel.providerJobs.last24hFailed}</li>
                    <li>Last job: {panel.providerJobs.lastJobStatus ?? "—"}</li>
                    <li>Last update: {panel.providerJobs.lastJobUpdatedAt ?? "—"}</li>
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Job stats unavailable (DB).</p>
                )}
                {panel?.availablePlatforms?.length ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Platforms: {panel.availablePlatforms.join(", ")}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
