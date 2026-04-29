"use client";

import type { Placement } from "./TrooWorldUnifiedViewer";
import type { WorldElementData } from "@/lib/troo-world/WorldElementSystem";

// Full object library from Updated — all objects can be added and moved via modeling page
const ELEMENT_CATEGORIES: { label: string; items: { type: WorldElementData["type"]; emoji: string; label: string }[] }[] = [
  {
    label: "🌿 Nature",
    items: [
      { type: "tree", emoji: "🌲", label: "Tree" },
      { type: "tree_cluster", emoji: "🌳", label: "Tree Cluster" },
      { type: "bush", emoji: "🌿", label: "Bush" },
      { type: "flower_bed", emoji: "🌸", label: "Flower Bed" },
      { type: "grass_patch", emoji: "🟩", label: "Grass Patch" },
    ],
  },
  {
    label: "🛣️ Roads & Paths",
    items: [
      { type: "road_segment", emoji: "🛣️", label: "Road Segment" },
      { type: "road_cross", emoji: "✚", label: "Road Cross" },
      { type: "road_arm", emoji: "━", label: "Road Arm" },
      { type: "roundabout", emoji: "🔄", label: "Roundabout" },
      { type: "crosswalk", emoji: "🦓", label: "Crosswalk" },
      { type: "sidewalk_tile", emoji: "⬜", label: "Sidewalk Tile" },
      { type: "curb_strip", emoji: "▬", label: "Curb Strip" },
    ],
  },
  {
    label: "🏛️ Structures",
    items: [
      { type: "plaza_pad", emoji: "⬛", label: "Plaza Pad" },
      { type: "fountain", emoji: "⛲", label: "Fountain" },
      { type: "planter_box", emoji: "🪴", label: "Planter Box" },
      { type: "steps", emoji: "🪜", label: "Steps" },
      { type: "wall_segment", emoji: "🧱", label: "Wall Segment" },
      { type: "fence_segment", emoji: "🚧", label: "Fence Segment" },
      { type: "ground_patch", emoji: "🟫", label: "Ground Patch" },
      { type: "gravel_patch", emoji: "⬜", label: "Gravel Patch" },
    ],
  },
  {
    label: "🪑 Street Furniture",
    items: [
      { type: "street_light", emoji: "💡", label: "Street Light" },
      { type: "bench", emoji: "🪑", label: "Bench" },
      { type: "trash_bin", emoji: "🗑️", label: "Trash Bin" },
      { type: "bollard", emoji: "🔵", label: "Bollard" },
    ],
  },
  {
    label: "💧 Water",
    items: [
      { type: "lake", emoji: "🏞️", label: "Lake" },
      { type: "pond", emoji: "💧", label: "Pond" },
      { type: "river_segment", emoji: "🌊", label: "River Segment" },
    ],
  },
  {
    label: "📦 Custom",
    items: [
      { type: "glb_import", emoji: "📦", label: "GLB Import" },
    ],
  },
];
const ELEMENT_PALETTE = ELEMENT_CATEGORIES.flatMap((c) => c.items);

const PROTOCOL_OPTIONS = [
  { value: "general", label: "🤖 General Assistant" },
  { value: "scheduling", label: "📅 Scheduling & Booking" },
  { value: "sales", label: "💰 Sales & Closing" },
  { value: "customer_service", label: "🎧 Customer Service" },
  { value: "technical_support", label: "🔧 Technical Support" },
  { value: "hr", label: "👥 HR & Onboarding" },
  { value: "finance", label: "💳 Finance & Billing" },
  { value: "reception", label: "🏢 Reception & Directions" },
];

const SNAP_GRID_SIZE = 5;

type AgentProtocol = {
  agentId: string;
  agentName: string;
  protocol: string;
  businessName?: string | null;
  businessHours?: string | null;
  services?: string | null;
  systemPromptOverride?: string | null;
  animationOverride?: string | null;
  appearanceJson?: string | null;
};

export interface TrooWorldSidebarProps {
  placements: Placement[] | null;
  elements: WorldElementData[] | null;
  selectedElementKey: string | null;
  setSelectedElementKey: (k: string | null) => void;
  selectedElementId: number | null;
  setSelectedElementId: (id: number | null) => void;
  sidebarTab: "buildings" | "elements" | "agents";
  setSidebarTab: (t: "buildings" | "elements" | "agents") => void;
  snapToGrid: boolean;
  setSnapToGrid: (fn: (s: boolean) => boolean) => void;
  transformMode: "translate" | "rotate" | "scale";
  setTransformMode: (m: "translate" | "rotate" | "scale") => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNumericChange: (key: string, field: keyof Placement, value: number) => void;
  onNumericChangeElement: (id: number, field: keyof WorldElementData, value: number) => void;
  onAddElement: (type: WorldElementData["type"]) => void;
  onUpdateElementLabel: (id: number, label: string) => void;
  onUpdateElementColor: (id: number, colorHex: number | null, color2Hex: number | null) => void;
  onDeleteElement: (id: number) => void;
  onDuplicate: () => void;
  onDelete: (key: string) => void;
  setBuildingToEnter: (b: "nexus" | "meridian" | "apex" | "harborview" | null) => void;
  setIsEditMode: (fn: (e: boolean) => boolean) => void;
  setWalkMode: (fn: (w: boolean) => boolean) => void;
  addingElement: boolean;
  isViewOnly: boolean;
  agentProtocols: AgentProtocol[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  agentId: string;
  setAgentId: (s: string) => void;
  agentName: string;
  setAgentName: (s: string) => void;
  agentProtocol: string;
  setAgentProtocol: (s: string) => void;
  agentBusiness: string;
  setAgentBusiness: (s: string) => void;
  agentHours: string;
  setAgentHours: (s: string) => void;
  agentServices: string;
  setAgentServices: (s: string) => void;
  agentPromptOverride: string;
  setAgentPromptOverride: (s: string) => void;
  agentAnimation: string;
  setAgentAnimation: (s: string) => void;
  agentSkinColor: string;
  setAgentSkinColor: (s: string) => void;
  agentShirtColor: string;
  setAgentShirtColor: (s: string) => void;
  agentPantsColor: string;
  setAgentPantsColor: (s: string) => void;
  agentSaving: boolean;
  onSaveAgent: () => void;
  onDeleteAgent: (id: string) => void;
}

export default function TrooWorldSidebar(props: TrooWorldSidebarProps) {
  const {
    placements,
    elements,
    selectedElementKey,
    setSelectedElementKey,
    selectedElementId,
    setSelectedElementId,
    sidebarTab,
    setSidebarTab,
    snapToGrid,
    setSnapToGrid,
    transformMode,
    setTransformMode,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onNumericChange,
    onNumericChangeElement,
    onAddElement,
    onUpdateElementLabel,
    onUpdateElementColor,
    onDeleteElement,
    onDuplicate,
    onDelete,
    setBuildingToEnter,
    setIsEditMode,
    setWalkMode,
    addingElement,
    isViewOnly,
    agentProtocols,
    selectedAgentId,
    setSelectedAgentId,
    agentId,
    setAgentId,
    agentName,
    setAgentName,
    agentProtocol,
    setAgentProtocol,
    agentBusiness,
    setAgentBusiness,
    agentHours,
    setAgentHours,
    agentServices,
    setAgentServices,
    agentPromptOverride,
    setAgentPromptOverride,
    agentAnimation,
    setAgentAnimation,
    agentSkinColor,
    setAgentSkinColor,
    agentShirtColor,
    setAgentShirtColor,
    agentPantsColor,
    setAgentPantsColor,
    agentSaving,
    onSaveAgent,
    onDeleteAgent,
  } = props;

  const selectedPlacement = (placements ?? []).find((p) => p.elementKey === selectedElementKey);
  const selectedElement = (elements ?? []).find((e) => e.id === selectedElementId);

  return (
    <div className="w-64 flex-shrink-0 border-r border-cyan-500/30 bg-slate-950/95 overflow-y-auto">
      <div className="p-3 space-y-3">
        <div className="flex gap-1">
          {(["buildings", "elements", "agents"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSidebarTab(t)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium capitalize ${sidebarTab === t ? "bg-cyan-500/40 text-cyan-200 border border-cyan-400/50" : "bg-slate-800/60 text-slate-400 border border-cyan-500/20 hover:bg-slate-700"}`}
            >
              {t === "buildings" ? "🏢" : t === "elements" ? "🌲" : "🤖"} {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center flex-wrap">
          <button
            type="button"
            onClick={() => setSnapToGrid((s) => !s)}
            title="Snap to 5-unit grid"
            className={`px-2 py-1.5 rounded text-xs font-medium ${snapToGrid ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/50" : "bg-slate-800/60 text-slate-400 border border-cyan-500/20"}`}
          >
            {snapToGrid ? "⊞ Grid" : "⊟ Grid"}
          </button>
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            className={`px-2 py-1.5 rounded text-xs font-medium ${canUndo ? "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50" : "bg-slate-800/40 text-slate-500 border border-slate-600/50 cursor-not-allowed"}`}
          >
            ↩
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
            className={`px-2 py-1.5 rounded text-xs font-medium ${canRedo ? "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50" : "bg-slate-800/40 text-slate-500 border border-slate-600/50 cursor-not-allowed"}`}
          >
            ↪
          </button>
          <div className="flex gap-0.5" title="G=Move R=Rotate S=Scale">
            <button
              type="button"
              onClick={() => setTransformMode("translate")}
              className={`px-2 py-1.5 rounded text-xs font-medium ${transformMode === "translate" ? "bg-cyan-500 text-black" : "bg-slate-800 text-cyan-400 hover:bg-slate-700"}`}
              title="Translate (G)"
            >
              G
            </button>
            <button
              type="button"
              onClick={() => setTransformMode("rotate")}
              className={`px-2 py-1.5 rounded text-xs font-medium ${transformMode === "rotate" ? "bg-cyan-500 text-black" : "bg-slate-800 text-cyan-400 hover:bg-slate-700"}`}
              title="Rotate (R)"
            >
              R
            </button>
            <button
              type="button"
              onClick={() => setTransformMode("scale")}
              className={`px-2 py-1.5 rounded text-xs font-medium ${transformMode === "scale" ? "bg-cyan-500 text-black" : "bg-slate-800 text-cyan-400 hover:bg-slate-700"}`}
              title="Scale (S)"
            >
              S
            </button>
          </div>
        </div>
        {sidebarTab === "buildings" && (
          <>
            <div className="text-xs uppercase tracking-wide text-slate-400">Buildings in World</div>
            <div className="text-[10px] text-slate-500 leading-snug mb-2">
              Click a building below to select it. Then drag the <span className="text-red-400">red</span>/<span className="text-blue-400">blue</span> gizmo arrows on the canvas to move it, or type exact coordinates below.
            </div>
            <div className="space-y-0.5 max-h-32 overflow-auto">
              {(placements ?? []).map((p) => (
                <div
                  key={p.elementKey}
                  onClick={() => { setSelectedElementKey(p.elementKey); setSelectedElementId(null); }}
                  className={`px-2 py-1.5 rounded text-sm cursor-pointer truncate ${selectedElementKey === p.elementKey ? "bg-cyan-500/30 text-cyan-300" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  {p.elementKey}
                </div>
              ))}
            </div>
            {selectedPlacement && selectedElementKey && (
              <>
                <div className="text-xs uppercase tracking-wide text-slate-400 pt-2">Properties</div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(["posX", "posY", "posZ"] as const).map((f) => (
                    <div key={f}>
                      <label className="text-slate-500 block">{f}</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedPlacement[f]}
                        onChange={(e) => onNumericChange(selectedElementKey, f, Number(e.target.value))}
                        className="w-full rounded border border-white/15 bg-slate-900 px-1.5 py-1 text-white"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-slate-500 block">Rot Y°</label>
                    <input
                      type="number"
                      step="5"
                      value={selectedPlacement.rotY}
                      onChange={(e) => onNumericChange(selectedElementKey, "rotY", Number(e.target.value))}
                      className="w-full rounded border border-white/15 bg-slate-900 px-1.5 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">Scale ({selectedPlacement.scale.toFixed(2)}×)</label>
                    <input
                      type="range"
                      min="0.3"
                      max="3"
                      step="0.05"
                      value={selectedPlacement.scale}
                      onChange={(e) => onNumericChange(selectedElementKey, "scale", Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const snap = (v: number) => (snapToGrid ? Math.round(v / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : v);
                    const x = snap(selectedPlacement.posX);
                    const z = snap(selectedPlacement.posZ);
                    onNumericChange(selectedElementKey, "posX", x);
                    onNumericChange(selectedElementKey, "posZ", z);
                  }}
                  className="w-full mt-2 rounded border border-cyan-500/50 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10"
                >
                  📍 Move to Position
                </button>
                <div className="pt-2 text-xs text-slate-400">Enter building</div>
                <div className="flex flex-wrap gap-1">
                  {selectedPlacement.elementKey.includes("nexus") && (
                    <button
                      type="button"
                      onClick={() => { setBuildingToEnter("nexus"); setIsEditMode(() => false); setWalkMode(() => false); }}
                      className="rounded border border-cyan-500/50 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10"
                    >
                      🚪 Nexus
                    </button>
                  )}
                  {selectedPlacement.elementKey.includes("meridian") && (
                    <button
                      type="button"
                      onClick={() => { setBuildingToEnter("meridian"); setIsEditMode(() => false); setWalkMode(() => false); }}
                      className="rounded border border-cyan-500/50 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10"
                    >
                      🚪 Meridian
                    </button>
                  )}
                  {selectedPlacement.elementKey.includes("apex") && (
                    <button
                      type="button"
                      onClick={() => { setBuildingToEnter("apex"); setIsEditMode(() => false); setWalkMode(() => false); }}
                      className="rounded border border-amber-500/50 px-2 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10"
                    >
                      🚪 Apex
                    </button>
                  )}
                  {selectedPlacement.elementKey.includes("harborview") && (
                    <button
                      type="button"
                      onClick={() => { setBuildingToEnter("harborview"); setIsEditMode(() => false); setWalkMode(() => false); }}
                      className="rounded border border-sky-500/50 px-2 py-1.5 text-xs text-sky-400 hover:bg-sky-500/10"
                    >
                      🚪 Harborview
                    </button>
                  )}
                </div>
                <div className="flex gap-1 pt-2">
                  <button
                    type="button"
                    onClick={onDuplicate}
                    className="flex-1 rounded border border-cyan-500/50 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(selectedElementKey)}
                    className="rounded border border-red-500/50 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {sidebarTab === "elements" && (
          <>
            <div className="text-xs uppercase tracking-wide text-slate-400">Add Element</div>
            {ELEMENT_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div className="text-[10px] text-slate-500 mt-2 mb-0.5">{cat.label}</div>
                <div className="grid grid-cols-2 gap-1">
                  {cat.items.map(({ type, emoji, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onAddElement(type)}
                      disabled={addingElement || isViewOnly}
                      className="px-2 py-1.5 rounded text-xs font-medium border border-cyan-500/30 bg-slate-800/60 text-cyan-400 hover:bg-cyan-500/15 disabled:opacity-50"
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-xs uppercase tracking-wide text-slate-400 pt-2">World Elements ({(elements ?? []).length})</div>
            <div className="space-y-0.5 max-h-32 overflow-auto">
              {(elements ?? []).map((e) => {
                const pal = ELEMENT_PALETTE.find((p) => p.type === e.type);
                return (
                  <div
                    key={e.id}
                    onClick={() => { setSelectedElementId(e.id); setSelectedElementKey(null); }}
                    className={`px-2 py-1.5 rounded text-sm cursor-pointer truncate flex items-center gap-1 ${selectedElementId === e.id ? "bg-emerald-500/30 text-emerald-300" : "text-slate-300 hover:bg-slate-800"}`}
                  >
                    <span>{pal?.emoji ?? "●"}</span>
                    <span className="truncate">{e.label || pal?.label || e.type}</span>
                    <span className="text-slate-500 text-xs shrink-0">{e.posX.toFixed(0)},{e.posZ.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
            {selectedElement && selectedElementId != null && (
              <>
                <div className="text-xs uppercase tracking-wide text-slate-400 pt-2">Element Properties</div>
                <label className="text-slate-500 block text-xs mt-1">Label</label>
                <input
                  type="text"
                  value={selectedElement.label ?? ""}
                  onChange={(e) => onUpdateElementLabel(selectedElementId, e.target.value)}
                  placeholder="Optional label..."
                  className="w-full rounded border border-white/15 bg-slate-900 px-1.5 py-1 text-white text-xs mb-2"
                />
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(["posX", "posY", "posZ"] as const).map((f) => (
                    <div key={f}>
                      <label className="text-slate-500 block">{f}</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedElement[f]}
                        onChange={(e) => onNumericChangeElement(selectedElementId, f, Number(e.target.value))}
                        className="w-full rounded border border-white/15 bg-slate-900 px-1.5 py-1 text-white"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-slate-500 block">Rot Y°</label>
                    <input
                      type="number"
                      step="5"
                      value={selectedElement.rotY}
                      onChange={(e) => onNumericChangeElement(selectedElementId, "rotY", Number(e.target.value))}
                      className="w-full rounded border border-white/15 bg-slate-900 px-1.5 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">Scale ({selectedElement.scale.toFixed(2)}×)</label>
                    <input
                      type="range"
                      min="0.1"
                      max="5"
                      step="0.05"
                      value={selectedElement.scale}
                      onChange={(e) => onNumericChangeElement(selectedElementId, "scale", Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
                <label className="text-slate-500 block text-xs mt-2">Primary Color</label>
                <div className="flex gap-2 items-center mb-1">
                  <input
                    type="color"
                    value={selectedElement.colorHex != null ? `#${selectedElement.colorHex.toString(16).padStart(6, "0")}` : "#2d7a2d"}
                    onChange={(e) => onUpdateElementColor(selectedElementId, parseInt(e.target.value.slice(1), 16), selectedElement.color2Hex ?? null)}
                    className="w-8 h-6 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-slate-400 text-xs">
                    {selectedElement.colorHex != null ? `#${selectedElement.colorHex.toString(16).padStart(6, "0")}` : "default"}
                  </span>
                </div>
                <label className="text-slate-500 block text-xs mt-1">Secondary Color</label>
                <div className="flex gap-2 items-center mb-2">
                  <input
                    type="color"
                    value={selectedElement.color2Hex != null ? `#${selectedElement.color2Hex.toString(16).padStart(6, "0")}` : "#5c3d1e"}
                    onChange={(e) => onUpdateElementColor(selectedElementId, selectedElement.colorHex ?? null, parseInt(e.target.value.slice(1), 16))}
                    className="w-8 h-6 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-slate-400 text-xs">
                    {selectedElement.color2Hex != null ? `#${selectedElement.color2Hex.toString(16).padStart(6, "0")}` : "default"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteElement(selectedElementId)}
                  className="mt-2 rounded border border-red-500/50 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </>
            )}
          </>
        )}
        {sidebarTab === "agents" && (
          <>
            <div className="text-xs uppercase tracking-wide text-slate-400">Assigned Agents ({agentProtocols.length})</div>
            <div className="space-y-0.5 max-h-32 overflow-auto">
              {agentProtocols.map((ap) => (
                <div
                  key={ap.agentId}
                  onClick={() => {
                    setSelectedAgentId(ap.agentId);
                    setAgentId(ap.agentId);
                    setAgentName(ap.agentName);
                    setAgentProtocol(ap.protocol);
                    setAgentBusiness(ap.businessName ?? "");
                    setAgentHours(ap.businessHours ?? "");
                    setAgentServices(ap.services ?? "");
                    setAgentPromptOverride(ap.systemPromptOverride ?? "");
                    setAgentAnimation(ap.animationOverride ?? "idle");
                    if (ap.appearanceJson) {
                      try {
                        const app = JSON.parse(ap.appearanceJson);
                        setAgentSkinColor(app.skinColor ?? "#f5c5a3");
                        setAgentShirtColor(app.shirtColor ?? "#2244aa");
                        setAgentPantsColor(app.pantsColor ?? "#333355");
                      } catch { /* ignore */ }
                    }
                  }}
                  className={`px-2 py-1.5 rounded text-sm cursor-pointer truncate flex items-center gap-1 ${selectedAgentId === ap.agentId ? "bg-cyan-500/30 text-cyan-300" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  <span>🤖</span>
                  <span className="truncate">{ap.agentName}</span>
                  <span className="text-slate-500 text-xs shrink-0">{ap.protocol}</span>
                </div>
              ))}
              {agentProtocols.length === 0 && (
                <div className="text-slate-500 text-xs italic py-2">No agents assigned yet.</div>
              )}
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-400 pt-2">Assign / Edit Agent</div>
            <div className="space-y-2 pt-1">
              <label className="text-slate-500 block text-xs">Agent ID (e.g. worker_0)</label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="worker_0"
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              />
              <label className="text-slate-500 block text-xs">Agent Name</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Alex Chen"
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              />
              <label className="text-slate-500 block text-xs">Business Protocol</label>
              <select
                value={agentProtocol}
                onChange={(e) => setAgentProtocol(e.target.value)}
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              >
                {PROTOCOL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <label className="text-slate-500 block text-xs">Business Name</label>
              <input
                type="text"
                value={agentBusiness}
                onChange={(e) => setAgentBusiness(e.target.value)}
                placeholder="Nexus Corp"
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              />
              <label className="text-slate-500 block text-xs">Business Hours</label>
              <input
                type="text"
                value={agentHours}
                onChange={(e) => setAgentHours(e.target.value)}
                placeholder="Mon-Fri 9am-5pm"
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              />
              <label className="text-slate-500 block text-xs">Services (comma-separated)</label>
              <input
                type="text"
                value={agentServices}
                onChange={(e) => setAgentServices(e.target.value)}
                placeholder="Consulting, Support, Sales"
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              />
              <label className="text-slate-500 block text-xs">System Prompt Override</label>
              <textarea
                value={agentPromptOverride}
                onChange={(e) => setAgentPromptOverride(e.target.value)}
                placeholder="Leave blank to use auto-generated prompt..."
                rows={3}
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs resize-none"
              />
              <label className="text-slate-500 block text-xs">Animation</label>
              <select
                value={agentAnimation}
                onChange={(e) => setAgentAnimation(e.target.value)}
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-white text-xs"
              >
                {["idle", "walk", "sit", "type", "talk", "phone"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <div className="text-xs text-slate-400 pt-1">Character Appearance</div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: "Skin", value: agentSkinColor, set: setAgentSkinColor },
                  { label: "Shirt", value: agentShirtColor, set: setAgentShirtColor },
                  { label: "Pants", value: agentPantsColor, set: setAgentPantsColor },
                ].map(({ label, value, set }) => (
                  <div key={label} className="text-center">
                    <div className="text-slate-500 text-xs mb-0.5">{label}</div>
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="w-full h-6 rounded border-0 cursor-pointer bg-transparent"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={onSaveAgent}
                disabled={agentSaving}
                className="w-full mt-2 rounded border border-cyan-500/50 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {agentSaving ? "⏳ Saving…" : "💾 Save Agent Protocol"}
              </button>
              {selectedAgentId && (
                <button
                  type="button"
                  onClick={() => { if (confirm(`Remove protocol for "${agentName}"?`)) onDeleteAgent(selectedAgentId); }}
                  className="w-full rounded border border-red-500/50 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  🗑 Remove Protocol
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedAgentId(null);
                  setAgentId("");
                  setAgentName("");
                  setAgentProtocol("general");
                  setAgentBusiness("");
                  setAgentHours("");
                  setAgentServices("");
                  setAgentPromptOverride("");
                  setAgentAnimation("idle");
                  setAgentSkinColor("#f5c5a3");
                  setAgentShirtColor("#2244aa");
                  setAgentPantsColor("#333355");
                }}
                className="w-full rounded border border-slate-500/50 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
              >
                Clear Form
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
