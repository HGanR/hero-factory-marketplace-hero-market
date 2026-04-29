"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { TwinSceneStage } from "@/components/property-twin/TwinSceneStage";
import type { TwinNodeAnchor } from "@/components/property-twin/TwinSceneStage";
import { Button } from "@/components/ui/button";
import type { ImprovementPreset } from "@/lib/property-twin/deal-scenarios";

type JobRow = {
  id: number;
  status: string;
  errorMessage: string | null;
  outputUrl: string | null;
  resultJson: unknown;
};

type NodeApi = {
  id: number;
  label: string;
  anchorX: number | null;
  anchorY: number | null;
  anchorZ: number | null;
};

type PresentBundle = {
  property?: { name?: string | null };
  jobs?: JobRow[];
  nodes?: NodeApi[];
  error?: string;
};

function PresentInner() {
  const sp = useSearchParams();
  const raw = sp.get("propertyId");
  const propertyId = raw ? Number(raw) : NaN;
  const share = sp.get("share")?.trim() ?? null;

  const [name, setName] = useState<string>("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [nodes, setNodes] = useState<NodeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [visualMode, setVisualMode] = useState<"current" | "improved">("current");
  const [preset, setPreset] = useState<ImprovementPreset>("modern");

  const load = useCallback(async () => {
    if (!Number.isFinite(propertyId)) {
      setErr("Missing or invalid propertyId query.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    setNeedsSignIn(false);
    try {
      const qs = new URLSearchParams({ propertyId: String(propertyId) });
      if (share) qs.set("share", share);
      const r = await fetch(`/api/property-twin/present-bundle?${qs.toString()}`, {
        credentials: "include",
      });
      const data = (await r.json().catch(() => ({}))) as PresentBundle;

      if (!r.ok) {
        if (r.status === 401) {
          setNeedsSignIn(true);
          setErr(
            share
              ? "This share link is invalid or was rotated. Ask the owner for a new link, or sign in with an account that can access this property."
              : "Sign in to view this presentation, or use a client link that includes a share token."
          );
        } else if (r.status === 403) {
          setErr("You don't have access to this property.");
        } else if (r.status === 404) {
          setErr("Property not found.");
        } else {
          setErr(typeof data.error === "string" ? data.error : "Failed to load property.");
        }
        setName("");
        setJobs([]);
        setNodes([]);
        return;
      }

      setName(data.property?.name ?? `Property #${propertyId}`);
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
    } catch {
      setErr("Failed to load property.");
      setName("");
      setJobs([]);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId, share]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!Number.isFinite(propertyId) || loading || err) return;
    const needPoll = jobs.some((j) => j.status === "queued" || j.status === "running");
    if (!needPoll) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [propertyId, loading, err, jobs, load]);

  const latestJob = useMemo(() => jobs[0] ?? null, [jobs]);

  const anchorNodes: TwinNodeAnchor[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        anchorX: n.anchorX ?? null,
        anchorY: n.anchorY ?? null,
        anchorZ: n.anchorZ ?? null,
      })),
    [nodes]
  );

  if (!Number.isFinite(propertyId)) {
    return (
      <div className="min-h-screen bg-[#050a12] text-slate-300 flex flex-col items-center justify-center gap-4 px-4">
        <p>
          Add <code className="text-cyan-400">?propertyId=</code> to the URL.
        </p>
        <Button asChild variant="outline" className="border-white/20">
          <Link href="/property-twin">Back to studio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a12] text-slate-100 flex flex-col">
      <header className="shrink-0 border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/property-twin"
            className="inline-flex items-center gap-2 text-sm text-cyan-300/90 hover:text-cyan-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Studio
          </Link>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-white truncate">{name || `Property #${propertyId}`}</span>
            {share ? (
              <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">· shared</span>
            ) : null}
            {latestJob && (latestJob.status === "queued" || latestJob.status === "running") ? (
              <span className="text-[10px] uppercase tracking-wider text-cyan-400/90 shrink-0">
                · job {latestJob.status} · 4s refresh
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={visualMode === "current" ? "secondary" : "outline"}
            className="border-white/15"
            onClick={() => setVisualMode("current")}
          >
            Current
          </Button>
          <Button
            size="sm"
            variant={visualMode === "improved" ? "secondary" : "outline"}
            className="border-white/15"
            onClick={() => setVisualMode("improved")}
          >
            Improved
          </Button>
          {(["staged", "modern", "luxury"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant="outline"
              className={`capitalize border-white/15 h-8 text-xs ${preset === p && visualMode === "improved" ? "border-cyan-500/50 text-cyan-200" : ""}`}
              onClick={() => {
                setVisualMode("improved");
                setPreset(p);
              }}
            >
              {p}
            </Button>
          ))}
        </div>
      </header>

      <main className="flex-1 min-h-0 p-4 flex flex-col">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : err ? (
          <div className="max-w-lg space-y-4">
            <p className="text-amber-400">{err}</p>
            {needsSignIn ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-cyan-700 hover:bg-cyan-600">
                  <Link href="/">Sign in</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20">
                  <Link href="/property-twin">Back to studio</Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <TwinSceneStage
            job={latestJob}
            propertySelected
            onRefresh={() => void load()}
            visualMode={visualMode}
            improvementPreset={preset}
            nodes={anchorNodes}
            presentationMode
            viewerClassName="h-[min(72vh,calc(100vh-8rem))] w-full max-w-6xl mx-auto"
          />
        )}
        <p className="text-xs text-slate-500 mt-3 text-center max-w-2xl mx-auto">
          Client-facing presentation — no edit controls. Return to the studio to upload media, run jobs, and
          place anchors.
        </p>
      </main>
    </div>
  );
}

export function PropertyTwinPresentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050a12] text-slate-400 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <PresentInner />
    </Suspense>
  );
}
