"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, LayoutDashboard, MessageSquare, Map, Settings } from "lucide-react";

const BINDING_KEY = "smart_trust_platform_binding_v1";

function loadWorkspaceFromBinding(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BINDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { trustId?: string | null };
    return typeof parsed?.trustId === "string" && parsed.trustId.trim() ? parsed.trustId.trim() : null;
  } catch {
    return null;
  }
}

type Agent = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
};

type NPC = {
  /** Public stable key (API may send `id` and/or `npcId`). */
  id?: string;
  npcId?: string;
  name: string;
  role: string;
  title?: string | null;
  avatarEmoji: string;
};

const ROLE_LABELS: Record<string, string> = {
  secretary: "Executive Secretary",
  avatar: "World Owner",
  guide: "World Guide",
  voice_agent: "Virtual Receptionist",
  executive_admin: "Executive administration",
};

export default function AgentsOverviewPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wid = loadWorkspaceFromBinding();
      setWorkspaceId(wid);

      const [agentsRes, npcsRes] = await Promise.all([
        fetch(wid ? `/api/app/agents?workspaceId=${encodeURIComponent(wid)}` : "/api/app/agents", {
          credentials: "include",
        }),
        fetch("/api/npc/list", { credentials: "include" }),
      ]);

      const agentsData = await agentsRes.json().catch(() => ({}));
      const npcsData = await npcsRes.json().catch(() => ({}));

      setAgents(agentsData.items ?? []);
      setNpcs(npcsData.npcs ?? []);
    } catch {
      setAgents([]);
      setNpcs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      const wid = loadWorkspaceFromBinding();
      setWorkspaceId(wid);
      load();
    };
    window.addEventListener("smart_trust_platform_binding_updated", refresh);
    return () => window.removeEventListener("smart_trust_platform_binding_updated", refresh);
  }, [load]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents Overview</h1>
            <p className="mt-1 text-sm text-white/60">
              All your AI agents and platform NPCs. Link them in Mapping to build workflows.
            </p>
            {workspaceId && (
              <p className="mt-1 text-xs text-cyan-300/80">
                Workspace: {workspaceId.slice(0, 8)}…{workspaceId.slice(-4)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/agents/mapping"
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm hover:bg-cyan-500/15 flex items-center gap-2"
            >
              <Map className="h-4 w-4" />
              Mapping
            </Link>
            <Link
              href="/app/agents"
              className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm hover:bg-orange-500/15 flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Configure Agents
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 py-12 text-center text-white/60">Loading…</div>
        ) : agents.length === 0 && npcs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <Bot className="mx-auto h-12 w-12 text-white/30" />
            <p className="mt-4 text-white/70">No agents or NPCs yet.</p>
            <p className="mt-1 text-sm text-white/50">
              Create agents in Configure, or open a workspace from Trust Records to see your agents.
            </p>
            <Link
              href="/app/agents"
              className="mt-6 inline-block rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
            >
              Configure Agents
            </Link>
          </div>
        ) : (
          <>
            {npcs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-white/90">Platform NPCs</h2>
                <p className="text-xs text-white/50 mt-0.5">
                  MAANIA, Jarva, Bentley, Eleanor, and the full platform roster. Use in Mapping.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {npcs.map((npc) => {
                    const npcKey = npc.npcId || npc.id || "";
                    if (!npcKey) return null;
                    return (
                    <div
                      key={npcKey}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-3xl shrink-0">{npc.avatarEmoji || "🤖"}</span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{npc.name}</div>
                          <div className="text-sm text-white/60 truncate">
                            {ROLE_LABELS[npc.role] || npc.role}
                            {npc.title ? ` · ${npc.title}` : ""}
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/oasis-npc?npcId=${encodeURIComponent(npcKey)}`}
                        className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm hover:bg-cyan-500/15 flex items-center gap-2 shrink-0"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Chat
                      </Link>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}

            {agents.length > 0 && (
              <div className={`mt-8 ${npcs.length > 0 ? "pt-8 border-t border-white/10" : ""}`}>
                <h2 className="text-lg font-semibold text-white/90">Workspace Agents</h2>
                <p className="text-xs text-white/50 mt-0.5">Your AI agents. Create and link in Mapping.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-3xl shrink-0">🤖</span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{agent.name}</div>
                          <div className="text-sm text-white/60 truncate">{agent.description ?? "—"}</div>
                          <span className="inline-block mt-1 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] text-white/70">
                            {(agent.status ?? "draft").toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Link
                          href={`/app/agents/${encodeURIComponent(agent.id)}/control`}
                          className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm hover:bg-violet-500/15 flex items-center justify-center gap-2"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Control
                        </Link>
                        <Link
                          href={`/app/agents?agent=${encodeURIComponent(agent.id)}`}
                          className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm hover:bg-cyan-500/15 flex items-center justify-center gap-2"
                        >
                          <Settings className="h-4 w-4" />
                          Configure
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
