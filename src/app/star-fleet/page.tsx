"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {Building2, Plus, ArrowRight, TrendingUp, Clock, CheckCircle2, XCircle, Plug, Search, Rocket} from "lucide-react";
import { loadStarFleetEntities, type StarFleetEntity } from "@/lib/starfleet";

export default function StarFleetPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<StarFleetEntity[]>([]);
  const [query, setQuery] = useState("");

  // App-session gate (match other pages)
  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    setEntities(loadStarFleetEntities());
    const onStorage = () => setEntities(loadStarFleetEntities());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stats = useMemo(() => {
    const active = entities.filter((e) => e.status === "active").length;
    const pending = entities.filter((e) => e.status === "pending").length;
    const closed = entities.filter((e) => e.status === "closed").length;
    return { active, pending, closed, total: entities.length };
  }, [entities]);

  const recentFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? entities.filter((e) => e.name.toLowerCase().includes(q) || e.jurisdiction.toLowerCase().includes(q))
      : entities;
    return filtered.slice(0, 5);
  }, [entities, query]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight break-words">Star Fleet</h1>
              <p className="text-sm text-slate-300 break-words">
                Star Fleet services — entity dashboard & tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/dashboard" className="text-slate-300 hover:text-white underline">
              Back to Dashboard
            </Link>
            <Link
              href="/lift-off"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors"
            >
              <Rocket className="h-4 w-4 text-cyan-300" />
              <span>Lift Off</span>
            </Link>
            <Link
              href="/star-fleet/entities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create New Entity
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Active Entities" value={stats.active} icon={<CheckCircle2 className="h-4 w-4 text-green-300" />} />
          <StatCard title="Pending Entities" value={stats.pending} icon={<Clock className="h-4 w-4 text-yellow-300" />} />
          <StatCard title="Closed Entities" value={stats.closed} icon={<XCircle className="h-4 w-4 text-slate-300" />} />
          <StatCard title="Total Entities" value={stats.total} icon={<TrendingUp className="h-4 w-4 text-cyan-300" />} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link
            href="/lift-off"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors"
          >
            <span>Lift Off</span>
            <Rocket className="h-4 w-4" />
          </Link>
          <Link
            href="/star-fleet/entities"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors"
          >
            <span>My Entities</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/star-fleet/plugins"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors"
          >
            <span>Plugins</span>
            <Plug className="h-4 w-4" />
          </Link>
          <Link
            href="/accounting"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors"
          >
            <span>Accounting</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors"
          >
            <span>Compliance</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Recent Entities</h2>
              <p className="text-sm text-slate-300">Your most recently created entities</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search entities…"
                  className="w-full md:w-[260px] pl-9 pr-3 py-2 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
            <Link href="/star-fleet/entities" className="text-slate-300 hover:text-white underline">
              View all
            </Link>
            </div>
          </div>

          <div className="p-6">
            {entities.length === 0 ? (
              <div className="text-slate-300">
                No entities yet. Click <span className="font-semibold text-white">Create New Entity</span> to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {recentFiltered.length === 0 ? (
                  <div className="text-slate-300">No entities match your search.</div>
                ) : (
                  recentFiltered.map((e) => (
                  <Link
                    key={e.id}
                    href={`/star-fleet/entities/${e.id}`}
                    className="block rounded-xl border border-white/10 bg-slate-950/40 hover:bg-slate-950/60 transition-colors p-4"
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-semibold break-words">{e.name}</div>
                        <div className="text-xs text-slate-400">
                          {e.jurisdiction} • Created {new Date(e.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <StatusPill status={e.status} />
                    </div>
                  </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-300">{title}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: StarFleetEntity["status"] }) {
  const cls =
    status === "active"
      ? "bg-green-500/20 text-green-200 border-green-500/30"
      : status === "pending"
      ? "bg-yellow-500/20 text-yellow-200 border-yellow-500/30"
      : "bg-slate-500/20 text-slate-200 border-slate-500/30";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`px-3 py-1 rounded-full text-xs border ${cls}`}>{label}</span>;
}


