/**
 * WorldManagementUI.tsx
 * World management sidebar — integrates with existing TidbCloud REST API
 *
 * API shape (from existing backend):
 *   GET  /api/admin/troo-world/worlds          → { worlds: [...] }
 *   POST /api/admin/troo-world/worlds          → create world
 *   PUT  /api/admin/troo-world/placements      → save placements
 *   GET  /api/troo-world/placements?worldId=X  → public placements
 *   GET  /api/troo-world/elements?worldId=X    → public elements
 */

"use client";

import { useState, useCallback } from "react";
import type { WorldObjectType } from "./WorldObjects";

interface WorldRecord {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  isPublished: boolean;
}

interface PlacementRecord {
  id?: number;
  worldId: string;
  elementKey: string;
  glbUrl: string;
  posX: number;
  posY: number;
  posZ: number;
  scale: number;
  rotY: number;
}

type LibraryItemKind = "building" | "env-object";

interface LibraryItem {
  key: string;
  label: string;
  icon: string;
  category: string;
  description: string;
  kind: LibraryItemKind;
  objectType?: WorldObjectType;
}

const OBJECT_LIBRARY: LibraryItem[] = [
  {
    key: "nexus-corporate-tower",
    label: "Nexus Corporate Tower",
    icon: "🏢",
    category: "Buildings",
    description: "5-floor luxury corporate office with AI agents, elevator & lobby",
    kind: "building",
  },
  {
    key: "meridian-tower",
    label: "Meridian Tower",
    icon: "🏙️",
    category: "Buildings",
    description: "9-floor glassmorphic tower with animated workers, elevator & rooftop",
    kind: "building",
  },
  {
    key: "street",
    label: "Street",
    icon: "🛣️",
    category: "Infrastructure",
    description: "Two-lane asphalt road with lane markings and kerb",
    kind: "env-object",
    objectType: "street",
  },
  {
    key: "sidewalk",
    label: "Sidewalk",
    icon: "🚶",
    category: "Infrastructure",
    description: "Concrete pavement slab with tile pattern and kerb edge",
    kind: "env-object",
    objectType: "sidewalk",
  },
  {
    key: "parkinglot",
    label: "Parking Lot",
    icon: "🅿️",
    category: "Infrastructure",
    description: "Paved lot with 18 stalls, lane divider, and kerb",
    kind: "env-object",
    objectType: "parkinglot",
  },
  {
    key: "lake",
    label: "Lake",
    icon: "🏞️",
    category: "Scenery",
    description: "Large animated water body with shoreline and reeds",
    kind: "env-object",
    objectType: "lake",
  },
  {
    key: "pond",
    label: "Pond",
    icon: "🌊",
    category: "Scenery",
    description: "Small circular pond with lily pads and rocks",
    kind: "env-object",
    objectType: "pond",
  },
  {
    key: "bench",
    label: "Bench",
    icon: "🪑",
    category: "Scenery",
    description: "Park bench with wooden slats and metal legs",
    kind: "env-object",
    objectType: "bench",
  },
  {
    key: "lightpost",
    label: "Light Post",
    icon: "💡",
    category: "Scenery",
    description: "Street lamp with glowing head and point light",
    kind: "env-object",
    objectType: "lightpost",
  },
];

interface WorldManagementUIProps {
  isEditorMode: boolean;
  onToggleEditor: () => void;
  currentWorldId: string;
  worlds: WorldRecord[];
  onWorldChange: (worldId: string) => void;
  onCreateWorld: (name: string) => Promise<void>;
  placements: Array<{ elementKey: string; posX: number; posY: number; posZ: number; scale: number; rotY: number }>;
  trees: Array<{ id: number; pos: [number, number, number]; scale: number }>;
  placedObjects: Array<{ id: string; type: WorldObjectType; position: [number, number, number] }>;
  onPlaceObject: (type: WorldObjectType) => void;
  onSaveWorld: () => Promise<void>;
  isSaving?: boolean;
}

export default function WorldManagementUI({
  isEditorMode,
  onToggleEditor,
  currentWorldId,
  worlds,
  onWorldChange,
  onCreateWorld,
  placements,
  trees,
  placedObjects,
  onPlaceObject,
  onSaveWorld,
  isSaving = false,
}: WorldManagementUIProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"worlds" | "library" | "save">("worlds");
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [newWorldName, setNewWorldName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(OBJECT_LIBRARY.map((o) => o.category)))];
  const filteredLibrary =
    selectedCategory === "All" ? OBJECT_LIBRARY : OBJECT_LIBRARY.filter((o) => o.category === selectedCategory);

  const handleSaveWorld = useCallback(async () => {
    setSaveStatus("idle");
    try {
      await onSaveWorld();
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, [onSaveWorld]);

  const handleCreateWorld = useCallback(async () => {
    if (!newWorldName.trim()) return;
    setIsCreating(true);
    try {
      await onCreateWorld(newWorldName.trim());
      setNewWorldName("");
    } catch {
      /* ignore */
    } finally {
      setIsCreating(false);
    }
  }, [newWorldName, onCreateWorld]);

  const sidebarW = 290;

  return (
    <>
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{
          position: "fixed",
          top: 18,
          left: isOpen ? sidebarW + 8 : 8,
          zIndex: 200,
          background: isOpen ? "rgba(10,15,26,0.9)" : "#2a6fbd",
          border: "1px solid rgba(42,111,189,0.4)",
          borderRadius: 8,
          color: "#fff",
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
          transition: "left 0.25s",
          backdropFilter: "blur(6px)",
        }}
      >
        {isOpen ? "◀ Hide" : "▶ World"}
      </button>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: isOpen ? 0 : -sidebarW - 2,
          width: sidebarW,
          height: "100vh",
          background: "rgba(8,14,26,0.96)",
          borderRight: "1px solid rgba(42,111,189,0.25)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          zIndex: 100,
          transition: "left 0.25s ease",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div
            style={{ color: "#c8a96e", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}
          >
            Troo World
          </div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>World Manager</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
            Active: {worlds.find((w) => w.id === currentWorldId)?.name ?? currentWorldId}
          </div>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={onToggleEditor}
            style={{
              width: "100%",
              background: isEditorMode ? "rgba(255,221,68,0.15)" : "rgba(42,111,189,0.15)",
              border: `1px solid ${isEditorMode ? "rgba(255,221,68,0.5)" : "rgba(42,111,189,0.4)"}`,
              borderRadius: 8,
              color: isEditorMode ? "#ffdd44" : "#5a9fd4",
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isEditorMode ? "✏️ Editor Mode ON" : "👁️ View Mode"}
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {(["worlds", "library", "save"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                background: activeTab === tab ? "rgba(42,111,189,0.2)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #2a6fbd" : "2px solid transparent",
                color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
                padding: "8px 4px",
                cursor: "pointer",
                fontSize: 11,
                textTransform: "capitalize",
              }}
            >
              {tab === "worlds" ? "🌍 Worlds" : tab === "library" ? "📦 Library" : "💾 Save"}
            </button>
          ))}
        </div>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}
        >
          {activeTab === "worlds" && (
            <>
              {worlds.map((w) => (
                <div
                  key={w.id}
                  onClick={() => onWorldChange(w.id)}
                  style={{
                    background: currentWorldId === w.id ? "rgba(42,111,189,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${currentWorldId === w.id ? "rgba(42,111,189,0.5)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{w.name}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {w.isDefault && (
                        <span
                          style={{
                            background: "#c8a96e",
                            color: "#000",
                            fontSize: 9,
                            padding: "1px 6px",
                            borderRadius: 8,
                            fontWeight: 700,
                          }}
                        >
                          DEFAULT
                        </span>
                      )}
                      {w.isPublished && (
                        <span
                          style={{
                            background: "#1c6b3a",
                            color: "#fff",
                            fontSize: 9,
                            padding: "1px 6px",
                            borderRadius: 8,
                          }}
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>/{w.slug}</div>
                </div>
              ))}

              <div
                style={{
                  marginTop: 4,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px dashed rgba(255,255,255,0.12)",
                  borderRadius: 8,
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6 }}>+ New World</div>
                <input
                  type="text"
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWorld()}
                  placeholder="World name…"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#fff",
                    fontSize: 12,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={handleCreateWorld}
                  disabled={!newWorldName.trim() || isCreating}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    background: "#2a6fbd",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    padding: "6px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Create World
                </button>
              </div>
            </>
          )}

          {activeTab === "library" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 }}>
                Click <strong style={{ color: "#5a9fd4" }}>+ Place</strong> to drop an object into the world. Enable
                Editor Mode to move it.
              </div>

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      background: selectedCategory === cat ? "#2a6fbd" : "rgba(255,255,255,0.07)",
                      border: "none",
                      borderRadius: 12,
                      color: "#fff",
                      padding: "3px 10px",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {filteredLibrary.map((item) => (
                <div
                  key={item.key}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 22 }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, marginTop: 1 }}>{item.description}</div>
                    <div
                      style={{
                        color: "rgba(42,111,189,0.7)",
                        fontSize: 9,
                        marginTop: 2,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {item.category}
                    </div>
                  </div>
                  {item.kind === "env-object" && item.objectType ? (
                    <button
                      onClick={() => onPlaceObject(item.objectType!)}
                      style={{
                        background: "rgba(42,111,189,0.2)",
                        border: "1px solid rgba(42,111,189,0.4)",
                        borderRadius: 6,
                        color: "#5a9fd4",
                        padding: "4px 8px",
                        fontSize: 10,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + Place
                    </button>
                  ) : (
                    <span
                      style={{
                        background: "rgba(200,169,110,0.15)",
                        border: "1px solid rgba(200,169,110,0.3)",
                        borderRadius: 6,
                        color: "#c8a96e",
                        padding: "4px 8px",
                        fontSize: 9,
                        whiteSpace: "nowrap",
                      }}
                    >
                      In World
                    </span>
                  )}
                </div>
              ))}
            </>
          )}

          {activeTab === "save" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
                Save the current world layout to TidbCloud. This will update placements and elements for{" "}
                <strong style={{ color: "#fff" }}>{worlds.find((w) => w.id === currentWorldId)?.name}</strong>.
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6 }}>Current layout</div>
                <div style={{ color: "#fff", fontSize: 12 }}>🏢 {placements.length} building placements</div>
                <div style={{ color: "#fff", fontSize: 12 }}>🌲 {trees.length} trees</div>
                <div style={{ color: "#fff", fontSize: 12 }}>📦 {placedObjects.length} environment objects</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>
                  World ID: {currentWorldId}
                </div>
              </div>

              <button
                onClick={handleSaveWorld}
                disabled={isSaving}
                style={{
                  background: isSaving ? "rgba(42,111,189,0.4)" : "#2a6fbd",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  padding: "10px",
                  cursor: isSaving ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {isSaving ? "Saving…" : "💾 Save World Layout"}
              </button>

              {saveStatus === "success" && (
                <div
                  style={{
                    background: "rgba(28,107,58,0.3)",
                    border: "1px solid rgba(28,107,58,0.5)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "#4ade80",
                    fontSize: 12,
                  }}
                >
                  ✓ World saved successfully
                </div>
              )}
              {saveStatus === "error" && (
                <div
                  style={{
                    background: "rgba(192,57,43,0.2)",
                    border: "1px solid rgba(192,57,43,0.4)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "#f87171",
                    fontSize: 12,
                  }}
                >
                  ✗ Save failed — check API connection
                </div>
              )}

              <div style={{ marginTop: 8, color: "rgba(255,255,255,0.3)", fontSize: 10, lineHeight: 1.5 }}>
                API: PUT /api/admin/troo-world/placements
                <br />
                API: POST /api/admin/troo-world/elements
                <br />
                Auth: admin-token cookie (JWT)
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
