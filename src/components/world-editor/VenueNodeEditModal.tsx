"use client";

import { useState, useEffect } from "react";
import { NODE_TYPES, ACCESS_TYPES } from "@/lib/venue-nodes/validators";
import { getNodeTypePreset } from "@/lib/venue-nodes/node-type-presets";
import type { VenueInteriorNode } from "@/types/venue-nodes";

const ACCESS_LABELS: Record<string, string> = {
  public: "Public",
  private: "Private",
  token_gated: "Token Gated",
  owner_only: "Owner Only",
};

interface VenueNodeEditModalProps {
  worldId: string;
  node: VenueInteriorNode;
  onSaved: () => void;
  onCancel: () => void;
}

export function VenueNodeEditModal({
  worldId,
  node,
  onSaved,
  onCancel,
}: VenueNodeEditModalProps) {
  const [title, setTitle] = useState(node.title);
  const [nodeType, setNodeType] = useState(node.nodeType);
  const [description, setDescription] = useState(node.description ?? "");
  const [posX, setPosX] = useState(node.posX);
  const [posY, setPosY] = useState(node.posY);
  const [posZ, setPosZ] = useState(node.posZ);
  const [rotY, setRotY] = useState(node.rotY);
  const [accessType, setAccessType] = useState(node.accessType);
  const [isActive, setIsActive] = useState(node.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(node.title);
    setNodeType(node.nodeType);
    setDescription(node.description ?? "");
    setPosX(node.posX);
    setPosY(node.posY);
    setPosZ(node.posZ);
    setRotY(node.rotY);
    setAccessType(node.accessType);
    setIsActive(node.isActive);
  }, [node]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/venue-nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim() || node.title,
          nodeType,
          description: description.trim() || null,
          posX: Number(posX),
          posY: Number(posY),
          posZ: Number(posZ),
          rotY: Number(rotY),
          accessType,
          isActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to update");
        setSaving(false);
        return;
      }
      onSaved();
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
          width: "min(400px, 92vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "rgba(10,20,40,0.98)",
          border: "1px solid rgba(42,111,189,0.6)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: "#e0f4ff", margin: "0 0 16px", fontSize: 18 }}>
          Edit Interior Node
        </h3>
        <p style={{ color: "rgba(224,244,255,0.6)", fontSize: 12, marginBottom: 16 }}>
          Room ID: {node.roomId}
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
            }}
          />
          <div>
            <label style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", display: "block", marginBottom: 4 }}>Room type</label>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(20,40,80,0.6)",
                border: "1px solid rgba(42,111,189,0.4)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
              }}
            >
              {NODE_TYPES.map((t) => {
                const preset = getNodeTypePreset(t);
                return (
                  <option key={t} value={t} style={{ background: "#0a1628" }}>
                    {preset.label}
                  </option>
                );
              })}
            </select>
            <div style={{ fontSize: 9, color: "rgba(224,244,255,0.5)", marginTop: 4 }}>
              {getNodeTypePreset(nodeType).description}
            </div>
          </div>
          <select
            value={accessType}
            onChange={(e) => setAccessType(e.target.value)}
            style={{
              padding: "10px 12px",
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 8,
              color: "#e0f4ff",
              fontSize: 14,
            }}
          >
            {ACCESS_TYPES.map((t) => (
              <option key={t} value={t} style={{ background: "#0a1628" }}>
                {ACCESS_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ accentColor: "#2a6fbd" }}
            />
            <span style={{ color: "#e0f4ff", fontSize: 14 }}>Active</span>
          </label>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", display: "block", marginBottom: 4 }}>posX</label>
              <input
                type="number"
                value={posX}
                onChange={(e) => setPosX(parseFloat(e.target.value) || 0)}
                step={0.1}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "rgba(20,40,80,0.6)",
                  border: "1px solid rgba(42,111,189,0.4)",
                  borderRadius: 8,
                  color: "#e0f4ff",
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", display: "block", marginBottom: 4 }}>posY</label>
              <input
                type="number"
                value={posY}
                onChange={(e) => setPosY(parseFloat(e.target.value) || 0)}
                step={0.1}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "rgba(20,40,80,0.6)",
                  border: "1px solid rgba(42,111,189,0.4)",
                  borderRadius: 8,
                  color: "#e0f4ff",
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", display: "block", marginBottom: 4 }}>posZ</label>
              <input
                type="number"
                value={posZ}
                onChange={(e) => setPosZ(parseFloat(e.target.value) || 0)}
                step={0.1}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "rgba(20,40,80,0.6)",
                  border: "1px solid rgba(42,111,189,0.4)",
                  borderRadius: 8,
                  color: "#e0f4ff",
                  fontSize: 13,
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", display: "block", marginBottom: 4 }}>rotY (degrees)</label>
            <input
              type="number"
              value={rotY}
              onChange={(e) => setRotY(parseFloat(e.target.value) || 0)}
              step={1}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "rgba(20,40,80,0.6)",
                border: "1px solid rgba(42,111,189,0.4)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 13,
              }}
            />
          </div>
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
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
