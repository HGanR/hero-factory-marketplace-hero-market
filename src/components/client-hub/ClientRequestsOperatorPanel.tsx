"use client";

import { useEffect, useState } from "react";

type RequestItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: "open" | "reviewing" | "completed" | "rejected";
  operatorNote: string | null;
  createdAt: string;
  relatedAgentId: string | null;
  relatedSiteId: string | null;
};

export function ClientRequestsOperatorPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const r = await fetch(`/api/revenue-os/clients/${encodeURIComponent(clientId)}/requests`, { credentials: "include" });
    const j = (await r.json().catch(() => ({}))) as { items?: RequestItem[]; error?: string };
    if (!r.ok) setErr(j.error ?? "Failed to load requests");
    setItems(Array.isArray(j.items) ? j.items : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const update = async (id: string, status: RequestItem["status"], operatorNote: string | null) => {
    setSavingId(id);
    const r = await fetch(
      `/api/revenue-os/clients/${encodeURIComponent(clientId)}/requests/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, operatorNote }),
      },
    );
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? "Update failed");
    } else {
      await load();
    }
    setSavingId(null);
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-rose-300">{err}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No requests yet.</p>
      ) : (
        items.map((r) => (
          <article key={r.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-slate-100">{r.title}</h3>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">{r.type}</span>
              <span className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-[10px] uppercase text-cyan-200">{r.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{r.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <select
                className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-100"
                defaultValue={r.status}
                onChange={(e) => void update(r.id, e.target.value as RequestItem["status"], r.operatorNote)}
                disabled={savingId === r.id}
              >
                <option value="open">open</option>
                <option value="reviewing">reviewing</option>
                <option value="completed">completed</option>
                <option value="rejected">rejected</option>
              </select>
              <button
                type="button"
                disabled={savingId === r.id}
                onClick={() => {
                  const note = window.prompt("Operator note", r.operatorNote ?? "");
                  if (note === null) return;
                  void update(r.id, r.status, note);
                }}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200 hover:bg-white/10"
              >
                Edit note
              </button>
              <span className="text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            {r.operatorNote ? <p className="mt-1 text-xs text-amber-200/90">Note: {r.operatorNote}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
