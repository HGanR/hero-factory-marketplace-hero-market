"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Plus, Trash2 } from "lucide-react";

const TRIGGERS = [
  { value: "certificate_issued", label: "Certificate Issued" },
  { value: "instrument_issued", label: "Instrument Issued" },
  { value: "collateral_pledged", label: "Collateral Pledged" },
  { value: "proceeds_received", label: "Proceeds Received" },
  { value: "entity_created", label: "Entity Created" },
  { value: "accounting_event_processed", label: "Accounting Event Processed" },
  { value: "world_draft_saved", label: "World Draft Saved" },
  { value: "world_published", label: "World Published" },
];

const ACTIONS = [
  { value: "create_accounting_entry", label: "Create Accounting Entry" },
  { value: "send_notification", label: "Send Notification" },
  { value: "generate_resolution", label: "Generate Resolution" },
  { value: "publish_to_inbox", label: "Publish to Event Inbox" },
];

type Workflow = {
  id: string;
  name: string;
  triggerEvent: string;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
  isActive: boolean;
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    triggerEvent: "certificate_issued",
    actions: [{ type: "create_accounting_entry", config: {} }] as Array<{ type: string; config?: Record<string, unknown> }>,
  });

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/developers/workflows", { credentials: "include" });
      const data = await res.json();
      if (data.ok) setWorkflows(data.workflows ?? []);
    } catch {
      setWorkflows([]);
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
      fetchWorkflows();
    } catch {
      router.push("/");
    }
  }, [router, fetchWorkflows]);

  const createWorkflow = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/developers/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          triggerEvent: form.triggerEvent,
          actions: form.actions,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreate(false);
        setForm({ name: "", triggerEvent: "certificate_issued", actions: [{ type: "create_accounting_entry", config: {} }] });
        fetchWorkflows();
      } else {
        alert(data.error ?? "Failed to create workflow");
      }
    } catch {
      alert("Failed to create workflow");
    } finally {
      setCreating(false);
    }
  };

  const addAction = () => {
    setForm((f) => ({ ...f, actions: [...f.actions, { type: "send_notification", config: {} }] }));
  };

  const removeAction = (idx: number) => {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Workflow Automations</h1>
              <p className="text-slate-400">Build automations between platform modules</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <Link href="/developers" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Developer Portal
          </Link>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-medium"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        {showCreate && (
          <div className="mb-8 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
            <h2 className="text-lg font-semibold mb-4">Create Workflow</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Certificate → Accounting"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">When (trigger)</label>
                <select
                  value={form.triggerEvent}
                  onChange={(e) => setForm((f) => ({ ...f, triggerEvent: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Then (actions)</label>
                {form.actions.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <select
                      value={a.type}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          actions: f.actions.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x)),
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                    >
                      {ACTIONS.map((ac) => (
                        <option key={ac.value} value={ac.value}>
                          {ac.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAction(idx)}
                      disabled={form.actions.length <= 1}
                      className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={addAction} className="text-sm text-cyan-400 hover:text-cyan-300">
                  + Add action
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createWorkflow}
                  disabled={creating || !form.name.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-black font-medium"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : workflows.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-slate-950/50 text-center">
            <p className="text-slate-400 mb-4">No workflows yet.</p>
            <p className="text-sm text-slate-500 mb-4">
              Create workflows to automate actions when events occur (e.g. when a certificate is issued, create an accounting entry).
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-medium"
            >
              Create your first workflow
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((w) => (
              <div
                key={w.id}
                className="p-6 rounded-2xl border border-slate-800 bg-slate-950/50 hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{w.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      When <span className="text-cyan-300">{w.triggerEvent}</span> →
                      {(Array.isArray(w.actions) ? w.actions : []).map((a, i) => (
                        <span key={i} className="ml-1 text-amber-300">
                          {typeof a === "object" && a?.type ? a.type : String(a)}
                          {i < (w.actions?.length ?? 0) - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {w.runCount} runs
                      {w.lastRunAt ? ` · Last run ${new Date(w.lastRunAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      w.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {w.isActive ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
