"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ScenePlanSummary = {
  id: number;
  name: string;
  planKind: string;
  planVersion: number;
  createdAt: string;
};

type ScenePlanRecord = {
  id: number;
  title: string;
  notes?: string | null;
  planId: number;
  createdAt: string;
  metadata?: {
    planHash?: string;
    seed?: number;
    planVersion?: number;
  };
};

export function ScenePlansSection({ trustId }: { trustId: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<ScenePlanSummary[]>([]);
  const [records, setRecords] = useState<ScenePlanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [planId, setPlanId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const returnTo = useMemo(() => {
    const basePath = pathname ?? "/trust-records";
    const q = searchParams?.toString();
    return q ? `${basePath}?${q}` : basePath;
  }, [pathname, searchParams]);

  const canSubmit = useMemo(() => !!trustId && !!planId.trim(), [trustId, planId]);

  const load = async () => {
    if (!trustId) return;
    setLoading(true);
    try {
      const [plansRes, recordsRes] = await Promise.all([
        fetch("/api/modeling/plans?kind=scene", { credentials: "include" }),
        fetch(`/api/trust-records/${encodeURIComponent(trustId)}/scene-plans`, { credentials: "include" }),
      ]);
      const plansJson = await plansRes.json().catch(() => ({}));
      const recordsJson = await recordsRes.json().catch(() => ({}));
      setPlans(Array.isArray(plansJson?.plans) ? plansJson.plans : []);
      setRecords(Array.isArray(recordsJson?.records) ? recordsJson.records : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load scene plans");
      setPlans([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustId]);

  const submit = async () => {
    if (!trustId || !canSubmit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trust-records/${encodeURIComponent(trustId)}/scene-plans`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: Number(planId),
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to file plan");
      toast.success("Scene plan filed to Trust Records");
      setTitle("");
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div>
        <div className="text-sm font-semibold text-slate-100">3D Scene Plans</div>
        <div className="text-xs text-slate-400">
          File a scene plan into Trust Records with canonical plan hash provenance.
        </div>
      </div>

      {!trustId ? (
        <div className="text-xs text-slate-400">Select a trust workspace to file scene plans.</div>
      ) : (
        <>
          {(() => {
            const trustIdSafe = trustId;
            return (
              <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Scene Plan</Label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                <option value="">Select scene plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Filed scene title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[40px]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={!canSubmit || busy}>
              {busy ? "Filing…" : "File Scene Plan"}
            </Button>
            {loading && <span className="text-xs text-slate-500">Refreshing…</span>}
          </div>

          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="text-xs text-slate-400">No scene plans filed yet.</div>
            ) : (
              records.map((r) => {
                const shortHash = r.metadata?.planHash ? `${r.metadata.planHash.slice(0, 12)}…` : "—";
                return (
                  <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-100">{r.title}</div>
                        <div className="text-xs text-slate-400">
                          v{r.metadata?.planVersion ?? "?"} · seed {r.metadata?.seed ?? "?"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                          onClick={() => {
                            const h = r.metadata?.planHash ?? "";
                            if (!h) return;
                            navigator.clipboard?.writeText(h);
                            toast.success("Hash copied");
                          }}
                          title={r.metadata?.planHash ?? ""}
                        >
                          <Copy className="h-3 w-3" />
                          {shortHash}
                        </button>
                        <Link
                          href={`/modeling?planId=${encodeURIComponent(String(r.planId))}&trustId=${encodeURIComponent(
                            trustIdSafe
                          )}&recordId=${encodeURIComponent(String(r.id))}&tab=governance&returnTo=${encodeURIComponent(
                            returnTo
                          )}`}
                          className="inline-flex items-center gap-1 rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-950/40"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open in Modeling
                        </Link>
                      </div>
                    </div>
                    {r.notes ? <div className="mt-2 text-xs text-slate-300">{r.notes}</div> : null}
                  </div>
                );
              })
            )}
          </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

