"use client";

import { useCallback, useEffect, useState } from "react";

const ACC = "#a78bfa";

type RuleRow = {
  id: string;
  name: string;
  isActive: boolean;
  conditionsJson: unknown;
  actionsJson: unknown;
  conditionsLine: string;
  actionsLine: string;
};

const INTENTS = ["", "lead", "question", "complaint", "booking", "spam", "praise", "unclear"] as const;
const SENTS = ["", "positive", "neutral", "negative"] as const;
const SRC = ["", "comment", "dm", "mention", "reply", "ad_comment", "unknown"] as const;

function buildPayload(args: {
  kw: string;
  intent: string;
  sentiment: string;
  source: string;
  addLabel: string;
  addLabelName: string;
  assignRole: string;
  attachBentley: boolean;
}): { conditionsJson: object; actionsJson: object } {
  const conditions: Record<string, unknown> = {};
  const kw = args.kw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (kw.length) {
    conditions.keywordsAny = kw;
  }
  if (args.intent) {
    conditions.intentEquals = args.intent;
  }
  if (args.sentiment) {
    conditions.sentimentEquals = args.sentiment;
  }
  if (args.source) {
    conditions.sourceTypeEquals = args.source;
  }
  const actions: Record<string, unknown> = {};
  if (args.addLabel.trim()) {
    actions.addLabelSlug = args.addLabel.trim();
  }
  if (args.addLabelName.trim()) {
    actions.addLabelDisplayName = args.addLabelName.trim();
  }
  if (args.assignRole.trim()) {
    actions.assignRole = args.assignRole.trim();
  }
  if (args.attachBentley) {
    actions.attachBentleySuggestion = true;
  }
  return { conditionsJson: conditions, actionsJson: actions };
}

export function RevenueOsInboxRulesPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<RuleRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [kw, setKw] = useState("");
  const [intent, setIntent] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [source, setSource] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addLabelName, setAddLabelName] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [attachBentley, setAttachBentley] = useState(false);
  const [editing, setEditing] = useState<RuleRow | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/revenue-os/inbox/rules?clientId=${encodeURIComponent(clientId)}`);
      const j = (await r.json()) as { items?: RuleRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "load failed");
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(r: RuleRow) {
    setEditing(r);
    setName(r.name);
    const c = (r.conditionsJson ?? {}) as Record<string, unknown>;
    const a = (r.actionsJson ?? {}) as Record<string, unknown>;
    setKw(Array.isArray(c.keywordsAny) ? (c.keywordsAny as string[]).join(", ") : "");
    setIntent(typeof c.intentEquals === "string" ? c.intentEquals : "");
    setSentiment(typeof c.sentimentEquals === "string" ? c.sentimentEquals : "");
    setSource(typeof c.sourceTypeEquals === "string" ? c.sourceTypeEquals : "");
    setAddLabel(typeof a.addLabelSlug === "string" ? a.addLabelSlug : "");
    setAddLabelName(typeof a.addLabelDisplayName === "string" ? a.addLabelDisplayName : "");
    setAssignRole(typeof a.assignRole === "string" ? a.assignRole : "");
    setAttachBentley(a.attachBentleySuggestion === true);
  }

  function clearForm() {
    setEditing(null);
    setName("");
    setKw("");
    setIntent("");
    setSentiment("");
    setSource("");
    setAddLabel("");
    setAddLabelName("");
    setAssignRole("");
    setAttachBentley(false);
  }

  async function createRule() {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    const { conditionsJson, actionsJson } = buildPayload({
      kw,
      intent,
      sentiment,
      source,
      addLabel,
      addLabelName,
      assignRole,
      attachBentley,
    });
    setErr(null);
    const r = await fetch("/api/revenue-os/inbox/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        name: name.trim(),
        conditionsJson,
        actionsJson,
        isActive: true,
      }),
    });
    const j = (await r.json()) as { error?: string; ok?: boolean };
    if (!r.ok) {
      setErr(j.error ?? "Create failed");
      return;
    }
    clearForm();
    void load();
  }

  async function saveEdit() {
    if (!editing) return;
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    const { conditionsJson, actionsJson } = buildPayload({
      kw,
      intent,
      sentiment,
      source,
      addLabel,
      addLabelName,
      assignRole,
      attachBentley,
    });
    setErr(null);
    const r = await fetch(`/api/revenue-os/inbox/rules/${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        conditionsJson,
        actionsJson,
      }),
    });
    const j = (await r.json()) as { error?: string; ok?: boolean };
    if (!r.ok) {
      setErr(j.error ?? "Save failed");
      return;
    }
    clearForm();
    void load();
  }

  async function toggle(id: string, isActive: boolean) {
    setErr(null);
    const r = await fetch(`/api/revenue-os/inbox/rules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (r.ok) {
      void load();
    } else {
      const j = (await r.json()) as { error?: string };
      setErr(j.error ?? "Toggle failed");
    }
  }

  async function del(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this rule?")) {
      return;
    }
    setErr(null);
    const r = await fetch(`/api/revenue-os/inbox/rules/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) {
      if (editing?.id === id) {
        clearForm();
      }
      void load();
    } else {
      const j = (await r.json()) as { error?: string };
      setErr(j.error ?? "Delete failed");
    }
  }

  return (
    <div
      className="rounded-2xl border border-violet-500/30 bg-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.12)]"
      data-testid="inbox-rules-panel"
    >
      <h2 className="text-lg font-semibold mb-1" style={{ color: ACC }}>
        Inbox rules (ingest)
      </h2>
      <p className="text-xs text-amber-200/90 border border-amber-500/25 rounded px-2 py-1 mb-3 max-w-3xl" data-testid="inbox-rules-manual-only">
        <strong>Manual-only — no auto-send.</strong> Rules add labels, assignments, and Bentley draft suggestions on ingest. They do not post
        replies or DMs in this pass.
      </p>
      {err && <p className="text-sm text-red-400 mb-2">{err}</p>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 text-xs">
        <div className="space-y-2">
          <p className="text-slate-500 font-medium">Existing rules{loading ? " (loading…)" : ""}</p>
          {items.length === 0 && !loading ? <p className="text-slate-600">No rules yet for this client.</p> : null}
          <ul className="space-y-2 max-h-[360px] overflow-y-auto" data-testid="inbox-rules-list">
            {items.map((r) => (
              <li
                key={r.id}
                className="rounded border border-slate-800 bg-slate-950/50 p-2"
                data-testid={`inbox-rule-row-${r.id}`}
              >
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <div className="text-slate-200 font-medium">
                      {r.name}{" "}
                      <span className="text-slate-500 font-normal">({r.isActive ? "on" : "off"})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">If: {r.conditionsLine}</p>
                    <p className="text-[10px] text-slate-500">Then: {r.actionsLine}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggle(r.id, r.isActive)}
                      className="text-[10px] text-cyan-300 underline"
                      data-testid={`inbox-rule-toggle-${r.id}`}
                    >
                      {r.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="text-[10px] text-slate-200 underline"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => void del(r.id)} className="text-[10px] text-slate-500 underline">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-slate-800 p-3 space-y-2 bg-slate-950/80" data-testid="inbox-rules-form">
          <p className="text-slate-400 font-medium">{editing ? "Edit rule" : "New rule"}</p>
          <label className="block">
            <span className="text-slate-500">Name</span>
            <input
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-slate-500">Keywords (any, comma)</span>
            <input
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-1">
            <label className="text-slate-500">
              Intent
              <select
                className="ml-2 rounded border border-slate-700 bg-slate-900/80 text-slate-200"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                {INTENTS.map((x) => (
                  <option key={x || "—"} value={x}>
                    {x || "— any —"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-slate-500">
              Sentiment
              <select
                className="ml-2 rounded border border-slate-700 bg-slate-900/80 text-slate-200"
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
              >
                {SENTS.map((x) => (
                  <option key={x || "—"} value={x}>
                    {x || "— any —"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-slate-500">
              Source
              <select
                className="ml-2 rounded border border-slate-700 bg-slate-900/80 text-slate-200"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SRC.map((x) => (
                  <option key={x || "—"} value={x}>
                    {x || "— any —"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-slate-600">At least one condition (e.g. keyword) is required.</p>
          <label className="block">
            <span className="text-slate-500">Add label (slug)</span>
            <input
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-slate-500">Label display (optional)</span>
            <input
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200"
              value={addLabelName}
              onChange={(e) => setAddLabelName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-slate-500">Assign role (optional)</span>
            <input
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200"
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-slate-400">
            <input type="checkbox" checked={attachBentley} onChange={(e) => setAttachBentley(e.target.checked)} />
            Attach Bentley suggestion
          </label>
          <div className="flex gap-2 pt-1">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  className="rounded border border-violet-500/50 px-2 py-1 text-violet-200"
                >
                  Save
                </button>
                <button type="button" onClick={() => clearForm()} className="rounded border border-slate-700 px-2 py-1 text-slate-400">
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void createRule()}
                className="rounded border border-violet-500/50 px-2 py-1 text-violet-200"
              >
                Create rule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
