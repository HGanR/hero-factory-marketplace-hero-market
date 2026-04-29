"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";
import { ClientStatusBadge } from "@/components/client-hub/ClientStatusBadge";
import { ClientDeploymentMap } from "@/components/client-hub/ClientDeploymentMap";
import { ClientCommandQuickActions } from "@/components/client-hub/ClientCommandQuickActions";
import { ClientLinkedAgentsPanel } from "@/components/client-hub/ClientLinkedAgentsPanel";
import { ClientPortalStatusPanel } from "@/components/client-hub/ClientPortalStatusPanel";
import { ClientCrmAnalyticsPanel } from "@/components/client-hub/ClientCrmAnalyticsPanel";
import { ClientDomainConnectionsPanel } from "@/components/client-hub/ClientDomainConnectionsPanel";
import { ClientRequestsPreview } from "@/components/client-hub/ClientRequestsPreview";
import { ClientPerformanceChartGrid } from "@/components/client-hub/ClientPerformanceChartGrid";
import { ClientFunnelChart } from "@/components/client-hub/ClientFunnelChart";
import { ClientAgentPerformancePanel } from "@/components/client-hub/ClientAgentPerformancePanel";
import { ClientWebsitePerformancePanel } from "@/components/client-hub/ClientWebsitePerformancePanel";
import { deriveWeeklySeries } from "@/lib/revenue-os/client-performance-series";

export function ClientCommandCenterView({ data }: Props) {
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);
  const visitsApprox = Math.max(data.metrics.widgetMessages, data.metrics.conversations);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-500/90">Command Center</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{data.clientName}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded border border-white/10 bg-slate-950/50 px-2 py-0.5">Account</span>
          <ClientStatusBadge status={data.accountStatus} />
          <span className="rounded border border-white/10 bg-slate-950/50 px-2 py-0.5">Service</span>
          <ClientStatusBadge status={data.serviceStatus} />
          {data.servicePauseReason ? (
            <span className="text-rose-200/80" title={data.servicePauseReason}>
              ({data.servicePauseReason.slice(0, 48)}
              {data.servicePauseReason.length > 48 ? "…" : ""})
            </span>
          ) : null}
          <span className="ml-1 text-slate-500">·</span>
          <span>Portal: {data.portalSummary.label}</span>
          <span className="text-slate-500">·</span>
          <span>
            Last activity:{" "}
            {data.lastActivityAt ? new Date(data.lastActivityAt).toLocaleString() : "—"}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Active site</dt>
            <dd className="mt-1 text-slate-200">
              {data.primarySiteName ? (
                <>
                  {data.primarySiteName}
                  <span className="ml-2 text-xs text-slate-500">({data.primarySiteStatus})</span>
                </>
              ) : (
                <span className="text-slate-500">None linked</span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">AI agent</dt>
            <dd className="mt-1 text-slate-200">
              {data.primaryAgentName ?? <span className="text-slate-500">None bound</span>}
            </dd>
          </div>
          <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Pipeline</dt>
            <dd className="mt-1 text-xs leading-relaxed text-slate-400">
              {data.metrics.openConversations} open threads · {data.metrics.campaignsLaunched} launched campaigns ·{" "}
              {data.metrics.leadsCaptured} leads
            </dd>
          </div>
        </dl>
      </header>

      <ClientDeploymentMap deployment={data.deployment} />
      {data.conversionReadiness ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Conversion readiness</h2>
            <span className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100">
              {data.conversionReadiness.score}/100
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {data.conversionReadiness.missingItems.length === 0
              ? "Site is conversion-ready."
              : "Missing items and next-best actions are listed below."}
          </p>
          {data.conversionReadiness.missingItems.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {data.conversionReadiness.missingItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : null}
          {data.conversionReadiness.nextBestActions.length > 0 ? (
            <div className="mt-2 text-xs text-cyan-200">
              Next: {data.conversionReadiness.nextBestActions.slice(0, 2).join(" ")}
            </div>
          ) : null}
        </section>
      ) : null}
      <ClientDomainConnectionsPanel data={data} />
      <ClientCommandQuickActions data={data} onSaved={refresh} />
      <ClientLinkedAgentsPanel data={data} />
      <ClientPortalStatusPanel data={data} />
      <ClientCrmAnalyticsPanel data={data} />
      <ClientPerformanceChartGrid
        series={{
          leads: deriveWeeklySeries(data.metrics.leadsCaptured),
          conversations: deriveWeeklySeries(data.metrics.conversations),
          messages: deriveWeeklySeries(data.metrics.widgetMessages),
          bookings: deriveWeeklySeries(data.metrics.bookings),
        }}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <ClientFunnelChart
          visits={visitsApprox}
          conversations={data.metrics.conversations}
          leads={data.metrics.leadsCaptured}
          bookings={data.metrics.bookings}
        />
        <ClientAgentPerformancePanel
          responseVolume={data.metrics.crmMessages + data.metrics.widgetMessages}
          campaignActivity={data.metrics.campaignsLaunched + data.metrics.publishedPosts}
        />
        <ClientWebsitePerformancePanel websiteActivity={visitsApprox} activeSites={data.metrics.activeSites} />
      </div>
      <ClientRequestsPreview data={data} />
    </div>
  );
}

type Props = {
  data: ClientCommandCenterPayload;
};
