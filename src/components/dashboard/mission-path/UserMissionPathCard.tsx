"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { HolographicCard } from "../HolographicCard";
import { useUserMissionPathProgress } from "@/hooks/useUserMissionPathProgress";
import { MissionPathProgressRing } from "./MissionPathProgressRing";
import { MissionPathTimeline } from "./MissionPathTimeline";
import {
  SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT,
  loadSmartTrustPlatformBinding,
} from "@/lib/smart-trust-platform-binding";

const PRIMARY_RAIL: Array<{ label: string; href: string; id: string }> = [
  { id: "site", label: "Build Website", href: "/site-builder" },
  { id: "agent", label: "Create AI Agent", href: "/app/agents" },
  { id: "campaign", label: "Launch Campaign", href: "/revenue-os/dashboard" },
  { id: "hub", label: "Open Client Hub", href: "/ai-revenue-os/clients" },
];

export function UserMissionPathCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useUserMissionPathProgress();
  const [bindingTrustId, setBindingTrustId] = useState<string | null>(null);
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    id: string;
    name: string;
    clientId: string | null;
    clientName: string | null;
    logoUrl: string | null;
    agentName: string | null;
    agentAvatarImageUrl: string | null;
    requestedServices: string[];
  } | null>(null);
  const [summary, setSummary] = useState<{
    metrics?: {
      websiteVisits?: number | null;
      activeSites?: number;
      activeAgents?: number;
      agentInteractions?: number;
    };
  } | null>(null);

  useEffect(() => {
    const syncBinding = () => {
      const b = loadSmartTrustPlatformBinding();
      setBindingTrustId(b.trustId ?? null);
    };
    syncBinding();
    window.addEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, syncBinding);
    window.addEventListener("storage", syncBinding);
    return () => {
      window.removeEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, syncBinding);
      window.removeEventListener("storage", syncBinding);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const wsRes = await fetch("/api/trust-records/workspaces", { credentials: "include" });
        if (!wsRes.ok) return;
        const ws = (await wsRes.json().catch(() => ({}))) as {
          workspaces?: Array<{
            id: string;
            name?: string | null;
            clientId?: string | null;
            clientName?: string | null;
            logoUrl?: string | null;
            agentName?: string | null;
            agentAvatarImageUrl?: string | null;
            requestedServices?: string[];
          }>;
        };
        const list = Array.isArray(ws.workspaces) ? ws.workspaces : [];
        const match = list.find((w) => w.id === bindingTrustId) ?? null;
        if (!cancelled) {
          setWorkspaceInfo(
            match
              ? {
                  id: match.id,
                  name: match.name?.trim() || "Untitled Workspace",
                  clientId: match.clientId ?? null,
                  clientName: match.clientName ?? null,
                  logoUrl: match.logoUrl ?? null,
                  agentName: typeof match.agentName === "string" ? match.agentName : null,
                  agentAvatarImageUrl: typeof match.agentAvatarImageUrl === "string" ? match.agentAvatarImageUrl : null,
                  requestedServices: Array.isArray(match.requestedServices) ? match.requestedServices : [],
                }
              : null,
          );
        }
        if (!match?.clientId) {
          if (!cancelled) setSummary(null);
          return;
        }
        const sumRes = await fetch(`/api/revenue-os/clients/${encodeURIComponent(match.clientId)}/summary`, {
          credentials: "include",
        });
        if (!sumRes.ok) return;
        const sum = (await sumRes.json().catch(() => ({}))) as { summary?: { metrics?: any } };
        if (!cancelled) setSummary(sum.summary ?? null);
      } catch {
        if (!cancelled) {
          setWorkspaceInfo(null);
          setSummary(null);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [bindingTrustId]);

  if (isLoading) {
    return (
      <HolographicCard accent="both" className="p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="flex flex-col md:flex-row gap-8">
          <div className="h-32 w-32 rounded-full bg-white/5" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-full bg-white/10 rounded" />
            <div className="h-4 w-3/4 bg-white/10 rounded" />
            <div className="h-4 w-5/6 bg-white/10 rounded" />
          </div>
        </div>
      </HolographicCard>
    );
  }

  if (isError || !data) {
    return (
      <HolographicCard accent="both" className="p-6">
        <h2 className="text-lg font-semibold text-cyan-100 mb-2">Your Mission Path</h2>
        <p className="text-sm text-slate-400 mb-3">
          {isError
            ? error?.message || "Could not load mission progress. Sign in with the same account in your browser, then retry."
            : "No data."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 border border-white/15 hover:border-cyan-500/40"
        >
          Retry
        </button>
      </HolographicCard>
    );
  }

  const cta = data.continue;
  const allDone = data.allComplete;
  const trafficNow = Number(summary?.metrics?.websiteVisits ?? 0);
  const trafficMax = Math.max(100, trafficNow || 0);
  const trafficBar = Math.min(100, Math.round((trafficNow / trafficMax) * 100));
  const entityName = workspaceInfo?.name || workspaceInfo?.clientName || "No workspace selected";
  const logoUrl = workspaceInfo?.logoUrl;
  const serviceList = workspaceInfo?.requestedServices ?? [];
  const agentAvatarUrl = workspaceInfo?.agentAvatarImageUrl ?? null;
  const agentLabel = workspaceInfo?.agentName || "AI";
  const hasWorkspaceSelection = Boolean(workspaceInfo?.id);
  const activeSites = Number(summary?.metrics?.activeSites ?? 0);
  const activeAgents = Number(summary?.metrics?.activeAgents ?? 0);
  const agentInteractions = Number(summary?.metrics?.agentInteractions ?? 0);

  return (
    <HolographicCard accent="both" className="p-0 overflow-hidden">
      <div className="p-6 md:p-8">
        <div className="mb-6 rounded-2xl border border-cyan-500/25 bg-slate-950/40 p-4">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-cyan-400/45 bg-slate-900/80" title="Business logo">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={`${entityName} logo`} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-semibold text-cyan-200">MP</div>
                )}
              </div>
              <div className="h-12 w-12 overflow-hidden rounded-full border border-violet-400/45 bg-slate-900/80" title="AI agent avatar">
                {agentAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agentAvatarUrl} alt={`${agentLabel} avatar`} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[11px] font-semibold text-violet-200">AI</div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Mission path</p>
              <h3 className="truncate text-xl font-bold text-white">{entityName}</h3>
              <p className="mt-1 text-xs text-slate-400">
                Workspace view: {workspaceInfo?.id ? `${workspaceInfo.id.slice(0, 8)}...` : "Select a workspace above"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <MetricChip label="Website status" value={(summary?.metrics?.activeSites ?? 0) > 0 ? "Live" : "Not live"} />
            <MetricChip label="AI agents" value={String(summary?.metrics?.activeAgents ?? 0)} />
            <MetricChip label="AI interactions" value={String(summary?.metrics?.agentInteractions ?? 0)} />
            <MetricChip label="NFT line" value={(serviceList.includes("NFT Line") ? "Enabled" : "Not selected")} />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Website traffic</span>
              <span>{trafficNow}</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                style={{ width: `${trafficBar}%` }}
              />
            </div>
          </div>
          {serviceList.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {serviceList.map((service) => (
                <span
                  key={service}
                  className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100"
                >
                  {service}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-4 rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3 font-mono">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">
              <span>Macro Terminal HUD</span>
              <span>{hasWorkspaceSelection ? "Linked" : "Idle"}</span>
            </div>
            {hasWorkspaceSelection ? (
              <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">client</span>
                  <span className="text-cyan-200">{workspaceInfo?.clientName || entityName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">workspace</span>
                  <span>{workspaceInfo?.id?.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">site_status</span>
                  <span>{activeSites > 0 ? "live" : "not_live"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">agents_online</span>
                  <span>{activeAgents}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ai_interactions</span>
                  <span>{agentInteractions}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                    style={{ width: `${trafficBar}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                Select a workspace above to render client summary telemetry in this HUD panel.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0">
            <MissionPathProgressRing
              percent={data.percent}
              aria-label={`Mission path ${data.doneCount} of ${data.totalSteps} steps complete`}
            />
            <div className="text-center sm:text-left min-w-0">
              <h2 className="text-xl font-bold text-white tracking-tight" id="user-mission-path-title">
                Your Mission Path
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Personal command center — progress from your account data (not client work).
              </p>
              <p className="text-xs text-slate-500 mt-2 font-mono">
                {allDone
                  ? "All milestones complete"
                  : `${data.doneCount} / ${data.totalSteps} complete`}
                {isFetching && !isLoading ? <span className="ml-2 text-cyan-500/80">· updating…</span> : null}
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0 max-w-lg">
            <MissionPathTimeline steps={data.steps} />
          </div>
        </div>

        <div
          className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3"
          role="group"
          aria-label="Primary actions"
        >
          {PRIMARY_RAIL.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="inline-flex justify-center sm:justify-start items-center px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-cyan-500/20 to-violet-500/15 border border-cyan-500/30
                text-cyan-100 hover:from-cyan-500/30 hover:to-violet-500/25 transition-colors
                focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            >
              {a.label}
            </Link>
          ))}
        </div>

        {cta && !allDone && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Continue setup
            </div>
            <Link
              href={cta.href}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[#0a0e1a] transition-transform hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #00D1FF 0%, #7c3aed 100%)",
                boxShadow: "0 0 24px rgba(0,209,255,0.25)",
              }}
            >
              {cta.label}
            </Link>
            <p className="text-xs text-slate-500 mt-2" aria-live="polite">
              Next step: {data.steps.find((s) => s.id === cta.stepId)?.title ?? cta.label}
            </p>
          </div>
        )}

        {allDone && (
          <div className="mt-6 pt-6 border-t border-white/10 text-sm text-cyan-200/90">
            You have completed the core Mission Path. Keep using the tools below to run your revenue system.
          </div>
        )}
      </div>
    </HolographicCard>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
