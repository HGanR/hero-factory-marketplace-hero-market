"use client";

import { useState, useEffect } from "react";

export type CommerceNodeType =
  | "store"
  | "service"
  | "consultation"
  | "ad_space"
  | "product_display"
  | "event_space"
  | "course"
  | "npc_service";

export interface CommerceNode {
  id: string;
  worldId: string;
  ownerId: number;
  nodeType: string;
  placementJson: unknown;
  title: string;
  description?: string | null;
  priceToken?: number | null;
  priceUSD?: number | null;
  revenueShare?: number | null;
  status: string;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  store: "Store",
  service: "Service",
  consultation: "Consultation",
  ad_space: "Ad Space",
  product_display: "Product Display",
  event_space: "Event Space",
  course: "Course",
  npc_service: "NPC Service",
};

interface CommerceEditorPanelProps {
  worldId: string;
  nodes: CommerceNode[];
  selectedNodeId: string | null;
  addingCommerce: boolean;
  onSelectNode: (id: string | null) => void;
  onAddingCommerce: (adding: boolean) => void;
  onNodesChange: () => void;
  /** When true, renders without absolute positioning (for nav dropdown) */
  embedded?: boolean;
}

export function CommerceEditorPanel({
  worldId,
  nodes,
  selectedNodeId,
  addingCommerce,
  onSelectNode,
  onAddingCommerce,
  onNodesChange,
  embedded,
}: CommerceEditorPanelProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<
    Array<{
      id: string;
      amountToken?: number | null;
      amountUSD?: number | null;
      ownerAmountToken?: number | null;
      ownerAmountUSD?: number | null;
      createdAt?: string;
    }>
  >([]);
  const [txSummary, setTxSummary] = useState<{
    count: number;
    totalOwnerToken: number;
    totalOwnerUSD: number;
  } | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [apiKeyGenerating, setApiKeyGenerating] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  async function handleGenerateApiKey() {
    if (!worldId || !selectedNodeId || apiKeyGenerating) return;
    setApiKeyGenerating(true);
    setGeneratedApiKey(null);
    try {
      const res = await fetch(
        `/api/worlds/${worldId}/buildings/${encodeURIComponent(selectedNodeId)}/api-key`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to generate API key");
        return;
      }
      const key = data.apiKey;
      setGeneratedApiKey(key);
      await navigator.clipboard.writeText(key);
    } catch {
      setError("Network error");
    } finally {
      setApiKeyGenerating(false);
    }
  }

  useEffect(() => {
    if (!selectedNodeId || !worldId) {
      setTransactions([]);
      setTxSummary(null);
      return;
    }
    setTxLoading(true);
    fetch(`/api/worlds/${worldId}/commerce/${selectedNodeId}/transactions`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : { transactions: [], summary: null }))
      .then((data) => {
        setTransactions(data.transactions ?? []);
        setTxSummary(data.summary ?? null);
      })
      .catch(() => {
        setTransactions([]);
        setTxSummary(null);
      })
      .finally(() => setTxLoading(false));
  }, [worldId, selectedNodeId]);

  async function handleUpdate(fields: {
    title?: string;
    nodeType?: string;
    description?: string;
    priceToken?: number | null;
    priceUSD?: number | null;
    revenueShare?: number | null;
  }) {
    if (!selectedNodeId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/commerce/${selectedNodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to update");
        return;
      }
      onNodesChange();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedNodeId || saving) return;
    if (!confirm("Delete this commerce node?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/commerce/${selectedNodeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to delete");
        return;
      }
      onSelectNode(null);
      onNodesChange();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const wrapperStyle: React.CSSProperties = embedded
    ? { width: 300, fontFamily: "system-ui, sans-serif" }
    : {
        position: "absolute",
        top: 60,
        left: 224,
        width: 220,
        maxHeight: "calc(100vh - 140px)",
        background: "rgba(10,20,40,0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(42,111,189,0.5)",
        borderRadius: 12,
        padding: 12,
        overflowY: "auto",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
      };

  return (
    <div style={wrapperStyle}>
      {!embedded && (
        <div style={{ fontWeight: 700, color: "#e0f4ff", marginBottom: 8, fontSize: 13 }}>
          Commerce
        </div>
      )}

      <button
        onClick={() => {
          onAddingCommerce(!addingCommerce);
          if (addingCommerce) onSelectNode(null);
        }}
        title={addingCommerce ? "Click on the terrain to place a commerce node" : "Add a new commerce node"}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: addingCommerce ? "rgba(16,185,129,0.4)" : "rgba(42,111,189,0.3)",
          border: `1px solid ${addingCommerce ? "#10b981" : "rgba(42,111,189,0.5)"}`,
          borderRadius: 8,
          color: addingCommerce ? "#6ee7b7" : "#a0d4ff",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        {addingCommerce ? "Click terrain to place" : "+ Add Commerce Node"}
      </button>

      {nodes.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(224,244,255,0.6)", marginBottom: 6 }}>
            Nodes ({nodes.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  onSelectNode(n.id);
                  onAddingCommerce(false);
                }}
                style={{
                  padding: "6px 10px",
                  background: selectedNodeId === n.id ? "rgba(42,111,189,0.5)" : "rgba(20,40,80,0.6)",
                  border: `1px solid ${selectedNodeId === n.id ? "#5a9fd4" : "rgba(42,111,189,0.3)"}`,
                  borderRadius: 6,
                  color: "#e0f4ff",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {n.title || (NODE_TYPE_LABELS[n.nodeType] ?? n.nodeType)}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedNode && !addingCommerce && (
        <div
          style={{
            borderTop: "1px solid rgba(42,111,189,0.3)",
            paddingTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(224,244,255,0.8)", fontWeight: 600 }}>
            Edit node
          </div>
          <div style={{ fontSize: 10, color: "rgba(224,244,255,0.5)" }}>
            Click terrain to move
          </div>
          {error && <div style={{ color: "#f87171", fontSize: 11 }}>{error}</div>}
          <input
            type="text"
            placeholder="Title"
            defaultValue={selectedNode.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== selectedNode.title) handleUpdate({ title: v });
            }}
            style={{
              padding: "6px 10px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 6,
              color: "#e0f4ff",
              fontSize: 12,
            }}
          />
          <select
            defaultValue={selectedNode.nodeType}
            onChange={(e) => handleUpdate({ nodeType: e.target.value })}
            style={{
              padding: "6px 10px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 6,
              color: "#e0f4ff",
              fontSize: 12,
            }}
          >
            {Object.entries(NODE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k} style={{ background: "#0a1628" }}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Price (tokens)"
            defaultValue={selectedNode.priceToken ?? ""}
            onBlur={(e) => {
              const v = e.target.value ? parseInt(e.target.value, 10) : null;
              if (v !== selectedNode.priceToken) handleUpdate({ priceToken: v });
            }}
            style={{
              padding: "6px 10px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 6,
              color: "#e0f4ff",
              fontSize: 12,
            }}
          />
          <input
            type="number"
            placeholder="Price (USD cents)"
            defaultValue={selectedNode.priceUSD ?? ""}
            onBlur={(e) => {
              const v = e.target.value ? parseInt(e.target.value, 10) : null;
              if (v !== selectedNode.priceUSD) handleUpdate({ priceUSD: v });
            }}
            style={{
              padding: "6px 10px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 6,
              color: "#e0f4ff",
              fontSize: 12,
            }}
          />
          <div
            style={{
              borderTop: "1px solid rgba(42,111,189,0.3)",
              paddingTop: 10,
              marginTop: 4,
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(224,244,255,0.6)", marginBottom: 6 }}>
              Link AI Agent
            </div>
            <div style={{ fontSize: 10, color: "rgba(224,244,255,0.5)", marginBottom: 6 }}>
              Generate an API key to link your AI Agency agent to this commerce node.
            </div>
            <button
              onClick={handleGenerateApiKey}
              disabled={apiKeyGenerating}
              style={{
                padding: "6px 10px",
                background: "rgba(78,205,196,0.2)",
                border: "1px solid rgba(78,205,196,0.5)",
                borderRadius: 6,
                color: "#a0e8e4",
                fontSize: 11,
                cursor: apiKeyGenerating ? "wait" : "pointer",
                width: "100%",
              }}
            >
              {apiKeyGenerating ? "Generating..." : "Generate API Key"}
            </button>
            {generatedApiKey && (
              <div style={{ marginTop: 8, fontSize: 10, color: "rgba(224,244,255,0.8)" }}>
                <div style={{ marginBottom: 4 }}>API key (copied to clipboard):</div>
                <code
                  style={{
                    display: "block",
                    padding: 6,
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 4,
                    fontSize: 10,
                    wordBreak: "break-all",
                  }}
                >
                  {generatedApiKey}
                </code>
                <div style={{ marginTop: 4, color: "rgba(224,244,255,0.5)" }}>
                  Paste this in AI Agency → Deploy → Link to World Building
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDelete}
            disabled={saving}
            style={{
              padding: "6px 10px",
              background: "rgba(239,68,68,0.3)",
              border: "1px solid rgba(239,68,68,0.5)",
              borderRadius: 6,
              color: "#fca5a5",
              fontSize: 11,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "..." : "Delete"}
          </button>

          {(txSummary || txLoading) && (
            <div
              style={{
                borderTop: "1px solid rgba(42,111,189,0.3)",
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(224,244,255,0.8)", fontWeight: 600, marginBottom: 6 }}>
                Transactions
              </div>
              {txLoading ? (
                <div style={{ fontSize: 10, color: "rgba(224,244,255,0.5)" }}>Loading...</div>
              ) : txSummary ? (
                <>
                  <div style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", marginBottom: 6 }}>
                    {txSummary.count} sales • {txSummary.totalOwnerToken > 0 && `${txSummary.totalOwnerToken} tokens`}
                    {txSummary.totalOwnerToken > 0 && txSummary.totalOwnerUSD > 0 && " • "}
                    {txSummary.totalOwnerUSD > 0 && `$${(txSummary.totalOwnerUSD / 100).toFixed(2)}`}
                  </div>
                  {transactions.length > 0 && (
                    <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 10 }}>
                      {transactions.slice(0, 10).map((t) => (
                        <div
                          key={t.id}
                          style={{
                            padding: "4px 0",
                            borderBottom: "1px solid rgba(42,111,189,0.2)",
                            color: "rgba(224,244,255,0.8)",
                          }}
                        >
                          {(t.ownerAmountToken ?? 0) > 0 && `${t.ownerAmountToken} tokens`}
                          {(t.ownerAmountToken ?? 0) > 0 && (t.ownerAmountUSD ?? 0) > 0 && " • "}
                          {(t.ownerAmountUSD ?? 0) > 0 && `$${((t.ownerAmountUSD ?? 0) / 100).toFixed(2)}`}
                          {t.createdAt && (
                            <span style={{ color: "rgba(224,244,255,0.5)", marginLeft: 4 }}>
                              {new Date(t.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
