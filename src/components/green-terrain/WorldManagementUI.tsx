"use client";

/**
 * WorldManagementUI.tsx
 * World management sidebar — integrates with Troo World placement APIs.
 *
 * Saves use `currentWorldId` from the parent (green-terrain page passes `green-terrain`) so
 * public `/troo-town` (which loads `?worldId=green-terrain`) shows the same layout as the editor.
 * The separate urban experience `/troo-world` uses `worldId=default` from the modeling pipeline.
 *
 * API shape:
 *   GET  /api/admin/troo-world/worlds          → { worlds: [...] }
 *   POST /api/admin/troo-world/worlds          → create world
 *   PUT  /api/admin/troo-world/placements      → save placements (body.worldId)
 *   GET  /api/troo-world/placements?worldId=X  → public placements
 *   GET  /api/troo-world/elements?worldId=X    → public elements
 */

import { useState, useCallback, useEffect } from "react";
import type { WorldObjectType } from "./WorldObjects";

// ─── Types matching existing DB schema ───────────────────────────────────────
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

// ─── Library item types ───────────────────────────────────────────────────────
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
  // ── Buildings ──
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
    key: "troothhertz-tower",
    label: "TROOTHHERTZ LLC.",
    icon: "🏛️",
    category: "Buildings",
    description: "2-floor executive building with Evaana (receptionist) & Trooth (CEO)",
    kind: "building",
  },
  {
    key: "stadium-elyseum",
    label: "Stadium Elyseum",
    icon: "🏟️",
    category: "Buildings",
    description: "Large venue for concerts, seminars, lectures. 500 capacity. Purchasable from World Explorer catalog.",
    kind: "building",
  },
  {
    key: "veritas-school",
    label: "School of Veritas",
    icon: "🏫",
    category: "Buildings",
    description: "Veritas Education campus — brick school building with classrooms K–12.",
    kind: "building",
  },
  // ── Infrastructure ──
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
  // ── Scenery ──
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
  onWorldChange: (worldId: string) => void;
  nexusPosition: [number, number, number];
  meridianPosition: [number, number, number];
  troothhertzPosition: [number, number, number];
  stadiumPosition: [number, number, number];
  stadiumScale: number;
  onStadiumScaleChange: (scale: number) => void;
  veritasPosition: [number, number, number];
  trees: Array<{ id: number; pos: [number, number, number]; scale: number }>;
  placedObjects: Array<{ id: string; type: WorldObjectType; position: [number, number, number]; rotation?: [number, number, number] }>;
  onPlaceObject: (type: WorldObjectType) => void;
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // Snap to Grid
  snapToGrid: boolean;
  onSnapToGridChange: (enabled: boolean) => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  onPlainAdded?: () => void;
}

export default function WorldManagementUI({
  isEditorMode,
  onToggleEditor,
  currentWorldId,
  onWorldChange,
  nexusPosition,
  meridianPosition,
  troothhertzPosition,
  stadiumPosition,
  stadiumScale,
  onStadiumScaleChange,
  veritasPosition,
  trees,
  placedObjects,
  onPlaceObject,
  canUndo,
  canRedo,
  onPlainAdded,
  onUndo,
  onRedo,
  snapToGrid,
  onSnapToGridChange,
  gridSize,
  onGridSizeChange,
}: WorldManagementUIProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"worlds" | "library" | "save">("worlds");
  const [worlds, setWorlds] = useState<WorldRecord[]>([
    { id: "default", name: "Troo World", slug: "troo-world", isDefault: true, isPublished: true },
    { id: "green-terrain", name: "Green Terrain World", slug: "green-terrain", isDefault: false, isPublished: false },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string>("");
  const [newWorldName, setNewWorldName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [plains, setPlains] = useState<Array<{ id: number; label: string; posX: number; posY: number; posZ: number }>>([]);
  const [showConnectPlainModal, setShowConnectPlainModal] = useState(false);
  const [newPlainName, setNewPlainName] = useState("");
  const [newPlainPos, setNewPlainPos] = useState<"north" | "south" | "east" | "west">("north");
  const [isAddingPlain, setIsAddingPlain] = useState(false);

  const DEFAULT_CARDINAL_PLAINS = [
    { id: -1, label: "TROO NORTH", posX: 0, posY: 0, posZ: -95 },
    { id: -2, label: "TROO SOUTH", posX: 0, posY: 0, posZ: 95 },
    { id: -3, label: "TROO EAST", posX: 95, posY: 0, posZ: 0 },
    { id: -4, label: "TROO WEST", posX: -95, posY: 0, posZ: 0 },
  ];

  useEffect(() => {
    const wid = currentWorldId.trim() || "green-terrain";
    fetch("/api/admin/troo-world/elements?worldId=" + encodeURIComponent(wid), { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list = (data.elements || []).filter((e: { type: string }) => e.type === "plain");
        const dbPlains = list.map((e: { id: number; label?: string; posX: number; posY: number; posZ: number }) => ({
          id: e.id,
          label: e.label || `Plain ${e.id}`,
          posX: e.posX,
          posY: e.posY,
          posZ: e.posZ,
        }));
        const cardinalLabels = new Set(DEFAULT_CARDINAL_PLAINS.map((p) => p.label));
        const hasCardinal = dbPlains.some((p) => cardinalLabels.has(p.label));
        const merged = hasCardinal ? dbPlains : [...DEFAULT_CARDINAL_PLAINS, ...dbPlains];
        setPlains(merged);
      })
      .catch(() => setPlains(DEFAULT_CARDINAL_PLAINS));
  }, [showConnectPlainModal, currentWorldId]);

  const handleConnectPlain = useCallback(async () => {
    if (!newPlainName.trim()) return;
    setIsAddingPlain(true);
    const posMap = { north: [0, 0, -95], south: [0, 0, 95], east: [95, 0, 0], west: [-95, 0, 0] } as const;
    const [posX, posY, posZ] = posMap[newPlainPos];
    const wid = currentWorldId.trim() || "green-terrain";
    try {
      const res = await fetch("/api/admin/troo-world/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          worldId: wid,
          type: "plain",
          posX,
          posY,
          posZ,
          label: newPlainName.trim(),
        }),
      });
      if (res.ok) {
        setShowConnectPlainModal(false);
        setNewPlainName("");
        setTimeout(() => {
          fetch("/api/admin/troo-world/elements?worldId=" + encodeURIComponent(wid), { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
              const list = (data.elements || []).filter((e: { type: string }) => e.type === "plain");
              setPlains(list.map((e: { id: number; label?: string; posX: number; posY: number; posZ: number }) => ({
                id: e.id,
                label: e.label || `Plain ${e.id}`,
                posX: e.posX,
                posY: e.posY,
                posZ: e.posZ,
              })));
            });
        }, 300);
        onPlainAdded?.();
      }
    } finally {
      setIsAddingPlain(false);
    }
  }, [newPlainName, newPlainPos, onPlainAdded, currentWorldId]);

  const categories = ["All", ...Array.from(new Set(OBJECT_LIBRARY.map(o => o.category)))];
  const filteredLibrary = selectedCategory === "All"
    ? OBJECT_LIBRARY
    : OBJECT_LIBRARY.filter(o => o.category === selectedCategory);

  const handleSaveWorld = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    setSaveErrorMessage("");
    try {
      const targetWorldId = currentWorldId.trim() || "green-terrain";

      const placements: PlacementRecord[] = [
        {
          worldId: targetWorldId,
          elementKey: "nexus-tower",
          glbUrl: "procedural:vertex",
          posX: nexusPosition[0],
          posY: nexusPosition[1],
          posZ: nexusPosition[2],
          scale: 1,
          rotY: 0,
        },
        {
          worldId: targetWorldId,
          elementKey: "meridian-tower",
          glbUrl: "/models/meridian-tower/meridian_tower.glb",
          posX: meridianPosition[0],
          posY: meridianPosition[1],
          posZ: meridianPosition[2],
          scale: 1,
          rotY: 0,
        },
        {
          worldId: targetWorldId,
          elementKey: "troothhertz-tower",
          glbUrl: "procedural:troothhertz",
          posX: troothhertzPosition[0],
          posY: troothhertzPosition[1],
          posZ: troothhertzPosition[2],
          scale: 1,
          rotY: 0,
        },
        {
          worldId: targetWorldId,
          elementKey: "stadium-elyseum",
          glbUrl: "/models/world-assets/stadium-elyseum.glb",
          posX: stadiumPosition[0],
          posY: stadiumPosition[1],
          posZ: stadiumPosition[2],
          scale: stadiumScale,
          rotY: 0,
        },
        {
          worldId: targetWorldId,
          elementKey: "veritas-school",
          glbUrl: "procedural:veritas",
          posX: veritasPosition[0],
          posY: veritasPosition[1],
          posZ: veritasPosition[2],
          scale: 1,
          rotY: 0,
        },
        ...placedObjects.map((obj, idx) => ({
          worldId: targetWorldId,
          elementKey: `${obj.type}-${idx}`,
          glbUrl: `procedural:${obj.type}`,
          posX: obj.position[0],
          posY: obj.position[1],
          posZ: obj.position[2],
          scale: 1,
          rotY: obj.rotation?.[1] ?? 0,
        })),
      ];

      const elements = [
        ...trees.map(t => ({
          worldId: targetWorldId,
          type: "tree",
          posX: t.pos[0],
          posY: t.pos[1],
          posZ: t.pos[2],
          rotY: 0,
          scale: t.scale,
          colorHex: null,
          label: null,
          isDefault: false,
        })),
        ...plains.map(p => ({
          worldId: targetWorldId,
          type: "plain",
          posX: p.posX,
          posY: p.posY,
          posZ: p.posZ,
          rotY: 0,
          scale: 1,
          colorHex: null,
          label: p.label,
          isDefault: false,
        })),
      ];

      console.log("[WorldSave] Publishing to worldId:", targetWorldId);
      console.log("[WorldSave] Placements:", JSON.stringify(placements, null, 2));
      console.log("[WorldSave] Elements:", JSON.stringify(elements, null, 2));

      // Save placements — worldId matches public /troo-town (?worldId=green-terrain)
      // Set replace: true to delete any old objects that no longer exist in the current state
      const placementsRes = await fetch("/api/admin/troo-world/placements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId: targetWorldId, placements, replace: true }),
        credentials: "include",
      });

      if (!placementsRes.ok) {
        const errData = await placementsRes.json().catch(() => ({}));
        console.error("[WorldSave] Placements save failed:", placementsRes.status, errData);
        const errMsg = errData.error || errData.detail || `Placements save failed: ${placementsRes.status}`;
        if (placementsRes.status === 401) {
          throw new Error("Admin session required. Log in at /admin with ADMIN_USERNAME/ADMIN_PASSWORD, then try again.");
        }
        throw new Error(errMsg);
      }

      const placementsResult = await placementsRes.json();
      console.log("[WorldSave] Placements save result:", placementsResult);

      // Save elements (trees) - use PUT to replace all elements
      // This is optional - if the table doesn't exist, we still consider save successful
      let elementsSuccess = true;
      try {
        const elementsRes = await fetch("/api/admin/troo-world/elements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldId: targetWorldId, elements }),
          credentials: "include",
        });

        if (!elementsRes.ok) {
          const errData = await elementsRes.json().catch(() => ({}));
          console.warn("[WorldSave] Elements save failed (non-critical):", elementsRes.status, errData);
          elementsSuccess = false;
        } else {
          const elementsResult = await elementsRes.json();
          console.log("[WorldSave] Elements save result:", elementsResult);
        }
      } catch (elemErr) {
        console.warn("[WorldSave] Elements save error (non-critical):", elemErr);
        elementsSuccess = false;
      }

      setSaveStatus("success");
      if (!elementsSuccess) {
        console.log("[WorldSave] Placements saved successfully. Trees may not be synced (table may not exist).");
      }
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("[WorldSave] Error:", error);
      setSaveStatus("error");
      const msg = error instanceof Error ? error.message : "Save failed — check API connection";
      setSaveErrorMessage(msg);
      setTimeout(() => setSaveErrorMessage(""), 8000);
    } finally {
      setIsSaving(false);
    }
  }, [
    currentWorldId,
    nexusPosition,
    meridianPosition,
    troothhertzPosition,
    stadiumPosition,
    stadiumScale,
    veritasPosition,
    trees,
    placedObjects,
    plains,
  ]);

  const handleCreateWorld = useCallback(async () => {
    if (!newWorldName.trim()) return;
    setIsCreating(true);
    const slug = newWorldName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const newWorld: WorldRecord = {
      id: `world-${Date.now()}`,
      name: newWorldName.trim(),
      slug,
      isDefault: false,
      isPublished: false,
    };
    try {
      await fetch("/api/admin/troo-world/worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorld.name, slug }),
        credentials: "include",
      });
    } catch { /* local only */ }
    setWorlds(prev => [...prev, newWorld]);
    setNewWorldName("");
    setIsCreating(false);
  }, [newWorldName]);

  const sidebarW = 290;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
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
      >{isOpen ? "◀ Hide" : "▶ World"}</button>

      {/* Sidebar */}
      <div style={{
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
      }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ color: "#c8a96e", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Green Terrain</div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>World Manager</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
            Active: {worlds.find(w => w.id === currentWorldId)?.name ?? currentWorldId}
          </div>
        </div>

        {/* Editor mode toggle */}
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

          {/* Undo/Redo buttons - only show in editor mode */}
          {isEditorMode && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                style={{
                  flex: 1,
                  background: canUndo ? "rgba(42,111,189,0.2)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(42,111,189,0.3)",
                  borderRadius: 6,
                  color: canUndo ? "#5a9fd4" : "rgba(255,255,255,0.25)",
                  padding: "6px 10px",
                  cursor: canUndo ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >↩️ Undo</button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                style={{
                  flex: 1,
                  background: canRedo ? "rgba(42,111,189,0.2)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(42,111,189,0.3)",
                  borderRadius: 6,
                  color: canRedo ? "#5a9fd4" : "rgba(255,255,255,0.25)",
                  padding: "6px 10px",
                  cursor: canRedo ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >↪️ Redo</button>
            </div>
          )}

          {/* Connect new plain - only show in editor mode */}
          {isEditorMode && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowConnectPlainModal(true)}
                style={{
                  width: "100%",
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.5)",
                  borderRadius: 8,
                  color: "#10b981",
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
                ➕ Connect New Plain
              </button>
              {plains.length > 0 && (
                <div style={{ marginTop: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                  {plains.length} custom plain{plains.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}

          {/* Snap to Grid controls - only show in editor mode */}
          {isEditorMode && (
            <div style={{ marginTop: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🔲 Snap to Grid</span>
                </label>
                <button
                  onClick={() => onSnapToGridChange(!snapToGrid)}
                  style={{
                    background: snapToGrid ? "#2a6fbd" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 12,
                    width: 40,
                    height: 22,
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 3,
                    left: snapToGrid ? 21 : 3,
                    width: 16,
                    height: 16,
                    background: "#fff",
                    borderRadius: "50%",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
              {snapToGrid && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Grid size:</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 2, 5, 10].map(size => (
                      <button
                        key={size}
                        onClick={() => onGridSizeChange(size)}
                        style={{
                          background: gridSize === size ? "#2a6fbd" : "rgba(255,255,255,0.1)",
                          border: gridSize === size ? "1px solid #5a9fd4" : "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 4,
                          color: gridSize === size ? "#fff" : "rgba(255,255,255,0.6)",
                          padding: "3px 8px",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >{size}m</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {(["worlds", "library", "save"] as const).map(tab => (
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
            >{tab === "worlds" ? "🌍 Worlds" : tab === "library" ? "📦 Library" : "💾 Save"}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* ── Worlds tab ── */}
          {activeTab === "worlds" && (
            <>
              {worlds.map(w => (
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
                      {w.isDefault && <span style={{ background: "#c8a96e", color: "#000", fontSize: 9, padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>DEFAULT</span>}
                      {w.isPublished && <span style={{ background: "#1c6b3a", color: "#fff", fontSize: 9, padding: "1px 6px", borderRadius: 8 }}>LIVE</span>}
                    </div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>/{w.slug}</div>
                </div>
              ))}

              {/* Create new world */}
              <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8 }}>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6 }}>+ New World</div>
                <input
                  type="text"
                  value={newWorldName}
                  onChange={e => setNewWorldName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreateWorld()}
                  placeholder="World name…"
                  style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
                <button
                  onClick={handleCreateWorld}
                  disabled={!newWorldName.trim() || isCreating}
                  style={{ marginTop: 6, width: "100%", background: "#2a6fbd", border: "none", borderRadius: 6, color: "#fff", padding: "6px", cursor: "pointer", fontSize: 12 }}
                >Create World</button>
              </div>
            </>
          )}

          {/* ── Library tab ── */}
          {activeTab === "library" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 }}>
                Click <strong style={{ color: "#5a9fd4" }}>+ Place</strong> to drop an object into the world. Enable Editor Mode to move it.
              </div>

              {/* Category filters */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                {categories.map(cat => (
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
                  >{cat}</button>
                ))}
              </div>

              {filteredLibrary.map(item => (
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
                    <div style={{ color: "rgba(42,111,189,0.7)", fontSize: 9, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.category}</div>
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
                    >+ Place</button>
                  ) : (
                    <span style={{
                      background: "rgba(200,169,110,0.15)",
                      border: "1px solid rgba(200,169,110,0.3)",
                      borderRadius: 6,
                      color: "#c8a96e",
                      padding: "4px 8px",
                      fontSize: 9,
                      whiteSpace: "nowrap",
                    }}>In World</span>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ── Save tab ── */}
          {activeTab === "save" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
                Save and publish the current world layout to the public{" "}
                <strong style={{ color: "#4ade80" }}>/troo-world</strong> page.
              </div>

              <div style={{ background: "rgba(28,107,58,0.15)", border: "1px solid rgba(28,107,58,0.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>🌐 Publishes to: /troo-world</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, lineHeight: 1.5 }}>
                  Changes will be visible to all visitors on the public Troo World page.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6 }}>Current layout</div>
                <div style={{ color: "#fff", fontSize: 12 }}>🏢 Nexus Corporate Tower</div>
                <div style={{ color: "#fff", fontSize: 12 }}>🏙️ Meridian Tower</div>
                <div style={{ color: "#fff", fontSize: 12 }}>🏛️ TROOTHHERTZ LLC.</div>
                <div style={{ color: "#fff", fontSize: 12, marginTop: 4 }}>🏫 School of Veritas</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginBottom: 6 }}>
                  x:{veritasPosition[0].toFixed(0)} z:{veritasPosition[2].toFixed(0)}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 4 }}>
                  <span style={{ color: "#fff", fontSize: 12 }}>🏟️ Stadium Elyseum</span>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>scale: {(stadiumScale * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    type="range"
                    min={0.3}
                    max={1.5}
                    step={0.05}
                    value={stadiumScale}
                    onChange={(e) => onStadiumScaleChange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "#2a6fbd" }}
                  />
                  <button
                    onClick={() => onStadiumScaleChange(1)}
                    style={{
                      background: "rgba(42,111,189,0.2)",
                      border: "1px solid rgba(42,111,189,0.4)",
                      borderRadius: 4,
                      color: "#5a9fd4",
                      padding: "2px 8px",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >Reset</button>
                </div>
                <div style={{ color: "#fff", fontSize: 12 }}>🌲 {trees.length} trees</div>
                <div style={{ color: "#fff", fontSize: 12 }}>📦 {placedObjects.length} environment objects</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>Publish target: {currentWorldId}</div>
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
              >{isSaving ? "Saving…" : "💾 Save World Layout"}</button>

              {saveStatus === "success" && (
                <div style={{ background: "rgba(28,107,58,0.3)", border: "1px solid rgba(28,107,58,0.5)", borderRadius: 8, padding: "8px 12px", color: "#4ade80", fontSize: 12 }}>
                  ✓ World saved successfully
                </div>
              )}
              {saveStatus === "error" && (
                <div style={{ background: "rgba(192,57,43,0.2)", border: "1px solid rgba(192,57,43,0.4)", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12 }}>
                  ✗ {saveErrorMessage || "Save failed — check API connection"}
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.9 }}>
                    Ensure you’re logged in as admin at <a href="/admin" style={{ color: "#f87171", textDecoration: "underline" }}>/admin</a> and DATABASE_URL is set in Vercel.
                  </div>
                </div>
              )}

              <div style={{ marginTop: 8, color: "rgba(255,255,255,0.3)", fontSize: 10, lineHeight: 1.5 }}>
                API: PUT /api/admin/troo-world/placements<br />
                API: POST /api/admin/troo-world/elements<br />
                Auth: admin-token cookie (JWT)
              </div>
            </>
          )}
        </div>
      </div>

      {/* Connect New Plain modal */}
      {showConnectPlainModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
          }}
          onClick={() => setShowConnectPlainModal(false)}
        >
          <div
            style={{
              background: "#0a1628",
              border: "1px solid rgba(16,185,129,0.5)",
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: "#10b981", marginBottom: 16, fontSize: 16 }}>Connect New Plain</h3>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 12 }}>
              TROO NORTH, SOUTH, EAST, WEST already exist with bridges. This adds a 5th+ plain (e.g. TROO NORTHEAST). Choose where to place it and a name.
            </p>
            <input
              type="text"
              value={newPlainName}
              onChange={(e) => setNewPlainName(e.target.value)}
              placeholder="e.g. TROO NORTHEAST"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(16,185,129,0.4)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            <select
              value={newPlainPos}
              onChange={(e) => setNewPlainPos(e.target.value as "north" | "south" | "east" | "west")}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(16,185,129,0.4)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              <option value="north">North area (TROO NORTH is already there — place new plain nearby)</option>
              <option value="south">South area (TROO SOUTH exists — place new plain nearby)</option>
              <option value="east">East area (TROO EAST exists — place new plain nearby)</option>
              <option value="west">West area (TROO WEST exists — place new plain nearby)</option>
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConnectPlainModal(false)}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConnectPlain}
                disabled={!newPlainName.trim() || isAddingPlain}
                style={{
                  padding: "8px 16px",
                  background: "#10b981",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  cursor: newPlainName.trim() && !isAddingPlain ? "pointer" : "not-allowed",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {isAddingPlain ? "Adding…" : "Add Plain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
