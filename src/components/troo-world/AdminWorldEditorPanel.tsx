"use client";

import { useState, useMemo } from "react";
import type { Placement } from "./TrooWorldUnifiedViewer";
import type { WorldElementData } from "@/lib/troo-world/WorldElementSystem";

const BUILT_IN_KEYS = new Set(["nexus-tower", "meridian-tower", "apex-tower", "harborview-tower"]);

function elementKeyToDisplayName(key: string): string {
  const map: Record<string, string> = {
    "nexus-tower": "Nexus Tower",
    "meridian-tower": "Meridian Tower",
    "apex-tower": "Apex Tower",
    "harborview-tower": "Harborview Tower",
  };
  return map[key] ?? key.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function elementKeyToBuildingRoute(key: string): "nexus" | "meridian" | "apex" | "harborview" | null {
  if (key.includes("nexus")) return "nexus";
  if (key.includes("meridian")) return "meridian";
  if (key.includes("apex")) return "apex";
  if (key.includes("harborview")) return "harborview";
  return null;
}

const SNAP_GRID_SIZE = 5;

const ELEMENT_CATEGORIES: { id: string; label: string; items: { type: WorldElementData["type"]; emoji: string; label: string }[] }[] = [
  { id: "nature", label: "🌿 Nature", items: [{ type: "tree", emoji: "🌲", label: "Tree" }, { type: "tree_cluster", emoji: "🌳", label: "Tree Cluster" }, { type: "bush", emoji: "🌿", label: "Bush" }, { type: "flower_bed", emoji: "🌸", label: "Flower Bed" }, { type: "grass_patch", emoji: "🟩", label: "Grass Patch" }] },
  { id: "roads", label: "🛣️ Roads & Paths", items: [{ type: "road_segment", emoji: "🛣️", label: "Road Segment" }, { type: "road_cross", emoji: "✚", label: "Road Cross" }, { type: "road_arm", emoji: "━", label: "Road Arm" }, { type: "roundabout", emoji: "🔄", label: "Roundabout" }, { type: "crosswalk", emoji: "🦓", label: "Crosswalk" }, { type: "sidewalk_tile", emoji: "⬜", label: "Sidewalk Tile" }, { type: "curb_strip", emoji: "▬", label: "Curb Strip" }] },
  { id: "structures", label: "🏛️ Structures", items: [{ type: "plaza_pad", emoji: "⬛", label: "Plaza Pad" }, { type: "fountain", emoji: "⛲", label: "Fountain" }, { type: "planter_box", emoji: "🪴", label: "Planter Box" }, { type: "steps", emoji: "🪜", label: "Steps" }, { type: "wall_segment", emoji: "🧱", label: "Wall Segment" }, { type: "fence_segment", emoji: "🚧", label: "Fence Segment" }, { type: "ground_patch", emoji: "🟫", label: "Ground Patch" }, { type: "gravel_patch", emoji: "⬜", label: "Gravel Patch" }] },
  { id: "furniture", label: "🪑 Street Furniture", items: [{ type: "street_light", emoji: "💡", label: "Street Light" }, { type: "bench", emoji: "🪑", label: "Bench" }, { type: "trash_bin", emoji: "🗑️", label: "Trash Bin" }, { type: "bollard", emoji: "🔵", label: "Bollard" }] },
  { id: "water", label: "💧 Water", items: [{ type: "lake", emoji: "🏞️", label: "Lake" }, { type: "pond", emoji: "💧", label: "Pond" }, { type: "river_segment", emoji: "🌊", label: "River Segment" }] },
  { id: "custom", label: "📦 Custom", items: [{ type: "glb_import", emoji: "📦", label: "GLB Import" }] },
];

const ELEMENT_PALETTE = ELEMENT_CATEGORIES.flatMap((c) => c.items);

const S = {
  panel: { width: 256, flexShrink: 0, borderRight: "1px solid rgba(6, 182, 212, 0.3)", background: "rgba(2, 6, 23, 0.95)", overflowY: "auto" as const },
  tabActive: { flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "rgba(6, 182, 212, 0.4)", color: "rgb(165, 243, 252)", border: "1px solid rgba(6, 182, 212, 0.5)" },
  tabInactive: { flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "rgba(30, 41, 59, 0.6)", color: "rgb(148, 163, 184)", border: "1px solid rgba(6, 182, 212, 0.2)" },
  btnGrid: { padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500 },
  btnGridOn: { background: "rgba(16, 185, 129, 0.3)", color: "rgb(110, 231, 183)", border: "1px solid rgba(52, 211, 153, 0.5)" },
  btnGridOff: { background: "rgba(30, 41, 59, 0.6)", color: "rgb(148, 163, 184)", border: "1px solid rgba(6, 182, 212, 0.2)" },
  btnUndoRedo: { padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500 },
  btnUndoRedoOn: { background: "rgba(6, 182, 212, 0.3)", color: "rgb(165, 243, 252)", border: "1px solid rgba(6, 182, 212, 0.5)" },
  btnUndoRedoOff: { background: "rgba(30, 41, 59, 0.4)", color: "rgb(100, 116, 139)", border: "1px solid rgba(71, 85, 105, 0.5)", cursor: "not-allowed" as const },
  btnTransform: { padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500 },
  btnTransformOn: { background: "rgb(6, 182, 212)", color: "black" },
  btnTransformOff: { background: "rgb(30, 41, 59)", color: "rgb(56, 189, 248)", border: "none" },
  sectionTitle: { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "rgb(148, 163, 184)" },
  listItem: { padding: "6px 8px", borderRadius: 6, fontSize: 14, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const },
  listItemSelected: { background: "rgba(6, 182, 212, 0.3)", color: "rgb(165, 243, 252)" },
  listItemHover: { color: "rgb(203, 213, 225)", background: "rgb(30, 41, 59)" },
  input: { width: "100%", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)", background: "rgb(15, 23, 42)", padding: "4px 6px", fontSize: 12, color: "white" },
  label: { color: "rgb(100, 116, 139)", display: "block", fontSize: 12 },
  btnCyan: { borderRadius: 4, border: "1px solid rgba(6, 182, 212, 0.5)", padding: "6px 8px", fontSize: 12, color: "rgb(56, 189, 248)" },
  btnRed: { borderRadius: 4, border: "1px solid rgba(239, 68, 68, 0.5)", padding: "6px 8px", fontSize: 12, color: "rgb(248, 113, 113)" },
  btnAmber: { borderRadius: 4, border: "1px solid rgba(245, 158, 11, 0.5)", padding: "6px 8px", fontSize: 12, color: "rgb(251, 191, 36)" },
  btnSky: { borderRadius: 4, border: "1px solid rgba(14, 165, 233, 0.5)", padding: "6px 8px", fontSize: 12, color: "rgb(56, 189, 248)" },
  accordionHeader: { padding: "4px 0", fontSize: 10, color: "rgb(100, 116, 139)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 },
  elementBtn: { padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid rgba(6, 182, 212, 0.3)", background: "rgba(30, 41, 59, 0.6)", color: "rgb(56, 189, 248)" },
  listItemElement: { padding: "6px 8px", borderRadius: 6, fontSize: 14, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis" as const, display: "flex", alignItems: "center", gap: 4 },
  listItemElementSelected: { background: "rgba(16, 185, 129, 0.3)", color: "rgb(110, 231, 183)" },
};

export interface AdminWorldEditorPanelProps {
  placements: Placement[] | null;
  elements: WorldElementData[] | null;
  selectedElementKey: string | null;
  selectedElementId: number | null;
  setSelectedElementKey: (k: string | null) => void;
  setSelectedElementId: (id: number | null) => void;
  onNumericChange: (key: string, field: keyof Placement, value: number) => void;
  onNumericChangeElement: (id: number, field: keyof WorldElementData, value: number) => void;
  onAddElement: (type: WorldElementData["type"]) => void;
  onUpdateElementLabel: (id: number, label: string) => void;
  onUpdateElementColor: (id: number, colorHex: number | null, color2Hex: number | null) => void;
  onDeleteElement: (id: number) => void;
  onDelete: (key: string) => void;
  setBuildingToEnter: (b: "nexus" | "meridian" | "apex" | "harborview" | null) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean | ((prev: boolean) => boolean)) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImportBuilding: () => void;
  onAddMeetingNode?: (elementKey: string) => void;
  meetingNodes?: Array<{ id: string; roomId: string; title: string; parentElementKey: string | null; isActive: boolean }>;
  onEditMeetingNode?: (nodeId: string) => void;
  onDisableMeetingNode?: (nodeId: string, isActive: boolean) => void;
  onDeleteMeetingNode?: (nodeId: string) => void;
  onSeedScenery?: () => void;
  seeding?: boolean;
  transformMode?: "translate" | "rotate" | "scale";
  setTransformMode?: (m: "translate" | "rotate" | "scale") => void;
  addingElement?: boolean;
  isViewOnly?: boolean;
}

export default function AdminWorldEditorPanel(props: AdminWorldEditorPanelProps) {
  const {
    placements,
    elements,
    selectedElementKey,
    selectedElementId,
    setSelectedElementKey,
    setSelectedElementId,
    onNumericChange,
    onNumericChangeElement,
    onAddElement,
    onUpdateElementLabel,
    onUpdateElementColor,
    onDeleteElement,
    onDelete,
    setBuildingToEnter,
    snapToGrid,
    setSnapToGrid,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onImportBuilding,
    onAddMeetingNode,
    meetingNodes = [],
    onEditMeetingNode,
    onDisableMeetingNode,
    onDeleteMeetingNode,
    onSeedScenery,
    seeding = false,
    transformMode = "translate",
    setTransformMode,
    addingElement = false,
    isViewOnly = false,
  } = props;

  const [tab, setTab] = useState<"buildings" | "elements">("buildings");
  const [elementSearch, setElementSearch] = useState("");
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ELEMENT_CATEGORIES.map((c) => [c.id, true]))
  );

  const selectedPlacement = (placements ?? []).find((p) => p.elementKey === selectedElementKey);
  const selectedElement = (elements ?? []).find((e) => e.id === selectedElementId);

  const filteredCategories = useMemo(() => {
    const q = elementSearch.trim().toLowerCase();
    if (!q) return ELEMENT_CATEGORIES;
    return ELEMENT_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [elementSearch]);

  const toggleAccordion = (id: string) => {
    setAccordionOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={S.panel} className="pointer-events-auto">
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["buildings", "elements"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={tab === t ? S.tabActive : S.tabInactive}
            >
              {t === "buildings" ? "🏢" : "🌲"} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSnapToGrid((s) => !s)}
            title="Snap to 5-unit grid"
            style={{ ...S.btnGrid, ...(snapToGrid ? S.btnGridOn : S.btnGridOff) }}
          >
            {snapToGrid ? "⊞ Grid" : "⊟ Grid"}
          </button>
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            style={{ ...S.btnUndoRedo, ...(canUndo ? S.btnUndoRedoOn : S.btnUndoRedoOff) }}
          >
            ↩
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
            style={{ ...S.btnUndoRedo, ...(canRedo ? S.btnUndoRedoOn : S.btnUndoRedoOff) }}
          >
            ↪
          </button>
          {setTransformMode && (
            <div style={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "rgb(100, 116, 139)", marginRight: 4 }}>Transform (G/R/S):</span>
              {(["translate", "rotate", "scale"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTransformMode(m)}
                  style={{ ...S.btnTransform, ...(transformMode === m ? S.btnTransformOn : S.btnTransformOff) }}
                  title={m === "translate" ? "Move (G)" : m === "rotate" ? "Rotate (R)" : "Scale (S)"}
                >
                  {m === "translate" ? "G Move" : m === "rotate" ? "R Rotate" : "S Scale"}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "buildings" && (
          <>
            <div style={S.sectionTitle}>Buildings in World</div>
            <div style={{ fontSize: 10, color: "rgb(100, 116, 139)", marginBottom: 8, lineHeight: 1.3 }}>
              Click any building to select. Use G/R/S or buttons above to Move, Rotate, Scale. Drag gizmo on canvas or edit below.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 128, overflowY: "auto" }}>
              {(placements ?? []).map((p) => (
                <div
                  key={p.elementKey}
                  onClick={() => { setSelectedElementKey(p.elementKey); setSelectedElementId(null); }}
                  style={{
                    ...S.listItem,
                    ...(selectedElementKey === p.elementKey ? S.listItemSelected : S.listItemHover),
                  }}
                >
                  {elementKeyToDisplayName(p.elementKey)}
                </div>
              ))}
            </div>
            {selectedPlacement && selectedElementKey && (
              <>
                <div style={{ ...S.sectionTitle, paddingTop: 8 }}>Properties</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 12 }}>
                  {(["posX", "posY", "posZ"] as const).map((f) => (
                    <div key={f}>
                      <label style={S.label}>{f}</label>
                      <input
                        type="number"
                        step={0.5}
                        value={selectedPlacement[f]}
                        onChange={(e) => onNumericChange(selectedElementKey, f, Number(e.target.value))}
                        style={S.input}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Rot Y°</label>
                    <input
                      type="number"
                      step={5}
                      value={selectedPlacement.rotY}
                      onChange={(e) => onNumericChange(selectedElementKey, "rotY", Number(e.target.value))}
                      style={S.input}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Scale ({selectedPlacement.scale.toFixed(2)}×)</label>
                    <input
                      type="range"
                      min={0.3}
                      max={3}
                      step={0.05}
                      value={selectedPlacement.scale}
                      onChange={(e) => onNumericChange(selectedElementKey, "scale", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "rgb(6, 182, 212)" }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const snap = (v: number) => (snapToGrid ? Math.round(v / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : v);
                    onNumericChange(selectedElementKey, "posX", snap(selectedPlacement.posX));
                    onNumericChange(selectedElementKey, "posZ", snap(selectedPlacement.posZ));
                  }}
                  style={{ ...S.btnCyan, width: "100%", marginTop: 8 }}
                >
                  📍 Move to Position
                </button>
                <div style={{ paddingTop: 8, fontSize: 12, color: "rgb(148, 163, 184)" }}>Enter building</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {elementKeyToBuildingRoute(selectedPlacement.elementKey) === "nexus" && (
                    <button type="button" onClick={() => setBuildingToEnter("nexus")} style={S.btnCyan}>🚪 Nexus</button>
                  )}
                  {elementKeyToBuildingRoute(selectedPlacement.elementKey) === "meridian" && (
                    <button type="button" onClick={() => setBuildingToEnter("meridian")} style={S.btnCyan}>🚪 Meridian</button>
                  )}
                  {elementKeyToBuildingRoute(selectedPlacement.elementKey) === "apex" && (
                    <button type="button" onClick={() => setBuildingToEnter("apex")} style={S.btnAmber}>🚪 Apex</button>
                  )}
                  {elementKeyToBuildingRoute(selectedPlacement.elementKey) === "harborview" && (
                    <button type="button" onClick={() => setBuildingToEnter("harborview")} style={S.btnSky}>🚪 Harborview</button>
                  )}
                </div>
                {BUILT_IN_KEYS.has(selectedPlacement.elementKey) && onAddMeetingNode && (
                  <button
                    type="button"
                    onClick={() => onAddMeetingNode(selectedPlacement.elementKey)}
                    style={{ ...S.btnAmber, width: "100%", marginTop: 8 }}
                  >
                    📡 Add Meeting Node
                  </button>
                )}
                {BUILT_IN_KEYS.has(selectedPlacement.elementKey) && meetingNodes.filter((n) => n.parentElementKey === selectedPlacement.elementKey).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={S.sectionTitle}>Meeting Nodes</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {meetingNodes
                        .filter((n) => n.parentElementKey === selectedPlacement.elementKey)
                        .map((n) => (
                          <div
                            key={n.id}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              background: "rgba(30,41,59,0.6)",
                              border: "1px solid rgba(6,182,212,0.2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 4,
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#e0f4ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                              {n.title}
                              <span style={{ marginLeft: 4, fontSize: 10, color: n.isActive ? "#86efac" : "#fca5a5" }}>
                                {n.isActive ? "●" : "○"}
                              </span>
                            </span>
                            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                              {onEditMeetingNode && (
                                <button type="button" onClick={() => onEditMeetingNode(n.id)} style={{ ...S.btnCyan, padding: "4px 8px", fontSize: 11 }} title="Edit">
                                  ✎
                                </button>
                              )}
                              {onDisableMeetingNode && (
                                <button
                                  type="button"
                                  onClick={() => onDisableMeetingNode(n.id, !n.isActive)}
                                  style={{ ...S.btnAmber, padding: "4px 8px", fontSize: 11 }}
                                  title={n.isActive ? "Disable" : "Enable"}
                                >
                                  {n.isActive ? "⏸" : "▶"}
                                </button>
                              )}
                              {onDeleteMeetingNode && (
                                <button type="button" onClick={() => confirm(`Delete meeting node "${n.title}"?`) && onDeleteMeetingNode(n.id)} style={{ ...S.btnRed, padding: "4px 8px", fontSize: 11 }} title="Delete">
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 4, paddingTop: 8 }}>
                  <button type="button" onClick={onImportBuilding} style={{ ...S.btnCyan, flex: 1 }}>⊕ Import Building</button>
                  <button type="button" onClick={() => onDelete(selectedElementKey)} style={S.btnRed}>Delete</button>
                </div>
              </>
            )}
          </>
        )}

        {tab === "elements" && (
          <>
            <div style={{ fontSize: 10, color: "rgb(100, 116, 139)", marginBottom: 8, lineHeight: 1.3 }}>
              <strong>To see elements in the 3D view:</strong> Click &quot;Seed Scenery&quot; (top bar) first — this adds trees, lights, benches you can select and move. The default terrain scenery is not selectable. Then click any element in the design area to select it; use G/R/S to Move, Rotate, Scale — same as buildings.
            </div>
            <div style={S.sectionTitle}>Object Library</div>
            <input
              type="text"
              placeholder="Search elements..."
              value={elementSearch}
              onChange={(e) => setElementSearch(e.target.value)}
              style={{ ...S.input, marginBottom: 8 }}
            />
            {filteredCategories.map((cat) => (
              <div key={cat.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleAccordion(cat.id)}
                  onKeyDown={(e) => e.key === "Enter" && toggleAccordion(cat.id)}
                  style={S.accordionHeader}
                >
                  {accordionOpen[cat.id] ? "▼" : "▶"} {cat.label}
                </div>
                {accordionOpen[cat.id] && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                    {cat.items.map(({ type, emoji, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => onAddElement(type)}
                        disabled={addingElement || isViewOnly}
                        style={{ ...S.elementBtn, opacity: addingElement || isViewOnly ? 0.5 : 1 }}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ ...S.sectionTitle, paddingTop: 8 }}>Placed Elements ({(elements ?? []).length})</div>
            <div style={{ fontSize: 11, color: "rgb(148, 163, 184)", marginBottom: 8, lineHeight: 1.4 }}>
              <strong>Select from 3D view:</strong> Click any element (tree, bench, light, etc.) in the design area to select it — same as buildings. Use G/R/S or the buttons above to Move, Rotate, Scale. You can also select from this list.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto", minHeight: 64, padding: 4, borderRadius: 6, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(6, 182, 212, 0.2)" }}>
              {(elements ?? []).length === 0 ? (
                <div style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "rgb(100, 116, 139)", textAlign: "center" }}>
                    No elements yet. Add from Object Library above, or seed default scenery:
                  </span>
                  {onSeedScenery && (
                    <button
                      type="button"
                      onClick={onSeedScenery}
                      disabled={seeding || isViewOnly}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        background: "rgba(16, 185, 129, 0.4)",
                        color: "rgb(110, 231, 183)",
                        border: "1px solid rgba(52, 211, 153, 0.5)",
                        cursor: seeding || isViewOnly ? "not-allowed" : "pointer",
                        opacity: seeding || isViewOnly ? 0.6 : 1,
                      }}
                    >
                      {seeding ? "Seeding…" : "🌲 Seed Scenery"}
                    </button>
                  )}
                </div>
              ) : (
                (elements ?? []).map((e) => {
                  const pal = ELEMENT_PALETTE.find((p) => p.type === e.type);
                  return (
                    <div
                      key={e.id}
                      onClick={() => { setSelectedElementId(e.id); setSelectedElementKey(null); }}
                      style={{
                        ...S.listItemElement,
                        ...(selectedElementId === e.id ? S.listItemElementSelected : S.listItemHover),
                      }}
                    >
                      <span>{pal?.emoji ?? "●"}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label || pal?.label || e.type}</span>
                      <span style={{ fontSize: 11, color: "rgb(100, 116, 139)", flexShrink: 0 }}>{e.posX.toFixed(0)},{e.posZ.toFixed(0)}</span>
                    </div>
                  );
                })
              )}
            </div>
            {selectedElement && selectedElementId != null && (
              <>
                <div style={{ ...S.sectionTitle, paddingTop: 8 }}>Selected Element Properties</div>
                <label style={S.label}>Label</label>
                <input
                  type="text"
                  value={selectedElement.label ?? ""}
                  onChange={(e) => onUpdateElementLabel(selectedElementId, e.target.value)}
                  placeholder="Optional label..."
                  style={{ ...S.input, marginBottom: 8 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 12 }}>
                  {(["posX", "posY", "posZ"] as const).map((f) => (
                    <div key={f}>
                      <label style={S.label}>{f}</label>
                      <input
                        type="number"
                        step={0.5}
                        value={selectedElement[f]}
                        onChange={(e) => onNumericChangeElement(selectedElementId, f, Number(e.target.value))}
                        style={S.input}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Rot Y°</label>
                    <input
                      type="number"
                      step={5}
                      value={selectedElement.rotY}
                      onChange={(e) => onNumericChangeElement(selectedElementId, "rotY", Number(e.target.value))}
                      style={S.input}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Scale ({selectedElement.scale.toFixed(2)}×)</label>
                    <input
                      type="range"
                      min={0.1}
                      max={5}
                      step={0.05}
                      value={selectedElement.scale}
                      onChange={(e) => onNumericChangeElement(selectedElementId, "scale", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "rgb(16, 185, 129)" }}
                    />
                  </div>
                </div>
                <label style={S.label}>Primary Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <input
                    type="color"
                    value={selectedElement.colorHex != null ? `#${selectedElement.colorHex.toString(16).padStart(6, "0")}` : "#2d7a2d"}
                    onChange={(e) => onUpdateElementColor(selectedElementId, parseInt(e.target.value.slice(1), 16), selectedElement.color2Hex ?? null)}
                    style={{ width: 32, height: 24, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent" }}
                  />
                  <span style={{ fontSize: 12, color: "rgb(148, 163, 184)" }}>
                    {selectedElement.colorHex != null ? `#${selectedElement.colorHex.toString(16).padStart(6, "0")}` : "default"}
                  </span>
                </div>
                <label style={S.label}>Secondary Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    type="color"
                    value={selectedElement.color2Hex != null ? `#${selectedElement.color2Hex.toString(16).padStart(6, "0")}` : "#5c3d1e"}
                    onChange={(e) => onUpdateElementColor(selectedElementId, selectedElement.colorHex ?? null, parseInt(e.target.value.slice(1), 16))}
                    style={{ width: 32, height: 24, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent" }}
                  />
                  <span style={{ fontSize: 12, color: "rgb(148, 163, 184)" }}>
                    {selectedElement.color2Hex != null ? `#${selectedElement.color2Hex.toString(16).padStart(6, "0")}` : "default"}
                  </span>
                </div>
                <button type="button" onClick={() => onDeleteElement(selectedElementId)} style={S.btnRed}>
                  Delete
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
