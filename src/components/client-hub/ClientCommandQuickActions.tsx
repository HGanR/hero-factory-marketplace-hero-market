"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientHubRefreshIntelligenceControl } from "@/components/client-hub/ClientHubRefreshIntelligenceControl";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";

export type QuickActionLinks = {
  siteBuilderHref: string;
  agentControlHref: string | null;
  portalHref: string;
  inboxHref: string;
};

export function buildClientQuickActionLinks(data: ClientCommandCenterPayload): QuickActionLinks {
  return {
    siteBuilderHref:
      data.primarySiteId != null
        ? `/site-builder?siteId=${encodeURIComponent(data.primarySiteId)}&clientId=${encodeURIComponent(data.clientId)}`
        : `/site-builder?clientId=${encodeURIComponent(data.clientId)}`,
    agentControlHref: data.primaryAgentId ? `/app/agents/${encodeURIComponent(data.primaryAgentId)}/control` : null,
    portalHref: `/ai-revenue-os/clients/${encodeURIComponent(data.clientId)}/portal`,
    inboxHref: `/ai-revenue-os/clients/${encodeURIComponent(data.clientId)}/inbox`,
  };
}

export function ClientCommandQuickActions({ data, onSaved }: { data: ClientCommandCenterPayload; onSaved?: () => void }) {
  const links = buildClientQuickActionLinks(data);
  const [svcBusy, setSvcBusy] = useState(false);
  const [svcErr, setSvcErr] = useState<string | null>(null);

  const pauseOrResume = async (mode: "pause" | "resume") => {
    setSvcBusy(true);
    setSvcErr(null);
    try {
      const url =
        mode === "pause"
          ? `/api/revenue-os/clients/${encodeURIComponent(data.clientId)}/service/pause`
          : `/api/revenue-os/clients/${encodeURIComponent(data.clientId)}/service/resume`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: mode === "pause" ? JSON.stringify({ reason: "Paused from Client Command Center" }) : "{}",
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setSvcErr(j.error || "Request failed");
        return;
      }
      onSaved?.();
    } catch (e) {
      setSvcErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSvcBusy(false);
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-cyan-200/90">Quick actions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={links.siteBuilderHref} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20">
          Open Site Builder
        </Link>
        {links.agentControlHref ? (
          <Link href={links.agentControlHref} className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/20">
            Open Agent Control Panel
          </Link>
        ) : null}
        <Link href={links.portalHref} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/30">
          Invite Client
        </Link>
        <Link href={links.portalHref} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/30">
          Open Client Portal Access page
        </Link>
        <Link href={links.inboxHref} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/30">
          View Conversations
        </Link>
        <button
          type="button"
          disabled={svcBusy || data.widgetServicePaused}
          onClick={() => void pauseOrResume("pause")}
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
        >
          Pause Service
        </button>
        <button
          type="button"
          disabled={svcBusy || !data.widgetServicePaused}
          onClick={() => void pauseOrResume("resume")}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          Resume Service
        </button>
      </div>
      {svcErr ? <p className="mt-2 text-xs text-rose-300">{svcErr}</p> : null}
      <div className="mt-4">
        <ClientHubRefreshIntelligenceControl clientId={data.clientId} />
      </div>
    </section>
  );
}
