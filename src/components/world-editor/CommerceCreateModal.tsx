"use client";

import { useState } from "react";

const NODE_TYPE_OPTIONS = [
  { value: "store", label: "Store" },
  { value: "service", label: "Service" },
  { value: "consultation", label: "Consultation" },
  { value: "ad_space", label: "Ad Space" },
  { value: "product_display", label: "Product Display" },
  { value: "event_space", label: "Event Space" },
  { value: "course", label: "Course" },
  { value: "npc_service", label: "NPC Service" },
];

interface CommerceCreateModalProps {
  worldId: string;
  position: [number, number, number];
  onCreated: () => void;
  onCancel: () => void;
}

export function CommerceCreateModal({
  worldId,
  position,
  onCreated,
  onCancel,
}: CommerceCreateModalProps) {
  const [title, setTitle] = useState("");
  const [nodeType, setNodeType] = useState("store");
  const [priceToken, setPriceToken] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/commerce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nodeType,
          title: title.trim() || "Commerce Node",
          description: description.trim() || undefined,
          priceToken: priceToken ? parseInt(priceToken, 10) : undefined,
          priceUSD: priceUSD ? parseInt(priceUSD, 10) : undefined,
          placementJson: {
            position: [position[0], position[1], position[2]],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to create");
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
          border: "1px solid rgba(42,111,189,0.6)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: "#e0f4ff", margin: "0 0 16px", fontSize: 18 }}>
          New Commerce Node
        </h3>
        <p style={{ color: "rgba(224,244,255,0.6)", fontSize: 12, marginBottom: 16 }}>
          Position: {position[0].toFixed(1)}, {position[1].toFixed(1)}, {position[2].toFixed(1)}
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
            }}
          />
          <select
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
            }}
          >
            {NODE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: "#0a1628" }}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              placeholder="Tokens"
              value={priceToken}
              onChange={(e) => setPriceToken(e.target.value)}
              min={0}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "rgba(20,40,80,0.6)",
                border: "1px solid rgba(42,111,189,0.4)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
              }}
            />
            <input
              type="number"
              placeholder="USD (cents)"
              value={priceUSD}
              onChange={(e) => setPriceUSD(e.target.value)}
              min={0}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "rgba(20,40,80,0.6)",
                border: "1px solid rgba(42,111,189,0.4)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
              }}
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
              resize: "vertical",
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
              disabled={saving}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
                border: "1px solid rgba(42,111,189,0.5)",
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
