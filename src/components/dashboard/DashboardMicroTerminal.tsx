"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HolographicCard } from "@/components/dashboard/HolographicCard";
import { useUserMissionPathProgress } from "@/hooks/useUserMissionPathProgress";
import {
  DASHBOARD_MICRO_TERMINAL_STORAGE_KEY,
  DASHBOARD_MICRO_TERMINAL_UPDATED_EVENT,
  readMicroTerminalSnapshot,
  type DashboardMicroTerminalSnapshot,
} from "@/lib/dashboard/micro-terminal-storage";
import { MissionPathProgressRing } from "@/components/dashboard/mission-path/MissionPathProgressRing";
import {
  SMART_TRUST_PLATFORM_BINDING_KEY,
  SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT,
  loadSmartTrustPlatformBinding,
} from "@/lib/smart-trust-platform-binding";

type ApiClient = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  existingEntityName: string | null;
  logoUrl: string | null;
  requestedServices: string[];
};

/**
 * Single dashboard strip above the profile banner: reflects the **workspace binding**
 * (client + trust from the header selector), with mission-path progress when the API responds.
 */
export function DashboardMicroTerminal() {
  const { data: mission, isLoading: missionLoading, isError: missionError } = useUserMissionPathProgress();
  const [missionStalled, setMissionStalled] = useState(false);

  const [bindingClientId, setBindingClientId] = useState<string | null>(null);
  const [bindingTrustId, setBindingTrustId] = useState<string | null>(null);
  const [snap, setSnap] = useState<DashboardMicroTerminalSnapshot | null>(null);

  const [apiClient, setApiClient] = useState<ApiClient | null>(null);
  const [apiClientStatus, setApiClientStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const [agentAvatarUrl, setAgentAvatarUrl] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (missionLoading && !mission) setMissionStalled(true);
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [missionLoading, mission]);

  useEffect(() => {
    if (!missionLoading && mission) setMissionStalled(false);
  }, [missionLoading, mission]);

  useEffect(() => {
    const loadSnap = () => setSnap(readMicroTerminalSnapshot());
    loadSnap();
    const onStorage = (e: StorageEvent) => {
      if (e.key === DASHBOARD_MICRO_TERMINAL_STORAGE_KEY || e.key === null) loadSnap();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DASHBOARD_MICRO_TERMINAL_UPDATED_EVENT, loadSnap);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DASHBOARD_MICRO_TERMINAL_UPDATED_EVENT, loadSnap);
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const b = loadSmartTrustPlatformBinding();
      setBindingClientId(b.clientId ?? null);
      setBindingTrustId(b.trustId ?? null);
    };
    sync();
    window.addEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === SMART_TRUST_PLATFORM_BINDING_KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const cid = bindingClientId?.trim() || "";
    if (!cid) {
      setApiClient(null);
      setApiClientStatus("idle");
      return;
    }
    let cancelled = false;
    setApiClientStatus("loading");
    fetch(`/api/clients/${encodeURIComponent(cid)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        return res.json() as Promise<{ client?: ApiClient }>;
      })
      .then((data) => {
        if (cancelled) return;
        const c = data?.client;
        if (!c?.id) {
          setApiClient(null);
          setApiClientStatus("error");
          return;
        }
        setApiClient({
          id: c.id,
          firstName: c.firstName,
          middleName: c.middleName ?? null,
          lastName: c.lastName,
          existingEntityName: c.existingEntityName ?? null,
          logoUrl: c.logoUrl ?? null,
          requestedServices: Array.isArray(c.requestedServices) ? c.requestedServices : [],
        });
        setApiClientStatus("ok");
      })
      .catch(() => {
        if (!cancelled) {
          setApiClient(null);
          setApiClientStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bindingClientId]);

  useEffect(() => {
    let cancelled = false;
    const tid = bindingTrustId?.trim() || "";
    if (!tid) {
      setAgentAvatarUrl(null);
      setAgentName(null);
      setWorkspaceName(null);
      return;
    }
    (async () => {
      try {
        const wsRes = await fetch("/api/trust-records/workspaces", { credentials: "include" });
        if (!wsRes.ok) return;
        const data = (await wsRes.json().catch(() => ({}))) as {
          workspaces?: Array<{
            id: string;
            name?: string | null;
            agentAvatarImageUrl?: string | null;
            agentName?: string | null;
          }>;
        };
        const list = Array.isArray(data.workspaces) ? data.workspaces : [];
        const match = list.find((w) => w.id === tid);
        if (cancelled) return;
        setWorkspaceName(typeof match?.name === "string" ? match.name : null);
        setAgentAvatarUrl(typeof match?.agentAvatarImageUrl === "string" ? match.agentAvatarImageUrl : null);
        setAgentName(typeof match?.agentName === "string" ? match.agentName : null);
      } catch {
        if (!cancelled) {
          setAgentAvatarUrl(null);
          setAgentName(null);
          setWorkspaceName(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bindingTrustId]);

  const personLine = useMemo(() => {
    if (apiClient) {
      return [apiClient.firstName, apiClient.middleName, apiClient.lastName].filter(Boolean).join(" ").trim();
    }
    if (snap?.personDisplayName) return snap.personDisplayName;
    return "";
  }, [apiClient, snap]);

  const headline = useMemo(() => {
    if (apiClient?.existingEntityName?.trim()) return apiClient.existingEntityName.trim();
    if (snap?.entityName?.trim()) return snap.entityName.trim();
    if (workspaceName?.trim()) return workspaceName.trim();
    if (personLine) return personLine;
    return "Client workspace";
  }, [apiClient, snap, workspaceName, personLine]);

  const logoSrc = apiClient?.logoUrl || snap?.clientLogoDataUrl || null;
  const services = apiClient?.requestedServices?.length
    ? apiClient.requestedServices
    : snap?.requestedServices ?? [];

  const percent = mission?.percent ?? 0;
  const missionReady = !missionLoading && !!mission;
  const missionLabel = missionError
    ? "Mission path unavailable (check session / database)."
    : missionStalled && missionLoading
      ? "Mission path still loading — if this persists, the server may be waiting on the database."
      : mission?.allComplete
        ? "Mission path complete"
        : mission?.continue?.label ?? (missionReady ? "Continue onboarding" : "Loading…");

  const idLine =
    bindingClientId || snap?.clientId
      ? `Client ${(bindingClientId || snap?.clientId || "").slice(0, 8)}…${
          bindingTrustId ? ` · Workspace ${bindingTrustId.slice(0, 8)}…` : ""
        }`
      : "Select a workspace in the header to bind a client record.";

  return (
    <HolographicCard accent="cyan" className="p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="h-12 w-12 overflow-hidden rounded-full border border-cyan-400/40 bg-slate-900/80"
              title="Client logo"
            >
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] font-bold text-cyan-200/90">LOGO</div>
              )}
            </div>
            <div
              className="h-11 w-11 overflow-hidden rounded-full border border-violet-400/40 bg-slate-900/80"
              title={agentName ? `AI: ${agentName}` : "AI agent"}
            >
              {agentAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agentAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] font-bold text-violet-200/90">AI</div>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/85">Micro Terminal</p>
            <h2 className="truncate text-base font-bold text-white md:text-lg">{headline}</h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{idLine}</p>
            {personLine && headline !== personLine ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">Contact: {personLine}</p>
            ) : null}
            {snap?.logoTruncated && !apiClient?.logoUrl ? (
              <p className="mt-1 text-[11px] text-amber-200/90">Local preview: logo was large; full logo loads from the server when the client saves.</p>
            ) : null}
            {apiClientStatus === "error" && bindingClientId ? (
              <p className="mt-1 text-[11px] text-amber-200/90">Could not load client from API (permissions or DB).</p>
            ) : null}
            {services.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Requested services">
                {services.map((s) => (
                  <li
                    key={s}
                    className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100/95"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <Link href="/clients/new" className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline">
                New client
              </Link>
              <span className="text-slate-600">·</span>
              <Link href="/trust-records" className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline">
                Trust workspace
              </Link>
              <span className="text-slate-600">·</span>
              <Link href="/site-builder" className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline">
                Site builder
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-white/10 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <MissionPathProgressRing
            percent={percent}
            aria-label={
              missionError || missionStalled
                ? "Mission path unavailable or stalled"
                : `Mission path ${percent} percent`
            }
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI path progress</p>
            <p className="text-sm font-semibold text-slate-100">{missionLabel}</p>
            {mission && missionReady ? (
              <ol className="mt-2 grid gap-1 text-[11px] text-slate-400">
                {mission.steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2">
                    <span className={step.done ? "text-emerald-400" : "text-slate-500"}>{step.done ? "✓" : "○"}</span>
                    <span className={step.done ? "text-slate-200" : ""}>{step.shortLabel}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </div>
    </HolographicCard>
  );
}
