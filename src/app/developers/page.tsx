"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  Key,
  Webhook,
  Store,
  BarChart3,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Zap,
} from "lucide-react";

type ApiKey = { id: string; name: string; keyPrefix: string; lastUsedAt?: string; createdAt: string };
type WebhookRow = { id: string; url: string; events: string[]; isActive: boolean; lastTriggeredAt?: string; lastStatus?: number; createdAt: string };
type WorkflowRow = { id: string; name: string; triggerEvent: string; actions: unknown[]; isActive: boolean; runCount: number; createdAt: string };

export default function DeveloperPortalPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read:trusts", "read:assets", "read:instruments", "read:events", "read:workflows"]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

  const API_SCOPES = [
    "read:trusts",
    "write:trusts",
    "read:assets",
    "write:assets",
    "read:instruments",
    "write:instruments",
    "read:events",
    "read:workflows",
    "write:workflows",
    "read:accounting",
    "write:accounting",
    "read:worlds",
    "write:worlds",
    "read:apps",
    "write:apps",
    "read:commerce",
    "write:commerce",
  ];
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["certificate_issued"]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const WEBHOOK_EVENTS = [
    "certificate_issued",
    "instrument_issued",
    "collateral_pledged",
    "proceeds_received",
    "accounting_event_processed",
    "world_draft_saved",
    "world_published",
    "commerce_node_created",
    "commerce_transaction",
    "app_published",
    "app_installed",
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, webhooksRes, workflowsRes] = await Promise.all([
        fetch("/api/developers/api-keys", { credentials: "include" }),
        fetch("/api/developers/webhooks", { credentials: "include" }),
        fetch("/api/developers/workflows", { credentials: "include" }),
      ]);
      const keysData = await keysRes.json();
      const webhooksData = await webhooksRes.json();
      const workflowsData = await workflowsRes.json();
      if (keysData.ok) setApiKeys(keysData.keys ?? []);
      if (webhooksData.ok) setWebhooks(webhooksData.webhooks ?? []);
      if (workflowsData.ok) setWorkflows(workflowsData.workflows ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) {
        router.push("/");
        return;
      }
      setIsLoggedIn(true);
      fetchData();
    } catch {
      router.push("/");
    } finally {
      setIsChecking(false);
    }
  }, [router, fetchData]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/developers/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
      });
      const data = await res.json();
      if (data.ok && data.key?.rawKey) {
        setNewKeyRaw(data.key.rawKey);
        setNewKeyName("");
        setNewKeyScopes(["read:trusts", "read:assets", "read:instruments", "read:events", "read:workflows"]);
        fetchData();
      } else {
        alert(data.error ?? "Failed to create key");
      }
    } catch {
      alert("Failed to create key");
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key? It will stop working immediately.")) return;
    try {
      await fetch(`/api/developers/api-keys/${id}`, { method: "DELETE", credentials: "include" });
      fetchData();
    } catch {
      alert("Failed to delete key");
    }
  };

  const copyKey = () => {
    if (newKeyRaw) {
      navigator.clipboard.writeText(newKeyRaw);
      alert("Copied to clipboard");
    }
  };

  const createWebhook = async () => {
    const url = newWebhookUrl.trim();
    if (!url || !url.startsWith("https://")) {
      alert("Enter a valid HTTPS URL");
      return;
    }
    setCreatingWebhook(true);
    try {
      const res = await fetch("/api/developers/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, events: newWebhookEvents }),
      });
      const data = await res.json();
      if (data.ok && data.webhook?.secret) {
        setNewWebhookSecret(data.webhook.secret);
        setNewWebhookUrl("");
        setNewWebhookEvents(["certificate_issued"]);
        fetchData();
      } else {
        alert(data.error ?? "Failed to create webhook");
      }
    } catch {
      alert("Failed to create webhook");
    } finally {
      setCreatingWebhook(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook? It will stop receiving events.")) return;
    try {
      await fetch(`/api/developers/webhooks/${id}`, { method: "DELETE", credentials: "include" });
      fetchData();
    } catch {
      alert("Failed to delete webhook");
    }
  };

  const toggleWebhookEvent = (event: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const copyWebhookSecret = () => {
    if (newWebhookSecret) {
      navigator.clipboard.writeText(newWebhookSecret);
      alert("Copied to clipboard");
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Developer Portal</h1>
              <p className="text-slate-400">Build, publish, and monetize on the Web3 Business Infrastructure OS</p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="mb-12 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/platform-map" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              <ExternalLink className="w-4 h-4" />
              Platform Map
            </Link>
            <Link href="/app/agents" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              <ExternalLink className="w-4 h-4" />
              AI Agency
            </Link>
            <Link href="/trust-records" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              <ExternalLink className="w-4 h-4" />
              Trust Records API
            </Link>
            <Link href="/workflows" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              <Zap className="w-4 h-4" />
              Workflow Automations
            </Link>
            <Link href="/developers/events" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              Event Registry
            </Link>
            <Link href="/platform/events" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              Platform Activity
            </Link>
            <Link href="/developers/api" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/30">
              Platform API v1
            </Link>
            <Link href="/apps" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              <Store className="w-4 h-4" />
              App Marketplace
            </Link>
            <Link href="/developers/apps" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
              <Store className="w-4 h-4" />
              My Apps
            </Link>
          </div>
        </div>

        {/* New key modal */}
        {newKeyRaw && (
          <div className="mb-8 p-6 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10">
            <h3 className="text-lg font-semibold text-amber-200 mb-2">Save your API key</h3>
            <p className="text-sm text-slate-400 mb-3">You won&apos;t be able to see this again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-cyan-300 font-mono text-sm break-all">
                {newKeyRaw}
              </code>
              <button onClick={copyKey} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => setNewKeyRaw(null)} className="mt-3 text-sm text-cyan-400 hover:text-cyan-300">
              I&apos;ve saved it
            </button>
          </div>
        )}

        {/* API Keys */}
        <div id="api-keys" className="mb-12 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-cyan-400" />
              API Keys
            </h2>
            <p className="text-sm text-slate-400 mb-3">Use API keys to access the Platform API at <code className="text-cyan-300">/api/v1</code></p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Key name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 w-40"
              />
              <button
                onClick={createKey}
                disabled={creatingKey || !newKeyName.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-black font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Key
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {API_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes(s)}
                    onChange={() =>
                      setNewKeyScopes((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )
                    }
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500"
                  />
                  <span className="text-slate-300">{s}</span>
                </label>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-slate-500 text-sm">No API keys yet. Create one to access the platform APIs.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{k.keyPrefix}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                    <button onClick={() => deleteKey(k.id)} className="p-1 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New webhook secret modal */}
        {newWebhookSecret && (
          <div className="mb-8 p-6 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10">
            <h3 className="text-lg font-semibold text-amber-200 mb-2">Save your webhook secret</h3>
            <p className="text-sm text-slate-400 mb-3">You won&apos;t be able to see this again. Use it to verify webhook signatures.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-cyan-300 font-mono text-sm break-all">
                {newWebhookSecret}
              </code>
              <button onClick={copyWebhookSecret} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => setNewWebhookSecret(null)} className="mt-3 text-sm text-cyan-400 hover:text-cyan-300">
              I&apos;ve saved it
            </button>
          </div>
        )}

        {/* Webhooks */}
        <div id="webhooks" className="mb-12 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Webhook className="w-5 h-5 text-cyan-400" />
              Webhooks
            </h2>
          </div>
          <div className="mb-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <label className="block text-sm text-slate-400 mb-2">Add webhook endpoint (HTTPS)</label>
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                type="url"
                placeholder="https://your-server.com/webhooks"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              <button
                onClick={createWebhook}
                disabled={creatingWebhook || !newWebhookUrl.trim().startsWith("https://")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-black font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Webhook
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newWebhookEvents.includes(ev)}
                    onChange={() => toggleWebhookEvent(ev)}
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500"
                  />
                  <span className="text-slate-300">{ev}</span>
                </label>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-slate-500 text-sm">No webhooks. Add one to receive platform events at your endpoint.</p>
          ) : (
            <div className="space-y-2">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{w.url}</p>
                    <p className="text-xs text-slate-500">{w.events.join(", ")}</p>
                    {w.lastTriggeredAt && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Last triggered {new Date(w.lastTriggeredAt).toLocaleString()}
                        {w.lastStatus != null && ` · HTTP ${w.lastStatus}`}
                      </p>
                    )}
                  </div>
                  <button onClick={() => deleteWebhook(w.id)} className="p-1 text-red-400 hover:text-red-300 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workflows */}
        <div id="workflows" className="mb-12 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Workflow Automations
            </h2>
            <Link href="/workflows" className="text-sm text-cyan-400 hover:text-cyan-300">
              Manage workflows →
            </Link>
          </div>
          {workflows.length === 0 ? (
            <p className="text-slate-500 text-sm">No workflows. Create automations to run actions when events occur.</p>
          ) : (
            <div className="space-y-2">
              {workflows.map((w) => (
                <Link key={w.id} href="/workflows" className="block p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-slate-500">
                    When {w.triggerEvent} → {w.actions?.length ?? 0} action(s) · {w.runCount} runs
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* SDK downloads */}
        <div className="mb-12 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download className="w-5 h-5" />
            SDK Downloads
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Plugin SDK, Agent SDK, and API client libraries will be available when the developer platform launches.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 text-sm">Plugin SDK</span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 text-sm">Agent SDK</span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 text-sm">REST API Client</span>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
