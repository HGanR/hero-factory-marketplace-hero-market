"use client";

import { useState, useEffect } from "react";
import { trackMeetingNodeEvent } from "@/lib/troo-world/meeting-node/analytics";

export interface MeetingNodeConfig {
  title: string;
  accessType: "public" | "private" | "invite_only";
  capacity: number;
  webEnabled: boolean;
  webxrEnabled: boolean;
  vrEnabled: boolean;
}

interface MeetingNodeConfigModalProps {
  buildingName: string;
  parentPlacementId?: number;
  parentElementKey?: string;
  worldId?: string;
  /** Edit mode: existing node id */
  nodeId?: string;
  /** Edit mode: initial values */
  initialConfig?: Partial<MeetingNodeConfig>;
  onSave: (config: MeetingNodeConfig) => void | Promise<void>;
  onCancel: () => void;
}

export function MeetingNodeConfigModal({
  buildingName,
  parentPlacementId,
  parentElementKey,
  worldId = "default",
  nodeId,
  initialConfig,
  onSave,
  onCancel,
}: MeetingNodeConfigModalProps) {
  const [title, setTitle] = useState(initialConfig?.title ?? "");
  const [accessType, setAccessType] = useState<"public" | "private" | "invite_only">(initialConfig?.accessType ?? "public");
  const [capacity, setCapacity] = useState(initialConfig?.capacity ?? 12);
  const [webEnabled, setWebEnabled] = useState(initialConfig?.webEnabled ?? true);
  const [webxrEnabled, setWebxrEnabled] = useState(initialConfig?.webxrEnabled ?? false);
  const [vrEnabled, setVrEnabled] = useState(initialConfig?.vrEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setTitle(initialConfig.title ?? "");
      setAccessType(initialConfig.accessType ?? "public");
      setCapacity(initialConfig.capacity ?? 12);
      setWebEnabled(initialConfig.webEnabled ?? true);
      setWebxrEnabled(initialConfig.webxrEnabled ?? false);
      setVrEnabled(initialConfig.vrEnabled ?? false);
    }
  }, [initialConfig]);

  const isEdit = !!nodeId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit && nodeId) {
        const res = await fetch(`/api/troo-world/meeting-nodes/${nodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: title.trim() || "Meeting Room",
            accessType,
            capacity,
            webEnabled,
            webxrEnabled,
            vrEnabled,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? "Failed to update meeting node");
          setSaving(false);
          return;
        }
        await onSave({
          title: title.trim() || "Meeting Room",
          accessType,
          capacity,
          webEnabled,
          webxrEnabled,
          vrEnabled,
        });
        trackMeetingNodeEvent("node_edited", { nodeId });
      } else {
        const res = await fetch("/api/troo-world/meeting-nodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            worldId,
            ...(parentPlacementId != null ? { parentPlacementId } : { parentElementKey: parentElementKey ?? "" }),
            title: title.trim() || "Meeting Room",
            accessType,
            capacity,
            webEnabled,
            webxrEnabled,
            vrEnabled,
            posX: 0,
            posY: 0,
            posZ: 0,
            rotY: 0,
            scale: 1,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? "Failed to create meeting node");
          setSaving(false);
          return;
        }
        await onSave({
          title: title.trim() || "Meeting Room",
          accessType,
          capacity,
          webEnabled,
          webxrEnabled,
          vrEnabled,
        });
        trackMeetingNodeEvent("node_created", { nodeId: json?.id, roomId: json?.roomId });
        return;
      }
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
        <h3 style={{ color: "#e0f4ff", margin: "0 0 8px", fontSize: 18 }}>
          {isEdit ? "Edit Meeting Node" : "Add Meeting Node"}
        </h3>
        <p style={{ color: "rgba(224,244,255,0.6)", fontSize: 12, marginBottom: 16 }}>
          {isEdit ? `Edit meeting room settings` : `Attach a meeting room to ${buildingName}`}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "#88aacc", fontSize: 11, marginBottom: 4 }}>
              Room Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Boardroom"
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(100,180,255,0.3)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "#88aacc", fontSize: 11, marginBottom: 4 }}>
              Access
            </label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as "public" | "private" | "invite_only")}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(100,180,255,0.3)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
              }}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="invite_only">Invite Only</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "#88aacc", fontSize: 11, marginBottom: 4 }}>
              Capacity
            </label>
            <input
              type="number"
              min={2}
              max={100}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(2, Math.min(100, parseInt(e.target.value, 10) || 12)))}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(100,180,255,0.3)",
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaccff", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={webEnabled}
                onChange={(e) => setWebEnabled(e.target.checked)}
              />
              Web
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaccff", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={webxrEnabled}
                onChange={(e) => setWebxrEnabled(e.target.checked)}
              />
              WebXR
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaccff", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={vrEnabled}
                onChange={(e) => setVrEnabled(e.target.checked)}
              />
              VR
            </label>
          </div>

          {error && (
            <p style={{ color: "#ff6666", fontSize: 12, marginBottom: 12 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 16px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(100,180,255,0.3)",
                borderRadius: 8,
                color: "#aaccff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 16px",
                background: saving ? "rgba(68,136,255,0.4)" : "#4488ff",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Meeting Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
