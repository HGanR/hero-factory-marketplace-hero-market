"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  trustId: string | null;
  workspaceId: string | null;
  clientId: string | null;
  updatedAt?: string | null;
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}

export default function SiteBuilderTemplatesPage() {
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const data = await jsonFetch<{ items: TemplateRow[] }>("/api/site-builder/templates");
    setItems(data.items || []);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load templates"));
  }, []);

  async function removeTemplate(id: string) {
    setBusy(true);
    setError(null);
    try {
      await jsonFetch(`/api/site-builder/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Consultant Templates</h1>
            <p className="mt-1 text-sm text-slate-400">Saved templates live in your database and can be loaded in Site Builder.</p>
          </div>
          <Link href="/site-builder" className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-cyan-400">
            Back to Site Builder
          </Link>
        </div>

        {error ? <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-200">Saved Templates</div>
          {items.length === 0 ? (
            <div className="text-sm text-slate-400">No templates yet. Save one from Step 2 in Site Builder.</div>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{item.name}</div>
                      {item.description ? <div className="text-xs text-slate-400">{item.description}</div> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeTemplate(item.id)}
                      disabled={busy}
                      className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-400 md:grid-cols-3">
                    <div>Trust: <span className="font-mono text-slate-300">{item.trustId || "—"}</span></div>
                    <div>Workspace: <span className="font-mono text-slate-300">{item.workspaceId || "—"}</span></div>
                    <div>Client: <span className="font-mono text-slate-300">{item.clientId || "—"}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

