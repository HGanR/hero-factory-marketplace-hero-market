"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, KeyRound, Plus, MessageSquare } from "lucide-react";
import { COMMON_LANGUAGES } from "@/lib/i18n/common-languages";

type NPC = {
  id: number;
  npcId: string;
  name: string;
  role: string;
  title?: string | null;
  avatarEmoji: string;
  greeting?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  secretary: "Executive Secretary",
  avatar: "World Owner",
  guide: "World Guide",
  voice_agent: "Virtual Receptionist",
  executive_admin: "Executive administration",
};

export default function MyNPCsPage() {
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<string>("guide");
  const [createLanguage, setCreateLanguage] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const loadNpcs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/app/npcs", { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      setNpcs(Array.isArray(j.npcs) ? j.npcs : []);
    } catch {
      setNpcs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNpcs();
  }, [loadNpcs]);

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      alert("Enter a name.");
      return;
    }
    setCreateSubmitting(true);
    try {
      const r = await fetch("/api/app/npcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          role: createRole,
          title: ROLE_LABELS[createRole] || createRole,
          language: createLanguage.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j?.error ?? "Failed to create NPC.");
        return;
      }
      setCreateName("");
      setCreateRole("guide");
      setCreateLanguage("");
      setCreateOpen(false);
      await loadNpcs();
    } finally {
      setCreateSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My NPCs</h1>
            <p className="mt-1 text-sm text-white/60">
              Create and manage your own conversational NPCs. Not workspace-specific.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium hover:bg-cyan-500/15 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New NPC
          </button>
        </div>

        <aside className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
          <div className="flex flex-wrap items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <div>
              <p className="font-medium text-amber-50">Looking for a MAANIA / RET widget key?</p>
              <p className="mt-1 text-amber-100/85">
                That is <strong>not</strong> created here — <strong>My NPCs</strong> are for world / workspace
                characters. Widget keys come from{" "}
                <Link href="/app/agents" className="font-semibold text-amber-200 underline underline-offset-2">
                  AI Agents
                </Link>
                : pick an agent, bind a site, then <strong>Generate Widget Key</strong>. Put the key in{" "}
                <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_RET_WIDGET_KEY</code> and add
                your site origin under allowed domains.
              </p>
            </div>
          </div>
        </aside>

        {loading ? (
          <div className="mt-8 py-12 text-center text-white/60">Loading…</div>
        ) : npcs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <Bot className="mx-auto h-12 w-12 text-white/30" />
            <p className="mt-4 text-white/70">No NPCs yet.</p>
            <p className="mt-1 text-sm text-white/50">
              Create your first NPC to use it in your worlds and trust workspaces.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-6 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
            >
              Create NPC
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {npcs.map((npc) => (
              <div
                key={npc.npcId}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{npc.avatarEmoji || "🤖"}</span>
                  <div>
                    <div className="font-semibold">{npc.name}</div>
                    <div className="text-sm text-white/60">
                      {ROLE_LABELS[npc.role] || npc.role}
                      {npc.title ? ` · ${npc.title}` : ""}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/oasis-npc?npcId=${encodeURIComponent(npc.npcId)}`}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm hover:bg-cyan-500/15 flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black p-6">
            <h3 className="text-lg font-semibold">Create NPC</h3>
            <p className="mt-1 text-sm text-white/60">
              NPCs are not workspace-specific. You can use them across your workspaces.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-white/60">Name</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="e.g. Trust Assistant"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Role</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                >
                  <option value="secretary">Executive Secretary</option>
                  <option value="avatar">World Owner</option>
                  <option value="guide">World Guide</option>
                  <option value="voice_agent">Virtual Receptionist</option>
                  <option value="executive_admin">Executive administration</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60">Language (optional)</label>
                <select
                  value={createLanguage}
                  onChange={(e) => setCreateLanguage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                >
                  {COMMON_LANGUAGES.map((l) => (
                    <option key={l.value || "default"} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createSubmitting || !createName.trim()}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
              >
                {createSubmitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
