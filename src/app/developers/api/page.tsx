"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Key, FileJson } from "lucide-react";

const RESOURCES = [
  { path: "/api/v1/trusts", methods: ["GET"], scope: "read:trusts", desc: "List trusts" },
  { path: "/api/v1/trusts/:id", methods: ["GET"], scope: "read:trusts", desc: "Get trust by ID" },
  { path: "/api/v1/trusts/:id/assets", methods: ["GET"], scope: "read:assets", desc: "List trust assets" },
  { path: "/api/v1/trusts/:id/instruments", methods: ["GET"], scope: "read:instruments", desc: "List trust instruments" },
  { path: "/api/v1/assets", methods: ["GET"], scope: "read:assets", desc: "List assets (?trustId=)" },
  { path: "/api/v1/assets/:id", methods: ["GET"], scope: "read:assets", desc: "Get asset by ID" },
  { path: "/api/v1/instruments", methods: ["GET"], scope: "read:instruments", desc: "List instruments (?trustId=)" },
  { path: "/api/v1/instruments/:id", methods: ["GET"], scope: "read:instruments", desc: "Get instrument by ID" },
  { path: "/api/v1/events", methods: ["GET"], scope: "read:events", desc: "List platform events (?limit=, ?trustId=)" },
  { path: "/api/v1/events/:id", methods: ["GET"], scope: "read:events", desc: "Get event by ID" },
  { path: "/api/v1/workflows", methods: ["GET"], scope: "read:workflows", desc: "List workflows" },
  { path: "/api/v1/workflows/:id", methods: ["GET"], scope: "read:workflows", desc: "Get workflow by ID" },
  { path: "/api/v1/worlds", methods: ["GET"], scope: "read:worlds", desc: "List worlds (?scope=me|all)" },
  { path: "/api/v1/worlds/:id", methods: ["GET"], scope: "read:worlds", desc: "Get world by ID" },
  { path: "/api/v1/worlds/:id/commerce", methods: ["GET", "POST"], scope: "read:commerce / write:commerce", desc: "List or create commerce nodes" },
  { path: "/api/v1/worlds/:id/npcs", methods: ["GET", "POST"], scope: "read:worlds / write:worlds", desc: "List or spawn NPCs" },
  { path: "/api/v1/agents", methods: ["GET"], scope: "read:worlds", desc: "List platform agents" },
  { path: "/api/v1/identity", methods: ["GET"], scope: "read:worlds", desc: "Get Troo ID and linked wallets" },
  { path: "/api/v1/identity/wallets", methods: ["POST"], scope: "write:worlds", desc: "Link wallet to Troo identity" },
  { path: "/api/v1/apps", methods: ["GET"], scope: "read:apps", desc: "List apps (?scope=my|public)" },
  { path: "/api/v1/apps/:slug", methods: ["GET"], scope: "read:apps", desc: "Get app by slug" },
  { path: "/api/v1/events/stream", methods: ["GET"], scope: "read:events", desc: "SSE event stream (?token=, ?eventType=, ?scope=public)" },
];

export default function PlatformApiPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Platform API v1</h1>
              <p className="text-slate-400">Unified, versioned, scoped API for the platform</p>
            </div>
          </div>
        </div>

        <div className="mb-8 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-400" />
            Authentication
          </h2>
          <p className="text-slate-400 text-sm mb-2">Use a Bearer token (API key) in the Authorization header:</p>
          <pre className="p-4 rounded-lg bg-slate-900 text-cyan-300 font-mono text-sm overflow-x-auto">
            Authorization: Bearer hf_live_xxxxxxxxxxxx
          </pre>
          <p className="text-slate-500 text-sm mt-2">
            Create API keys with scoped permissions in the <Link href="/developers#api-keys" className="text-cyan-400 hover:text-cyan-300">Developer Portal</Link>.
          </p>
        </div>

        <div className="mb-8 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileJson className="w-5 h-5 text-cyan-400" />
            Resource Format
          </h2>
          <p className="text-slate-400 text-sm mb-4">All resources return a stable schema:</p>
          <pre className="p-4 rounded-lg bg-slate-900 text-amber-200 text-sm overflow-x-auto">
{`{
  "id": "inst_123",
  "type": "instrument",
  "metadata": { "instrumentKind": "bond", "status": "issued", ... },
  "relationships": { "trust": ["trust_456"] },
  "createdAt": "2026-03-15T02:00:00Z",
  "updatedAt": "2026-03-15T02:00:00Z"
}`}
          </pre>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Endpoints</h2>
          <div className="space-y-2">
            {RESOURCES.map((r) => (
              <div
                key={r.path}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <code className="text-cyan-300 font-mono">{r.path}</code>
                  <span className="text-xs text-slate-500">scope: {r.scope}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/developers" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Developer Portal
          </Link>
          <Link href="/developers/events" className="text-cyan-400 hover:text-cyan-300 text-sm">
            Event Registry →
          </Link>
        </div>
      </div>
    </div>
  );
}
