"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus, ArrowRight, Search } from "lucide-react";
import { loadStarFleetEntities, type StarFleetEntity } from "@/lib/starfleet";

export default function StarFleetEntitiesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<StarFleetEntity[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StarFleetEntity["status"] | "all">("all");

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

  const sorted = useMemo(() => {
    const byDate = [...entities].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const q = query.trim().toLowerCase();
    return byDate.filter((e) => {
      const matchesQuery = !q || e.name.toLowerCase().includes(q) || e.jurisdiction.toLowerCase().includes(q);
      const matchesStatus = status === "all" ? true : e.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [entities, query, status]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-cyan-300" />
            <div>
              <h1 className="text-2xl font-bold">My Entities</h1>
              <p className="text-sm text-slate-300">Manage your Star Fleet entities</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/star-fleet" className="text-slate-300 hover:text-white underline">
              Back to Star Fleet
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

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entities…"
                className="w-full md:w-[320px] pl-9 pr-3 py-2 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-slate-200"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="text-sm text-slate-300">
            Showing <span className="font-semibold text-white">{sorted.length}</span> / {entities.length}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-slate-300">
            No entities match your filters. Try clearing search or changing status.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((e) => (
              <Link
                key={e.id}
                href={`/star-fleet/entities/${e.id}`}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5 block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">{e.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {e.jurisdiction} • Created {new Date(e.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-xs text-slate-300 border border-white/10 rounded-full px-3 py-1">
                    {e.status}
                  </span>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-300">
                  View Details <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


