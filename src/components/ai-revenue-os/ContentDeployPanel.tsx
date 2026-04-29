"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Rocket, FileJson, FileText, Send } from "lucide-react";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import {
  buildContentDeployPayload,
  formatDeployPlainText,
  inferDeployPreset,
  splitHookCaptionCta,
} from "@/lib/revenue-os/content-deploy-format";

const ACCENT = "#00D1FF";

type Props = {
  output: ContentEngineOutput;
  platformLabel: string;
  businessName: string;
  /** When set, new deployments (and updates) link to this generation-memory variant for attribution. */
  generationVariantId?: string | null;
};

export function ContentDeployPanel({ output, platformLabel, businessName, generationVariantId }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(false);
  const [deployId, setDeployId] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<{
    trackedCount: number;
    bookedCount: number;
    closedCount: number;
    lostCount: number;
    estimatedPipeline: number;
    closedRevenue: number;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const preset = inferDeployPreset(platformLabel);
  const split = splitHookCaptionCta(output);
  const plain = formatDeployPlainText(preset, output, businessName || "your brand");
  const jsonExport = JSON.stringify(buildContentDeployPayload(output, platformLabel), null, 2);

  useEffect(() => {
    if (!deployId) {
      setAttribution(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/bentley-social-leads/content-deployments?includeAttribution=1", {
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as {
          deployments?: Array<{
            id: string;
            attribution?: {
              trackedCount: number;
              bookedCount: number;
              closedCount: number;
              lostCount: number;
              estimatedPipeline: number;
              closedRevenue: number;
            };
          }>;
        };
        const row = data.deployments?.find((d) => d.id === deployId);
        if (cancelled) return;
        if (row?.attribution) setAttribution(row.attribution);
        else
          setAttribution({
            trackedCount: 0,
            bookedCount: 0,
            closedCount: 0,
            lostCount: 0,
            estimatedPipeline: 0,
            closedRevenue: 0,
          });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deployId]);

  useEffect(() => {
    if (!deployId || !generationVariantId?.trim()) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/bentley-social-leads/content-deployments/${deployId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationVariantId: generationVariantId.trim() }),
        });
        if (!r.ok && !cancelled) setErr("Could not link deployment to saved generation");
      } catch {
        if (!cancelled) setErr("Could not link deployment to saved generation");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deployId, generationVariantId]);

  async function copyText(field: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setErr("Copy failed");
    }
  }

  async function saveDeployment(markPosted: boolean) {
    setSaving(true);
    setErr(null);
    try {
      const payload = buildContentDeployPayload(output, platformLabel);
      let id = deployId;

      if (!id) {
        const r = await fetch("/api/bentley-social-leads/content-deployments", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: preset,
            title: `${platformLabel} · ${businessName || "Content"}`,
            hook: split.hook,
            caption: split.caption,
            cta: split.cta,
            hashtags: output.fullPost?.hashtags ?? [],
            fullExportJson: payload as unknown as Record<string, unknown>,
            ...(generationVariantId?.trim()
              ? { generationVariantId: generationVariantId.trim() }
              : {}),
          }),
        });
        const data = (await r.json()) as { deployment?: { id: string }; error?: string };
        if (!r.ok) throw new Error(data?.error ?? "Save failed");
        id = data.deployment?.id ?? null;
        if (id) setDeployId(id);
      }

      if (markPosted && id) {
        const pr = await fetch(`/api/bentley-social-leads/content-deployments/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "posted",
            ...(generationVariantId?.trim()
              ? { generationVariantId: generationVariantId.trim() }
              : {}),
          }),
        });
        if (!pr.ok) throw new Error("Could not mark posted");
        setPosted(true);
      } else {
        setPosted(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-emerald-200">
          <Rocket className="w-4 h-4" />
          <span className="text-sm font-semibold">Deploy Content (prep)</span>
        </div>
        {posted ? (
          <span className="text-[10px] uppercase tracking-wider text-emerald-400/90">Marked posted</span>
        ) : (
          <span className="text-[10px] text-slate-500">Not auto-posted — copy & publish manually</span>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Copy-ready blocks for <strong className="text-slate-300">{preset}</strong>. Hook / caption / CTA are split for
        scheduling tools. Export JSON for your own tracker.
      </p>

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-black/30 border border-white/10 p-3">
          <p className="text-[10px] uppercase text-slate-500 mb-1">Hook</p>
          <p className="text-slate-200 whitespace-pre-wrap">{split.hook || "—"}</p>
          <button
            type="button"
            onClick={() => void copyText("hook", split.hook)}
            className="mt-2 text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            {copied === "hook" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy hook
          </button>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/10 p-3 md:col-span-2">
          <p className="text-[10px] uppercase text-slate-500 mb-1">Caption</p>
          <p className="text-slate-300 whitespace-pre-wrap text-xs leading-relaxed">{split.caption || "—"}</p>
          <button
            type="button"
            onClick={() => void copyText("cap", split.caption)}
            className="mt-2 text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            {copied === "cap" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy caption
          </button>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/10 p-3 md:col-span-3">
          <p className="text-[10px] uppercase text-slate-500 mb-1">CTA</p>
          <p className="text-slate-300 whitespace-pre-wrap text-sm">{split.cta}</p>
          <button
            type="button"
            onClick={() => void copyText("cta", split.cta)}
            className="mt-2 text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            {copied === "cta" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy CTA
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyText("plain", plain)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-xs text-slate-200 hover:bg-white/5"
        >
          <FileText className="w-4 h-4" style={{ color: ACCENT }} />
          Copy plain text pack
        </button>
        <button
          type="button"
          onClick={() => void copyText("json", jsonExport)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-xs text-slate-200 hover:bg-white/5"
        >
          <FileJson className="w-4 h-4 text-amber-400" />
          Copy JSON export
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveDeployment(false)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700/50 text-white text-xs hover:bg-emerald-600/60 disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveDeployment(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/50 text-emerald-200 text-xs hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          Save & mark posted
        </button>
      </div>
      {deployId ? (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-500">Deployment id: {deployId.slice(0, 10)}…</p>
          {attribution ? (
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-1 rounded-md border border-cyan-500/40 bg-cyan-950/30 text-cyan-200/90">
                Tracked: {attribution.trackedCount}
              </span>
              <span className="px-2 py-1 rounded-md border border-violet-500/40 bg-violet-950/30 text-violet-200/90">
                Booked: {attribution.bookedCount}
              </span>
              <span className="px-2 py-1 rounded-md border border-emerald-500/40 bg-emerald-950/30 text-emerald-200/90">
                Closed: {attribution.closedCount}
              </span>
              {attribution.lostCount > 0 ? (
                <span className="px-2 py-1 rounded-md border border-rose-500/35 bg-rose-950/25 text-rose-200/90">
                  Lost: {attribution.lostCount}
                </span>
              ) : null}
              <span className="px-2 py-1 rounded-md border border-white/15 text-slate-400">
                Pipeline est.:{" "}
                {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                  attribution.estimatedPipeline
                )}
              </span>
              <span className="px-2 py-1 rounded-md border border-white/15 text-slate-400">
                Closed $:{" "}
                {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                  attribution.closedRevenue
                )}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-slate-600">Loading attribution…</p>
          )}
        </div>
      ) : null}
      {err ? <p className="text-xs text-rose-400">{err}</p> : null}
    </div>
  );
}
