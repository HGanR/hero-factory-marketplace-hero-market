"use client";

import { useState } from "react";

/** Platform world ID for Troo Town (must exist in worlds table; run migration 0023) */
export const TROO_TOWN_WORLD_ID = "troo-town";

interface LinkCreateModalProps {
  worldId: string;
  position: [number, number, number];
  onCreated: () => void;
  onCancel: () => void;
}

export function LinkCreateModal({
  worldId,
  position,
  onCreated,
  onCancel,
}: LinkCreateModalProps) {
  const [toWorldId, setToWorldId] = useState(TROO_TOWN_WORLD_ID);
  const [label, setLabel] = useState("Troo Town");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !toWorldId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toWorldId: toWorldId.trim(),
          label: label.trim() || undefined,
          placementJson: {
            position: [position[0], position[1], position[2]],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to create link");
        setSaving(false);
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(360px, 90vw)",
          background: "rgba(10,20,40,0.98)",
          border: "1px solid rgba(78,205,196,0.6)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: "#4ecdc4", margin: "0 0 16px", fontSize: 18 }}>
          New Portal
        </h3>
        <p style={{ color: "rgba(224,244,255,0.6)", fontSize: 12, marginBottom: 16 }}>
          Position: {position[0].toFixed(1)}, {position[1].toFixed(1)}, {position[2].toFixed(1)}
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
          <div style={{ fontSize: 11, color: "rgba(224,244,255,0.6)", marginBottom: 4 }}>
            Quick add:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => { setToWorldId(TROO_TOWN_WORLD_ID); setLabel("Troo Town"); }}
              style={{
                padding: "6px 12px",
                background: toWorldId === TROO_TOWN_WORLD_ID ? "rgba(78,205,196,0.4)" : "rgba(78,205,196,0.2)",
                border: `1px solid ${toWorldId === TROO_TOWN_WORLD_ID ? "#4ecdc4" : "rgba(78,205,196,0.5)"}`,
                borderRadius: 6,
                color: "#a0e8e4",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Troo Town
            </button>
          </div>
          <input
            type="text"
            placeholder="Target world ID *"
            value={toWorldId}
            onChange={(e) => setToWorldId(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(78,205,196,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
            }}
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(78,205,196,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !toWorldId.trim()}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "linear-gradient(135deg, #1a4a4a, #2a8f8f)",
                border: "1px solid rgba(78,205,196,0.5)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
