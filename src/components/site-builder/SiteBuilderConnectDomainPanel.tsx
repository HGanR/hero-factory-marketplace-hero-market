"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RequiredRecordsPayloadSchema } from "@/lib/site-builder/domain-connection-shared";
import type { SiteDomainConnectionRow } from "@/lib/site-builder/site-domain-connections-repository";

type DomainType = "web2" | "freename_web3" | "other_web3";
type DomainProvider = "freename" | "vercel" | "external";
type DeploymentTarget = "vercel_deployment_url" | "vercel_custom_domain" | "static_export_url";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

type Props = {
  siteId: string | null;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
};

export function SiteBuilderConnectDomainPanel({ siteId, onNotice, onError }: Props) {
  const [connection, setConnection] = useState<SiteDomainConnectionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState("");
  const [domainType, setDomainType] = useState<DomainType>("freename_web3");
  const [provider, setProvider] = useState<DomainProvider>("freename");
  const [deploymentTarget, setDeploymentTarget] = useState<DeploymentTarget>("vercel_deployment_url");
  const [targetUrl, setTargetUrl] = useState("https://");

  const load = useCallback(async () => {
    if (!siteId) return;
    onError(null);
    try {
      const data = await jsonFetch<{ connection: SiteDomainConnectionRow | null }>(
        `/api/site-builder/sites/${encodeURIComponent(siteId)}/domains`,
      );
      const c = data.connection;
      setConnection(c);
      if (c) {
        setDomain(c.domain);
        setDomainType(c.domainType);
        setProvider(c.domainType === "web2" ? (c.provider === "vercel" ? "vercel" : "external") : "freename");
        setTargetUrl(c.targetUrl);
        if (c.vercelDeploymentUrl?.includes("static")) {
          setDeploymentTarget("static_export_url");
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load domain connection");
    }
  }, [siteId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const instructions = useMemo(() => {
    if (!connection?.requiredRecordsJson) return null;
    try {
      const p = RequiredRecordsPayloadSchema.safeParse(JSON.parse(connection.requiredRecordsJson));
      return p.success ? p.data : null;
    } catch {
      return null;
    }
  }, [connection?.requiredRecordsJson]);

  const save = async () => {
    if (!siteId) {
      onError("Select or create a site first.");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const prov: DomainProvider =
        domainType === "freename_web3" || domainType === "other_web3" ? "freename" : provider;
      const data = await jsonFetch<{ connection: SiteDomainConnectionRow }>(`/api/site-builder/sites/${encodeURIComponent(siteId)}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          domainType,
          provider: prov,
          deploymentTarget,
          targetUrl,
        }),
      });
      setConnection(data.connection);
      onNotice("Domain connection saved. Follow DNS / Web3 steps, then re-check.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const recheck = async (manualConfirm: boolean) => {
    if (!siteId) return;
    setBusy(true);
    onError(null);
    try {
      const res = await jsonFetch<{
        detail: string;
        connection: SiteDomainConnectionRow;
        nextConnectionStatus: string;
      }>(`/api/site-builder/sites/${encodeURIComponent(siteId)}/domains/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualConfirm }),
      });
      setConnection(res.connection);
      onNotice(
        res.nextConnectionStatus === "connected"
          ? "Domain looks connected. Publish traffic may still need a few minutes to propagate."
          : res.detail,
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Re-check failed");
    } finally {
      setBusy(false);
    }
  };

  const copyText = (label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    onNotice(`Copied ${label} to clipboard.`);
  }

  if (!siteId) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
        Save your project to a site to connect a domain.
      </div>
    );
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-lg border border-cyan-900/40 bg-slate-950/50 px-3 py-3">
      <div>
        <div className="text-sm font-semibold text-cyan-200/90">Connect Domain</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Point a Freename / Web3 or traditional domain at your Vercel or static deploy. Vercel API calls run only on
          the server when tokens are configured — secrets never ship to the browser.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-slate-400">
          Domain
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="brand.com or project.crypto"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          Domain type
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={domainType}
            onChange={(e) => setDomainType(e.target.value as DomainType)}
          >
            <option value="freename_web3">Freename Web3</option>
            <option value="web2">Traditional DNS (Web2)</option>
            <option value="other_web3">Other Web3 TLD</option>
          </select>
        </label>
        {domainType === "web2" ? (
          <label className="text-[11px] text-slate-400 sm:col-span-2">
            DNS path (advisory)
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              value={provider}
              onChange={(e) => setProvider(e.target.value as DomainProvider)}
            >
              <option value="vercel">Vercel (API when available)</option>
              <option value="external">External / registrar only</option>
            </select>
          </label>
        ) : null}
        <label className="text-[11px] text-slate-400 sm:col-span-2">
          Deployment target
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={deploymentTarget}
            onChange={(e) => setDeploymentTarget(e.target.value as DeploymentTarget)}
          >
            <option value="vercel_deployment_url">Vercel deployment URL (e.g. *.vercel.app)</option>
            <option value="vercel_custom_domain">Custom domain already on Vercel</option>
            <option value="static_export_url">Exported static / CDN URL</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400 sm:col-span-2">
          Target URL
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://your-site.vercel.app"
          />
        </label>
      </div>

      {domainType === "freename_web3" || domainType === "other_web3" ? (
        <p className="text-[11px] leading-relaxed text-cyan-100/80">
          Point this Web3 domain to your Vercel-hosted site using the <span className="font-medium">target URL</span> above.
          Freename and similar resolvers may need time to propagate — use Re-check or manual confirm when the site loads in
          a browser.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-cyan-700/50 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-200 hover:border-cyan-500/50 disabled:opacity-50"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save connection"}
        </button>
        <button
          type="button"
          className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
          disabled={busy}
          onClick={() => void recheck(false)}
        >
          Re-check DNS
        </button>
        {(domainType === "freename_web3" || domainType === "other_web3") && (
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
            disabled={busy}
            onClick={() => void recheck(true)}
            title="When you have verified the site in a Web3-capable browser"
          >
            I confirm Web3 resolution
          </button>
        )}
        <button type="button" className="rounded border border-slate-700 px-2 py-1.5 text-[11px] text-slate-400" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {connection ? (
        <div className="rounded border border-slate-800 bg-slate-900/30 px-2 py-2 text-[11px] text-slate-400">
          <div>
            <span className="text-slate-500">Status:</span>{" "}
            <span className="font-mono text-slate-200">{connection.status}</span> · Provider:{" "}
            <span className="font-mono text-slate-200">{connection.provider}</span>
          </div>
          {connection.lastCheckedAt ? (
            <div className="mt-0.5">
              Last checked: {new Date(String(connection.lastCheckedAt)).toLocaleString()}
            </div>
          ) : null}
        </div>
      ) : null}

      {instructions?.records && instructions.records.length > 0 ? (
        <div>
          <div className="text-[11px] font-medium text-slate-300">Recommended DNS</div>
          <ul className="mt-1 space-y-1 text-[10px] font-mono text-slate-400">
            {instructions.records.map((r, i) => (
              <li key={i} className="break-all">
                {r.type} {r.name} → {r.value}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-1 text-[11px] text-cyan-400 hover:underline"
            onClick={() => copyText("DNS records", instructions.records!.map((r) => `${r.type} ${r.name} ${r.value}`).join("\n"))}
          >
            Copy DNS records
          </button>
        </div>
      ) : null}
      {instructions?.instructionsMarkdown ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-300">Setup instructions</span>
            <button
              type="button"
              className="text-[11px] text-cyan-400 hover:underline"
              onClick={() => copyText("setup instructions", instructions.instructionsMarkdown!)}
            >
              Copy
            </button>
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-slate-500">
            {instructions.instructionsMarkdown}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
