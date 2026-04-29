"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type RequestRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  operatorNote: string | null;
  createdAt: string;
};

const TYPES = [
  "ai_issue",
  "website_change",
  "business_info",
  "faq_update",
  "contact_update",
  "other",
] as const;

export default function ClientPortalRequestsPage() {
  const search = useSearchParams();
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/client-portal/requests", { credentials: "include" });
    const j = (await r.json().catch(() => ({}))) as { items?: RequestRow[]; error?: string };
    if (r.ok) setItems(Array.isArray(j.items) ? j.items : []);
    else setErr(j.error ?? "Failed to load requests");
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (search.get("prefill") === "avatar") {
      setType("business_info");
      setTitle("Update AI assistant avatar/colors");
      setDescription("Please update the assistant avatar and chat widget colors to match our brand.");
    }
  }, [search]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/client-portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, title, description }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setErr(j.error ?? "Failed to submit request");
        return;
      }
      setTitle("");
      setDescription("");
      setType("other");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Requests</h1>
      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Submit request</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-600">Type</span>
            <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Title</span>
            <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">Description</span>
          <textarea className="mt-1 min-h-[90px] w-full rounded border border-slate-300 px-2 py-1.5" value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        {err ? <p className="text-xs text-rose-600">{err}</p> : null}
        <button disabled={submitting} className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Request list</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((r) => (
              <li key={r.id} className="rounded border border-slate-200 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{r.title}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">{r.type}</span>
                  <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] uppercase text-cyan-700">{r.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                {r.operatorNote ? <p className="mt-1 text-xs text-amber-700">Operator note: {r.operatorNote}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
