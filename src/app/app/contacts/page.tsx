"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  createdAt: string | Date;
  lastActivityAt: string | null;
};

function nameOf(c: ContactRow) {
  const n = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return n || c.phone || c.email || "Unknown";
}

export default function ContactsPage() {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/app/contacts", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      setItems(j.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const n = nameOf(c).toLowerCase();
      return (
        n.includes(s) ||
        (c.email ?? "").toLowerCase().includes(s) ||
        (c.phone ?? "").toLowerCase().includes(s)
      );
    });
  }, [items, q]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-white/60">
              CRM directory • open conversations • trigger automations
            </p>
          </div>

          <Link
            href="/app/conversations"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Open Conversations →
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="p-3 border-b border-white/10">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left font-medium">Contact</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Last activity</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-white/50">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link href={`/app/contacts/${c.id}`} className="block">
                          <div className="font-medium text-cyan-400 hover:text-cyan-300">{nameOf(c)}</div>
                          <div className="text-xs text-white/50">ID: {c.id.slice(0, 8)}…</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/80">{c.email ?? "—"}</td>
                      <td className="px-4 py-3 text-white/80">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-white/70">
                        {c.leadSource === "reality_landing" ? (
                          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
                            REALITY
                          </span>
                        ) : (
                          (c.leadSource ?? "—")
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {c.lastActivityAt
                          ? new Date(c.lastActivityAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/app/contacts/${c.id}`}
                            className="inline-block rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                          >
                            Profile
                          </Link>
                          <Link
                            href={`/app/conversations?contactId=${encodeURIComponent(c.id)}`}
                            className="inline-block rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                          >
                            Conversation
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                      No contacts found. Inbound calls will create contacts automatically.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
