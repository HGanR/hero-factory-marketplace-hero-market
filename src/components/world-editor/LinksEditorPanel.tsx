"use client";

import { useState } from "react";

export interface WorldLink {
  id: string;
  fromWorldId: string;
  toWorldId: string;
  label?: string | null;
  placementJson?: unknown;
}

interface LinksEditorPanelProps {
  worldId: string;
  links: WorldLink[];
  addingLink: boolean;
  onSelectLink: (id: string | null) => void;
  onAddingLink: (adding: boolean) => void;
  onLinksChange: () => void;
  /** When true, renders without absolute positioning (for nav dropdown) */
  embedded?: boolean;
}

export function LinksEditorPanel({
  worldId,
  links,
  addingLink,
  onSelectLink,
  onAddingLink,
  onLinksChange,
  embedded,
}: LinksEditorPanelProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(linkId: string) {
    if (saving || !confirm("Remove this portal link?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/links/${linkId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to delete");
        return;
      }
      onSelectLink(null);
      onLinksChange();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const wrapperStyle: React.CSSProperties = embedded
    ? { width: 280, fontFamily: "system-ui, sans-serif" }
    : {
        position: "absolute",
        top: 60,
        left: 456,
        width: 200,
        maxHeight: "calc(100vh - 140px)",
        background: "rgba(10,20,40,0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(78,205,196,0.5)",
        borderRadius: 12,
        padding: 12,
        overflowY: "auto",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
      };

  return (
    <div style={wrapperStyle}>
      {!embedded && (
        <>
          <div style={{ fontWeight: 700, color: "#4ecdc4", marginBottom: 8, fontSize: 13 }}>
            Portals
          </div>
          <div style={{ fontSize: 10, color: "rgba(224,244,255,0.5)", marginBottom: 8 }}>
            Links to other worlds
          </div>
        </>
      )}

      <button
        onClick={() => {
          onAddingLink(!addingLink);
          if (addingLink) onSelectLink(null);
        }}
        title={addingLink ? "Click terrain to place portal" : "Add a portal to another world"}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: addingLink ? "rgba(78,205,196,0.4)" : "rgba(78,205,196,0.2)",
          border: `1px solid ${addingLink ? "#4ecdc4" : "rgba(78,205,196,0.5)"}`,
          borderRadius: 8,
          color: addingLink ? "#6ee7de" : "#a0e8e4",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        {addingLink ? "Click terrain to place" : "+ Add Portal"}
      </button>

      {links.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "rgba(224,244,255,0.6)", marginBottom: 6 }}>
            Links ({links.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {links.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: "6px 10px",
                  background: "rgba(20,40,80,0.6)",
                  border: "1px solid rgba(78,205,196,0.3)",
                  borderRadius: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#e0f4ff", fontSize: 11 }}>
                  → {l.label || l.toWorldId.slice(0, 8)}
                </span>
                <button
                  onClick={() => handleDelete(l.id)}
                  disabled={saving}
                  style={{
                    padding: "2px 6px",
                    background: "rgba(239,68,68,0.3)",
                    border: "1px solid rgba(239,68,68,0.5)",
                    borderRadius: 4,
                    color: "#fca5a5",
                    fontSize: 10,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ color: "#f87171", fontSize: 11, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
