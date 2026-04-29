"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  due: string;
  priority: string;
  status: string;
  contactId: string | null;
  source: string | null;
};

export default function TasksPage() {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "completed" | "all">("open");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/app/tasks?status=${statusFilter}&limit=100`,
        { credentials: "include", cache: "no-store" }
      );
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
  }, [statusFilter]);

  async function createTask() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await fetch("/api/app/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      setNewTitle("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleComplete(t: Task) {
    const newStatus = t.status === "open" ? "completed" : "open";
    await fetch(`/api/app/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tasks</h1>
            <p className="text-sm text-white/60">
              What needs attention • Linked to contacts & opportunities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "open" | "completed" | "all")}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </select>
            <Link
              href="/app/dashboard"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task title…"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
            onKeyDown={(e) => e.key === "Enter" && createTask()}
          />
          <button
            onClick={createTask}
            disabled={!newTitle.trim() || creating}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {creating ? "Creating…" : "+ Create Task"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5">
          {loading ? (
            <div className="p-12 text-center text-white/60">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-white/60">
                No {statusFilter === "all" ? "" : statusFilter} tasks yet.
              </p>
              <p className="mt-2 text-sm text-white/50">
                Create tasks from contact profiles or via automations (e.g. call_completed → create_task).
              </p>
              <Link
                href="/app/contacts"
                className="mt-4 inline-block text-cyan-400 hover:text-cyan-300"
              >
                Go to Contacts →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {items.map((t) => (
                <div
                  key={t.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                    t.status === "completed" ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs shrink-0 ${
                          t.priority === "High"
                            ? "bg-white text-black"
                            : t.priority === "Low"
                              ? "bg-white/10 text-white/80"
                              : "bg-white/15 text-white"
                        }`}
                      >
                        {t.priority}
                      </span>
                      {t.source === "automation" ? (
                        <span className="text-xs text-white/50">auto</span>
                      ) : null}
                    </div>
                    <div className="mt-1 font-medium">{t.title}</div>
                    {t.description ? (
                      <div className="mt-1 truncate text-sm text-white/60">
                        {t.description}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/50">
                      <span>Due: {t.due}</span>
                      {t.contactId ? (
                        <Link
                          href={`/app/contacts/${t.contactId}`}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          View contact →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.status === "open" ? (
                      <button
                        onClick={() => toggleComplete(t)}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                      >
                        Complete
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleComplete(t)}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                      >
                        Reopen
                      </button>
                    )}
                    {t.contactId ? (
                      <Link
                        href={`/app/contacts/${t.contactId}`}
                        className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/20"
                      >
                        Profile
                      </Link>
                    ) : null}
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
