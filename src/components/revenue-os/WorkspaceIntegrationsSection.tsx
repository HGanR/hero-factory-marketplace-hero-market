"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link2, Trash2, ChevronDown, ChevronUp, AlertCircle, Pencil } from "lucide-react";

const ACCENT = "#00D1FF";

const PROVIDERS = [
  { value: "google_analytics", label: "Google Analytics" },
  { value: "ga4", label: "GA4 (Google Analytics 4)" },
  { value: "stripe", label: "Stripe" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "mailchimp", label: "Mailchimp" },
  { value: "custom", label: "Custom endpoint" },
] as const;

type WorkspaceApiItem = {
  id: string;
  provider: string;
  label: string | null;
  endpointUrl: string | null;
  costAcknowledgmentAt: string | null;
  createdAt: string;
  hasApiKey: boolean;
};

export interface WorkspaceIntegrationsSectionProps {
  userId: string;
  clientId: string;
  trustId: string;
}

export function WorkspaceIntegrationsSection({
  userId,
  clientId,
  trustId,
}: WorkspaceIntegrationsSectionProps) {
  const [items, setItems] = useState<WorkspaceApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [addExpanded, setAddExpanded] = useState(false);
  const [addProvider, setAddProvider] = useState("google_analytics");
  const [addLabel, setAddLabel] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [addEndpointUrl, setAddEndpointUrl] = useState("");
  const [costAcknowledged, setCostAcknowledged] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editEndpointUrl, setEditEndpointUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const workspaceLabel = useMemo(() => {
    const parts = [];
    if (clientId) parts.push(`Client ${clientId.slice(0, 8)}…`);
    if (trustId) parts.push(`Trust ${trustId.slice(0, 8)}…`);
    return parts.length ? parts.join(" · ") : "Standalone";
  }, [clientId, trustId]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      if (trustId) params.set("trustId", trustId);
      const r = await fetch(`/api/revenue-os/workspace-apis?${params.toString()}`, {
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      setItems(data?.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, trustId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAdd() {
    if (!costAcknowledged) {
      setAddError("You must acknowledge that all API costs are your responsibility.");
      return;
    }
    if (!addApiKey.trim()) {
      setAddError("API key or secret is required.");
      return;
    }

    setAddBusy(true);
    setAddError(null);
    try {
      const r = await fetch("/api/revenue-os/workspace-apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId: clientId || undefined,
          trustId: trustId || undefined,
          provider: addProvider,
          label: addLabel.trim() || undefined,
          apiKey: addApiKey.trim(),
          endpointUrl: addEndpointUrl.trim() || undefined,
          costAcknowledged: true,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = r.status === 401 ? "Sign in to add integrations." : (data?.error ?? "Failed to add");
        throw new Error(msg);
      }

      setAddApiKey("");
      setAddLabel("");
      setAddEndpointUrl("");
      setCostAcknowledged(false);
      setAddExpanded(false);
      fetchItems();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add integration");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteBusy(id);
    try {
      const r = await fetch(`/api/revenue-os/workspace-apis/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to remove");
      setEditingId(null);
      fetchItems();
    } catch {
      // ignore
    } finally {
      setDeleteBusy(null);
    }
  }

  function startEdit(item: WorkspaceApiItem) {
    setEditingId(item.id);
    setEditLabel(item.label || "");
    setEditApiKey("");
    setEditEndpointUrl(item.endpointUrl || "");
    setEditError(null);
  }

  async function handleEdit() {
    const id = editingId;
    if (!id) return;
    const payload: Record<string, unknown> = {};
    if (editLabel.trim() !== (items.find((i) => i.id === id)?.label || "")) payload.label = editLabel.trim() || null;
    if (editApiKey.trim()) payload.apiKey = editApiKey.trim();
    if (items.find((i) => i.id === id)?.endpointUrl !== (editEndpointUrl.trim() || null)) {
      payload.endpointUrl = editEndpointUrl.trim() || null;
    }
    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const r = await fetch(`/api/revenue-os/workspace-apis/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error ?? "Update failed");
      setEditingId(null);
      setEditLabel("");
      setEditApiKey("");
      setEditEndpointUrl("");
      fetchItems();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", borderColor: ACCENT }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: ACCENT }}>
            API Integrations (Optional)
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Add your own API keys to enhance this workspace. The system works fully without them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded text-gray-400 hover:text-white"
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-6 space-y-4">
          <div
            className="rounded-xl border p-4 text-sm"
            style={{ borderColor: "rgba(212, 175, 55, 0.3)", backgroundColor: "rgba(0,0,0,0.3)" }}
          >
            <p className="text-gray-300">
              Would you like to connect an API to this workspace? Insert your credentials below.
              Integrations are specific to this workspace and your account. You must add APIs
              separately for each workspace. All usage, quotas, and costs are your responsibility.
            </p>
            <p className="text-gray-500 mt-2 text-xs">
              Scope: <span className="font-mono text-gray-400">{workspaceLabel}</span>
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Connected</div>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    {editingId === item.id ? (
                      <div
                        className="rounded-lg border p-4 space-y-3"
                        style={{ borderColor: "rgba(212, 175, 55, 0.3)" }}
                      >
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Label</label>
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="e.g. Production Stripe"
                            className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                            style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">API Key (leave blank to keep current)</label>
                          <input
                            type="password"
                            value={editApiKey}
                            onChange={(e) => setEditApiKey(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                            style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                          />
                        </div>
                        {(item.provider === "custom" || item.endpointUrl != null) && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Endpoint URL</label>
                            <input
                              type="url"
                              value={editEndpointUrl}
                              onChange={(e) => setEditEndpointUrl(e.target.value)}
                              placeholder="https://api.example.com"
                              className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                              style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                            />
                          </div>
                        )}
                        {editError && (
                          <div className="flex items-center gap-2 text-sm text-red-400">
                            <AlertCircle size={14} />
                            {editError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleEdit}
                            disabled={editBusy}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                            style={{ backgroundColor: ACCENT, color: "black" }}
                          >
                            {editBusy ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingId(null); setEditError(null); }}
                            className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-between rounded-lg border py-2 px-3"
                        style={{ borderColor: "rgba(212, 175, 55, 0.2)" }}
                      >
                        <div className="flex items-center gap-2">
                          <Link2 size={14} className="text-gray-500" />
                          <span className="font-medium">{item.label || (PROVIDERS.find((p) => p.value === item.provider)?.label ?? item.provider)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded text-gray-400 hover:text-amber-400 hover:bg-amber-900/20"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteBusy === item.id}
                            className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {addExpanded ? (
            <div
              className="rounded-xl border p-4 space-y-4"
              style={{ borderColor: "rgba(212, 175, 55, 0.3)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Add integration</span>
                <button
                  type="button"
                  onClick={() => setAddExpanded(false)}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Provider</label>
                <select
                  value={addProvider}
                  onChange={(e) => setAddProvider(e.target.value)}
                  className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="e.g. Production Stripe"
                  className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">API Key / Secret</label>
                <input
                  type="password"
                  value={addApiKey}
                  onChange={(e) => setAddApiKey(e.target.value)}
                  placeholder="Insert your API key here"
                  autoComplete="new-password"
                  className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                />
              </div>

              {addProvider === "custom" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Endpoint URL</label>
                  <input
                    type="url"
                    value={addEndpointUrl}
                    onChange={(e) => setAddEndpointUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full rounded-lg border bg-black/50 px-3 py-2 text-sm"
                    style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
                  />
                </div>
              )}

              <div className="flex items-start gap-2">
                <input
                  id="cost-ack"
                  type="checkbox"
                  checked={costAcknowledged}
                  onChange={(e) => setCostAcknowledged(e.target.checked)}
                  className="mt-1 rounded"
                />
                <label htmlFor="cost-ack" className="text-xs text-gray-400">
                  I understand that all API usage, quotas, and costs are my sole responsibility.
                  The platform does not assume any third-party service charges. I add this
                  integration at my own discretion.
                </label>
              </div>

              {addError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle size={14} />
                  {addError}
                </div>
              )}

              <button
                type="button"
                onClick={handleAdd}
                disabled={addBusy || !costAcknowledged || !addApiKey.trim()}
                className="px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: costAcknowledged && addApiKey.trim() ? ACCENT : "rgba(0, 209, 255, 0.3)",
                  color: "black",
                }}
              >
                {addBusy ? "Adding…" : "Add to this workspace"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddExpanded(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: ACCENT, color: ACCENT }}
            >
              <Link2 size={14} />
              Add API integration
            </button>
          )}
        </div>
      )}
    </div>
  );
}
