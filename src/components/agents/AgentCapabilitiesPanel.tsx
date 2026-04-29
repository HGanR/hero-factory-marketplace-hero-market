"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, CheckCircle2, Loader2, Mail, Shield, Sparkles, HardDrive } from "lucide-react";
import type { AgentCapabilitiesGetResponse } from "@/lib/agent-plugins/capabilities-api";
import { AGENT_BUILDER_TEST_USER_MESSAGE } from "@/lib/agent-plugins/write-confirmation-context";

type Props = {
  agentId: string | null;
};

function pluginIcon(pluginKey: string) {
  if (pluginKey.includes("calendar")) return Calendar;
  if (pluginKey.includes("gmail")) return Mail;
  if (pluginKey.includes("drive")) return HardDrive;
  return Sparkles;
}

export function AgentCapabilitiesPanel({ agentId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AgentCapabilitiesGetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runErrorCode, setRunErrorCode] = useState<string | null>(null);

  const returnTo = useMemo(() => {
    const path = pathname ?? "/app/agents";
    const q = searchParams?.toString();
    return q ? `${path}?${q}` : path;
  }, [pathname, searchParams]);

  const load = useCallback(async () => {
    if (!agentId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/capabilities`, {
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j?.error === "string" ? j.error : "Failed to load capabilities");
        setData(null);
        return;
      }
      setData(j as AgentCapabilitiesGetResponse);
    } catch {
      setError("Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const googleConnected = searchParams?.get("google_connected") === "1";
  useEffect(() => {
    if (googleConnected && agentId) void load();
  }, [googleConnected, agentId, load]);

  async function setPluginEnabled(pluginKey: string, enabled: boolean) {
    if (!agentId) return;
    setToggling(pluginKey);
    setError(null);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/capabilities`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginKey, enabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j?.error === "string" ? j.error : "Update failed");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setToggling(null);
    }
  }

  function startGoogleAuth() {
    if (!agentId) return;
    const qs = new URLSearchParams();
    qs.set("agentId", agentId);
    qs.set("returnTo", returnTo);
    window.location.href = `/api/agent-plugins/oauth/google/start?${qs.toString()}`;
  }

  function defaultInputForAction(actionKey: string): unknown {
    if (actionKey === "gmail.createDraft") {
      return {
        subject: "Agent draft (test)",
        bodyText: "This is a draft created from the agent builder. It is not sent.",
        confirmed: true,
      };
    }
    if (actionKey === "calendar.createEvent") {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return {
        summary: "Test event (agent builder)",
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        timeZone: "UTC",
        confirmed: true,
      };
    }
    return {};
  }

  async function runAction(actionKey: string) {
    if (!agentId) return;
    setRunningAction(actionKey);
    setRunError(null);
    setRunErrorCode(null);
    setRunResult(null);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/capabilities/execute`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionKey,
          input: defaultInputForAction(actionKey),
          conversation: {
            priorMessages: [],
            userMessage: AGENT_BUILDER_TEST_USER_MESSAGE,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRunError(typeof j?.error === "string" ? j.error : "Run failed");
        setRunErrorCode(typeof j?.code === "string" ? j.code : null);
        return;
      }
      setRunResult((j?.result ?? j) as Record<string, unknown>);
    } catch {
      setRunError("Network error");
    } finally {
      setRunningAction(null);
    }
  }

  if (!agentId) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
        Select an agent to configure what it can do with Google (Calendar, Gmail, Drive).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2">
          <Sparkles className="h-5 w-5 text-cyan-300" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Capabilities</div>
          <p className="mt-1 text-xs text-white/55 leading-relaxed">
            Enable Google tools per agent, then authorize once. Each row is a concrete read or write action (not a vague
            “connection”). If Google adds required scopes later, use <span className="text-white/70">Authorize Google</span>{" "}
            again to grant them.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-amber-300/90 shrink-0" aria-hidden />
            <span className="text-white/80">Google Workspace authorization</span>
          </div>
          {data?.providerAuthorized ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Authorized — tools can run when enabled below
            </span>
          ) : (
            <button
              type="button"
              onClick={startGoogleAuth}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25"
            >
              Authorize Google
            </button>
          )}
        </div>
        {!data?.providerAuthorized && (
          <p className="text-xs text-white/45">
            OAuth uses <code className="text-white/60">/api/agent-plugins/oauth/google/…</code> (agent-scoped), separate
            from other product OAuth flows.
          </p>
        )}
        {data?.lastErrorHint || data?.lastError ? (
          <p className="text-xs text-amber-200/90">
            {data.lastErrorHint ?? `Last token error: ${data.lastError}`}
          </p>
        ) : null}
        {data?.gating?.reconnectSuggested ? (
          <p className="text-xs text-cyan-200/80">
            Re-authorize: click <span className="text-cyan-100/90">Authorize Google</span> to refresh tokens or grant
            missing scopes.
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading capabilities…
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      {data?.plugins.map((p) => {
        const Icon = pluginIcon(p.pluginKey);
        const busy = toggling === p.pluginKey;
        return (
          <div
            key={p.pluginKey}
            className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-lg border border-white/10 bg-black/30 p-2 shrink-0">
                  <Icon className="h-5 w-5 text-cyan-300/90" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{p.displayName}</div>
                  <p className="mt-1 text-xs text-white/55 leading-relaxed">{p.purpose}</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-white/70 shrink-0 cursor-pointer">
                <span>Allow for this agent</span>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  disabled={busy}
                  onChange={(e) => setPluginEnabled(p.pluginKey, e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/40"
                />
              </label>
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
              <p className="text-[10px] text-white/40 leading-snug">
                Run test uses sample inputs. Full flows require chat with conversation history.
              </p>
              <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">What the agent can do</div>
              <ul className="space-y-2">
                {p.actions.map((a) => (
                  <li
                    key={a.actionKey}
                    className="rounded-lg border border-white/8 bg-black/25 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-white/90">{a.displayName}</div>
                        <div className="text-white/50 mt-0.5">{a.description}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-white/35">{a.actionKey}</span>
                          <span
                            className={
                              a.kind === "write"
                                ? "text-[10px] rounded border border-amber-500/40 px-1.5 py-0.5 text-amber-200/90"
                                : "text-[10px] rounded border border-white/15 px-1.5 py-0.5 text-white/45"
                            }
                          >
                            {a.kind === "write" ? "Write" : "Read"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {a.executable ? (
                          <span className="text-emerald-400/90">Ready to run</span>
                        ) : (
                          <span className="text-white/40">
                            {!data.providerAuthorized
                              ? "Authorize Google"
                              : !p.enabled
                                ? "Enable capability above"
                                : "Missing scope"}
                          </span>
                        )}
                        {a.executable ? (
                          <button
                            type="button"
                            disabled={runningAction === a.actionKey}
                            onClick={() => runAction(a.actionKey)}
                            className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-50"
                          >
                            {runningAction === a.actionKey ? "Running…" : "Run test"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}

      {runError ? (
        <div className="text-xs text-red-300">
          {runError}
          {runErrorCode ? <span className="text-white/40"> ({runErrorCode})</span> : null}
        </div>
      ) : null}
      {runResult ? (
        <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/70">
          {JSON.stringify(runResult, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
