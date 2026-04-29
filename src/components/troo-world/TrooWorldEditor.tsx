"use client";

/**
 * TrooWorldEditor — Admin-only editor for Troo World placements and scenery elements.
 * Fetches placements + elements from admin API, allows dragging, saves to API.
 * Supports uploading new GLB files and seeding default scenery (trees, lights, benches).
 */
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Placement } from "./TrooWorldUnifiedViewer";
import type { WorldElementData } from "@/lib/troo-world/WorldElementSystem";
import WorldInspector, {
  type InspectorTarget,
  type InspectorPlacement,
  type InspectorElement,
  type SceneLighting,
} from "./WorldInspector";
import TrooWorldSidebar from "./TrooWorldSidebar";

const TrooWorldUnifiedViewer = dynamic(
  () => import("./TrooWorldUnifiedViewer"),
  { ssr: false }
);

const DEFAULT_WORLD_ID = "default";

const ELEMENT_PALETTE: { type: WorldElementData["type"]; emoji: string; label: string }[] = [
  { type: "tree", emoji: "🌲", label: "Tree" },
  { type: "street_light", emoji: "💡", label: "Street Light" },
  { type: "bench", emoji: "🪑", label: "Bench" },
  { type: "road_segment", emoji: "🛣️", label: "Road Segment" },
  { type: "crosswalk", emoji: "🦓", label: "Crosswalk" },
  { type: "bush", emoji: "🌿", label: "Bush" },
  { type: "fountain", emoji: "⛲", label: "Fountain" },
];

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

const BUILT_IN_KEYS = new Set(["nexus-tower", "meridian-tower", "apex-tower", "harborview-tower"]);

export default function TrooWorldEditor() {
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [elements, setElements] = useState<WorldElementData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingElements, setSavingElements] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [worldId, setWorldId] = useState(DEFAULT_WORLD_ID);
  const [addOpen, setAddOpen] = useState(false);
  const [elementKey, setElementKey] = useState("");
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditMode, setIsEditMode] = useState(true);
  const [walkMode, setWalkMode] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number>>(new Set());
  const [sidebarTab, setSidebarTab] = useState<"buildings" | "elements" | "agents">("buildings");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [buildingToEnter, setBuildingToEnter] = useState<"nexus" | "meridian" | "apex" | "harborview" | null>(null);
  const [addingElement, setAddingElement] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  const [agentProtocols, setAgentProtocols] = useState<Array<{ agentId: string; agentName: string; protocol: string; businessName?: string | null; businessHours?: string | null; services?: string | null; systemPromptOverride?: string | null; animationOverride?: string | null; appearanceJson?: string | null }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentProtocol, setAgentProtocol] = useState("general");
  const [agentBusiness, setAgentBusiness] = useState("");
  const [agentHours, setAgentHours] = useState("");
  const [agentServices, setAgentServices] = useState("");
  const [agentPromptOverride, setAgentPromptOverride] = useState("");
  const [agentAnimation, setAgentAnimation] = useState("idle");
  const [agentSkinColor, setAgentSkinColor] = useState("#f5c5a3");
  const [agentShirtColor, setAgentShirtColor] = useState("#2244aa");
  const [agentPantsColor, setAgentPantsColor] = useState("#333355");
  const [agentSaving, setAgentSaving] = useState(false);
  const [sceneLighting, setSceneLighting] = useState<SceneLighting>({
    ambientIntensity: 0.7,
    sunIntensity: 1.8,
    sunAzimuth: 45,
    sunElevation: 60,
  });
  const moveHistoryRef = useRef<Array<{ type: "placement" | "element"; key: string | number; prev: unknown }>>([]);
  const moveRedoStackRef = useRef<typeof moveHistoryRef.current>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const SNAP_GRID_SIZE = 5;

  const loadPlacements = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/troo-world/placements?worldId=${encodeURIComponent(worldId)}`, { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setPlacements(data.placements ?? []);
        setIsViewOnly(false);
        return;
      }
      if (r.status === 401) {
        const pub = await fetch(`/api/troo-world/placements?worldId=${encodeURIComponent(worldId)}`, { credentials: "include" });
        const pubData = await pub.json().catch(() => ({}));
        if (pub.ok && Array.isArray(pubData.placements)) {
          setPlacements(pubData.placements);
          setIsViewOnly(true);
          setError("View only — log in as admin to save edits");
          return;
        }
      }
      throw new Error(data?.error || "Failed to load placements");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPlacements([]);
      setIsViewOnly(false);
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  const loadElements = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/troo-world/elements?worldId=${encodeURIComponent(worldId)}`, { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (r.ok) setElements(data.elements ?? []);
      else setElements([]);
    } catch {
      setElements([]);
    }
  }, [worldId]);

  const handleSeedElements = useCallback(async () => {
    setSeeding(true);
    setError("");
    setOkMsg("");
    try {
      const r = await fetch(`/api/admin/troo-world/elements/seed?worldId=${encodeURIComponent(worldId)}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Seed failed");
      setElements(data.elements ?? []);
      setPendingDeleteIds(new Set());
      setOkMsg(`Seeded ${data.count ?? 0} scenery elements. Changes appear in TROO WORLD.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }, [worldId]);

  useEffect(() => {
    loadPlacements();
  }, [loadPlacements]);

  useEffect(() => {
    if (!loading) loadElements();
  }, [loading, loadElements]);

  useEffect(() => {
    if (!addOpen) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-add-glb-panel]")) return;
      setAddOpen(false);
    };
    document.addEventListener("click", onOutside);
    return () => document.removeEventListener("click", onOutside);
  }, [addOpen]);

  const handleDelete = useCallback((key: string) => {
    setPlacements((prev) => (prev ?? []).filter((p) => p.elementKey !== key));
    if (selectedElementKey === key) setSelectedElementKey(null);
    setOkMsg(`Removed ${key}. Save to apply.`);
  }, [selectedElementKey]);

  const handleDeleteElement = useCallback((id: number) => {
    setElements((prev) => (prev ?? []).filter((e) => e.id !== id));
    setPendingDeleteIds((prev) => new Set(prev).add(id));
    if (selectedElementId === id) setSelectedElementId(null);
    setOkMsg(`Removed element. Save Elements to apply.`);
  }, [selectedElementId]);

  const handleElementsChange = useCallback((updated: WorldElementData[]) => {
    setElements(updated);
  }, []);

  const handleNumericChangeElement = useCallback((id: number, field: keyof WorldElementData, value: number) => {
    setElements((prev) =>
      (prev ?? []).map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }, []);

  const handleUpdateElementLabel = useCallback((id: number, label: string) => {
    setElements((prev) =>
      (prev ?? []).map((e) => (e.id === id ? { ...e, label } : e))
    );
  }, []);

  const handleUpdateElementColor = useCallback((id: number, colorHex: number | null, color2Hex: number | null) => {
    setElements((prev) =>
      (prev ?? []).map((e) =>
        e.id === id ? { ...e, colorHex: colorHex ?? undefined, color2Hex: color2Hex ?? undefined } : e
      )
    );
  }, []);

  const handleAddElement = useCallback(
    async (type: WorldElementData["type"]) => {
      setAddingElement(true);
      setError("");
      setOkMsg("");
      try {
        const r = await fetch(`/api/admin/troo-world/elements?worldId=${encodeURIComponent(worldId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type, posX: 0, posY: 0, posZ: 0, rotY: 0, scale: 1 }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to add element");
        await loadElements();
        setOkMsg(`Added ${type}. Drag to position, then Save Elements.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add element");
      } finally {
        setAddingElement(false);
      }
    },
    [worldId, loadElements]
  );

  const handleSaveElements = useCallback(async () => {
    if (!elements?.length && pendingDeleteIds.size === 0) return;
    setSavingElements(true);
    setError("");
    setOkMsg("");
    try {
      for (const id of pendingDeleteIds) {
        const r = await fetch(`/api/admin/troo-world/elements/${id}`, { method: "DELETE", credentials: "include" });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to delete element");
        }
      }
      setPendingDeleteIds(new Set());
      for (const el of elements ?? []) {
        const r = await fetch(`/api/admin/troo-world/elements/${el.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            posX: el.posX,
            posY: el.posY,
            posZ: el.posZ,
            rotY: el.rotY,
            scale: el.scale,
            colorHex: el.colorHex ?? undefined,
            color2Hex: el.color2Hex ?? undefined,
            label: el.label ?? undefined,
          }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to update element");
        }
      }
      setOkMsg("Elements saved. Changes appear in TROO WORLD.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save elements");
    } finally {
      setSavingElements(false);
    }
  }, [elements, pendingDeleteIds]);

  const handleDuplicate = useCallback(() => {
    if (!selectedElementKey) return;
    const p = (placements ?? []).find((x) => x.elementKey === selectedElementKey);
    if (!p) return;
    const copy: Placement = {
      ...p,
      elementKey: `${p.elementKey}-copy-${Date.now().toString(36)}`,
      posX: p.posX + 5,
      posZ: p.posZ + 5,
    };
    setPlacements((prev) => [...(prev ?? []), copy]);
    setSelectedElementKey(copy.elementKey);
    setOkMsg(`Duplicated. Save to apply.`);
  }, [placements, selectedElementKey]);

  const handleNumericChange = useCallback((key: string, field: keyof Placement, value: number) => {
    setPlacements((prev) =>
      (prev ?? []).map((p) => (p.elementKey === key ? { ...p, [field]: value } : p))
    );
  }, []);

  const selectedPlacement = (placements ?? []).find((p) => p.elementKey === selectedElementKey);
  const selectedElement = (elements ?? []).find((e) => e.id === selectedElementId);

  useEffect(() => {
    if (selectedPlacement) {
      const route = selectedPlacement.elementKey.includes("nexus") ? "nexus" : selectedPlacement.elementKey.includes("meridian") ? "meridian" : selectedPlacement.elementKey.includes("apex") ? "apex" : selectedPlacement.elementKey.includes("harborview") ? "harborview" : undefined;
      setInspectorTarget({
        kind: "placement",
        elementKey: selectedPlacement.elementKey,
        name: selectedPlacement.elementKey,
        posX: selectedPlacement.posX,
        posY: selectedPlacement.posY,
        posZ: selectedPlacement.posZ,
        rotY: selectedPlacement.rotY,
        scale: selectedPlacement.scale,
        isBuiltIn: BUILT_IN_KEYS.has(selectedPlacement.elementKey),
        interiorRoute: route ? `/modeling?tab=troo-world&enter=${route}` : undefined,
      });
    } else if (selectedElement) {
      setInspectorTarget({
        kind: "element",
        id: selectedElement.id,
        type: selectedElement.type,
        label: selectedElement.label ?? null,
        posX: selectedElement.posX,
        posY: selectedElement.posY,
        posZ: selectedElement.posZ,
        rotY: selectedElement.rotY,
        scale: selectedElement.scale,
        colorHex: selectedElement.colorHex ?? null,
        color2Hex: selectedElement.color2Hex ?? null,
      });
    } else {
      setInspectorTarget(null);
    }
  }, [selectedPlacement, selectedElement]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTransformMode("translate"); }
      else if (e.key === "r") { e.preventDefault(); setTransformMode("rotate"); }
      else if (e.key === "s") { e.preventDefault(); setTransformMode("scale"); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedElementKey) handleDelete(selectedElementKey);
        else if (selectedElementId != null) handleDeleteElement(selectedElementId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedElementKey(null);
        setSelectedElementId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedElementKey, selectedElementId, handleDelete, handleDeleteElement]);

  const handlePlacementsChange = useCallback((updated: Placement[]) => {
    setPlacements(updated);
  }, []);

  const handlePlacementDragEnd = useCallback((key: string, prev: Placement) => {
    moveHistoryRef.current.push({ type: "placement", key, prev });
    moveRedoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleElementDragEnd = useCallback((id: number, prev: WorldElementData) => {
    moveHistoryRef.current.push({ type: "element", key: id, prev });
    moveRedoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const loadAgentProtocols = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/troo-world/agent-protocols", { credentials: "include" });
      const data = await r.json().catch(() => []);
      setAgentProtocols(Array.isArray(data) ? data : []);
    } catch {
      setAgentProtocols([]);
    }
  }, []);

  useEffect(() => {
    if (sidebarTab === "agents") loadAgentProtocols();
  }, [sidebarTab, loadAgentProtocols]);

  const handleSaveAgent = useCallback(async () => {
    if (!agentId.trim() || !agentName.trim()) {
      setError("Agent ID and Name are required.");
      return;
    }
    setAgentSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/troo-world/agent-protocols", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agentId: agentId.trim(),
          agentName: agentName.trim(),
          protocol: agentProtocol,
          businessName: agentBusiness || undefined,
          businessHours: agentHours || undefined,
          services: agentServices || undefined,
          systemPromptOverride: agentPromptOverride || undefined,
          animationOverride: agentAnimation,
          appearanceJson: JSON.stringify({
            skinColor: agentSkinColor,
            shirtColor: agentShirtColor,
            pantsColor: agentPantsColor,
          }),
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      await loadAgentProtocols();
      setOkMsg("Agent protocol saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save agent");
    } finally {
      setAgentSaving(false);
    }
  }, [agentId, agentName, agentProtocol, agentBusiness, agentHours, agentServices, agentPromptOverride, agentAnimation, agentSkinColor, agentShirtColor, agentPantsColor, loadAgentProtocols]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/admin/troo-world/agent-protocols/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete");
      await loadAgentProtocols();
      setSelectedAgentId(null);
      setOkMsg("Agent protocol removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }, [loadAgentProtocols]);

  const handleUndo = useCallback(() => {
    const history = moveHistoryRef.current;
    if (history.length === 0) return;
    const entry = history.pop()!;
    moveRedoStackRef.current.push(entry);
    setCanUndo(history.length > 0);
    setCanRedo(true);
    if (entry.type === "placement" && typeof entry.key === "string") {
      const prev = entry.prev as Placement;
      setPlacements((p) => (p ?? []).map((pl) => (pl.elementKey === entry.key ? prev : pl)));
    } else if (entry.type === "element" && typeof entry.key === "number") {
      const prev = entry.prev as WorldElementData;
      setElements((e) => (e ?? []).map((el) => (el.id === entry.key ? prev : el)));
    }
  }, []);

  const handleRedo = useCallback(() => {
    const redo = moveRedoStackRef.current;
    if (redo.length === 0) return;
    const entry = redo.pop()!;
    moveHistoryRef.current.push(entry);
    setCanUndo(true);
    setCanRedo(redo.length > 0);
    if (entry.type === "placement" && typeof entry.key === "string") {
      const prev = entry.prev as Placement;
      setPlacements((p) => (p ?? []).map((pl) => (pl.elementKey === entry.key ? prev : pl)));
    } else if (entry.type === "element" && typeof entry.key === "number") {
      const prev = entry.prev as WorldElementData;
      setElements((e) => (e ?? []).map((el) => (el.id === entry.key ? prev : el)));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!placements?.length) return;
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const r = await fetch("/api/admin/troo-world/placements", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          worldId,
          replace: true,
          placements: placements.map((p) => ({
            elementKey: p.elementKey,
            glbUrl: p.glbUrl,
            posX: p.posX,
            posY: p.posY,
            posZ: p.posZ,
            scale: p.scale,
            rotY: p.rotY,
          })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to save");
      setOkMsg("Placements saved. Changes will appear on the Troo World page.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [placements, worldId]);

  const handleUpload = useCallback(async () => {
    const input = fileInputRef.current;
    if (!input?.files?.length) {
      setError("Select a .glb file first");
      return;
    }
    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("File must be a .glb");
      return;
    }
    setUploading(true);
    setError("");
    setOkMsg("");
    try {
      const form = new FormData();
      form.append("glb", file);
      if (elementKey.trim()) form.append("elementKey", elementKey.trim());
      const r = await fetch("/api/admin/troo-world/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Upload failed");
      const { glbUrl, elementKey: key } = data;
      const newPlacement: Placement = {
        elementKey: key || `upload-${Date.now()}`,
        glbUrl,
        posX: 0,
        posY: 0,
        posZ: 0,
        scale: 1,
        rotY: 0,
      };
      setPlacements((prev) => [...(prev ?? []), newPlacement]);
      setOkMsg(`Added "${key}". Drag to position, then Save.`);
      setAddOpen(false);
      setElementKey("");
      input.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [elementKey]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#020408] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-cyan-400 font-semibold tracking-wider">Loading Troo World Editor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020408]">
      <div className="flex-shrink-0 z-20 flex items-center justify-between px-4 py-2 border-b border-cyan-500/30 bg-slate-950/90">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-cyan-400">Troo World Editor</h1>
          <a
            href="/modeling?tab=oasis"
            className="text-sm text-cyan-400 border border-cyan-500/50 rounded-lg px-3 py-1.5 hover:bg-cyan-500/10 transition-colors"
          >
            ← OASIS Modeling
          </a>
          <a
            href="/dashboard"
            className="text-sm text-cyan-400 border border-cyan-500/50 rounded-lg px-3 py-1.5 hover:bg-cyan-500/10 transition-colors"
          >
            ← Dashboard
          </a>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => { setIsEditMode((e) => !e); setWalkMode(false); if (!isEditMode) { setSelectedElementKey(null); setSelectedElementId(null); } }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isEditMode ? "bg-amber-500/30 border-2 border-amber-400 text-amber-300" : "bg-slate-800/80 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"}`}
          >
            ✏️ {isEditMode ? "Edit Mode ON" : "Edit Mode OFF"}
          </button>
          <button
            type="button"
            onClick={() => { setWalkMode((w) => !w); if (walkMode) setIsEditMode(true); }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${walkMode ? "bg-emerald-500/30 border-2 border-emerald-400 text-emerald-300" : "bg-slate-800/80 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"}`}
          >
            🚶 {walkMode ? "Walk Mode ON" : "Walk Around"}
          </button>
          <Link
            href="/app/agents"
            className="px-3 py-2 rounded-lg text-sm font-medium border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            👥 Agent Directory
          </Link>
          {!(placements ?? []).some((p) => p.elementKey === "apex-tower") && (
            <button
              type="button"
              onClick={() => {
                setPlacements((prev) => [...(prev ?? []), { elementKey: "apex-tower", glbUrl: "procedural:apex", posX: 0, posY: 0, posZ: 0, scale: 1, rotY: 0 }]);
                setOkMsg("Apex Tower added. Drag to position, then Save.");
              }}
              className="px-3 py-2 rounded-lg border border-amber-500/50 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-colors"
            >
              + Apex Tower
            </button>
          )}
          {!(placements ?? []).some((p) => p.elementKey === "harborview-tower") && (
            <button
              type="button"
              onClick={() => {
                setPlacements((prev) => [...(prev ?? []), { elementKey: "harborview-tower", glbUrl: "procedural:harborview", posX: -55, posY: 0, posZ: -55, scale: 1, rotY: 0 }]);
                setOkMsg("Harborview Tower added (SW quadrant). Drag to position, then Save.");
              }}
              className="px-3 py-2 rounded-lg border border-sky-500/50 text-sky-400 text-sm font-medium hover:bg-sky-500/10 transition-colors"
            >
              + Harborview Tower
            </button>
          )}
          <div className="relative" data-add-glb-panel>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAddOpen((o) => !o); }}
              className="px-3 py-2 rounded-lg border border-cyan-500/50 text-cyan-400 text-sm font-medium hover:bg-cyan-500/10 transition-colors"
            >
              ⊕ Import Building
            </button>
            {addOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 rounded-lg border border-cyan-500/30 bg-slate-900 shadow-xl z-30 p-3" onClick={(e) => e.stopPropagation()}>
                <label className="block text-xs text-slate-400 mb-1">Element key (optional)</label>
                <input
                  value={elementKey}
                  onChange={(e) => setElementKey(e.target.value)}
                  placeholder="e.g. fountain-01"
                  className="w-full rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm text-white mb-2"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb"
                  className="mb-2 text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 rounded bg-cyan-500 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "Upload & Add"}
                  </button>
                  <button
                    onClick={() => setAddOpen(false)}
                    className="rounded border border-white/20 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          {error && (
            <span className={`text-sm ${error.includes("View only") ? "text-amber-400" : "text-red-400"}`}>
              {error}
            </span>
          )}
          {okMsg && <span className="text-sm text-emerald-400 max-w-[200px] truncate" title={okMsg}>{okMsg}</span>}
          {!(elements ?? []).length && (
            <button
              type="button"
              onClick={handleSeedElements}
              disabled={seeding || isViewOnly}
              className="px-3 py-2 rounded-lg border border-emerald-500/50 text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {seeding ? "Seeding…" : "Seed Scenery"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !placements?.length || isViewOnly}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Placements"}
          </button>
          <button
            onClick={handleSaveElements}
            disabled={savingElements || isViewOnly || ((elements?.length ?? 0) === 0 && pendingDeleteIds.size === 0)}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingElements ? "Saving…" : "Save Elements"}
          </button>
        </div>
      </div>
      <div className="flex-1 relative flex flex-row-reverse">
        {sidebarOpen && (
          <TrooWorldSidebar
            placements={placements}
            elements={elements}
            selectedElementKey={selectedElementKey}
            setSelectedElementKey={setSelectedElementKey}
            selectedElementId={selectedElementId}
            setSelectedElementId={setSelectedElementId}
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            transformMode={transformMode}
            setTransformMode={setTransformMode}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onNumericChange={handleNumericChange}
            onNumericChangeElement={handleNumericChangeElement}
            onAddElement={handleAddElement}
            onUpdateElementLabel={handleUpdateElementLabel}
            onUpdateElementColor={handleUpdateElementColor}
            onDeleteElement={handleDeleteElement}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            setBuildingToEnter={setBuildingToEnter}
            setIsEditMode={setIsEditMode}
            setWalkMode={setWalkMode}
            addingElement={addingElement}
            isViewOnly={isViewOnly}
            agentProtocols={agentProtocols}
            selectedAgentId={selectedAgentId}
            setSelectedAgentId={setSelectedAgentId}
            agentId={agentId}
            setAgentId={setAgentId}
            agentName={agentName}
            setAgentName={setAgentName}
            agentProtocol={agentProtocol}
            setAgentProtocol={setAgentProtocol}
            agentBusiness={agentBusiness}
            setAgentBusiness={setAgentBusiness}
            agentHours={agentHours}
            setAgentHours={setAgentHours}
            agentServices={agentServices}
            setAgentServices={setAgentServices}
            agentPromptOverride={agentPromptOverride}
            setAgentPromptOverride={setAgentPromptOverride}
            agentAnimation={agentAnimation}
            setAgentAnimation={setAgentAnimation}
            agentSkinColor={agentSkinColor}
            setAgentSkinColor={setAgentSkinColor}
            agentShirtColor={agentShirtColor}
            setAgentShirtColor={setAgentShirtColor}
            agentPantsColor={agentPantsColor}
            setAgentPantsColor={setAgentPantsColor}
            agentSaving={agentSaving}
            onSaveAgent={handleSaveAgent}
            onDeleteAgent={handleDeleteAgent}
          />
        )}
        <div className="flex-1 relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="absolute left-1 top-2 z-20 rounded px-2 py-1 text-xs bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-600"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
          <TrooWorldUnifiedViewer
            worldTitle="MERIDIAN CAMPUS"
            initialBuilding={buildingToEnter ?? undefined}
            onExitBuilding={() => setBuildingToEnter(null)}
            placements={placements ?? undefined}
            editMode={isEditMode && !walkMode}
            walkMode={walkMode}
            onPlacementsChange={handlePlacementsChange}
            onSelect={(key) => { setSelectedElementKey(key); setSelectedElementId(null); }}
            selectedElementKey={selectedElementKey}
            elements={elements ?? undefined}
            onElementsChange={handleElementsChange}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => { setSelectedElementId(id); setSelectedElementKey(null); }}
            transformMode={transformMode}
            sceneLighting={sceneLighting}
            embedded
            onPlacementDragEnd={(key, prev, next) => {
              moveHistoryRef.current.push({ type: "placement", key, prev });
              moveRedoStackRef.current = [];
              setCanUndo(true);
              setCanRedo(false);
            }}
            onElementDragEnd={(id, prev, next) => {
              moveHistoryRef.current.push({ type: "element", key: id, prev });
              moveRedoStackRef.current = [];
              setCanUndo(true);
              setCanRedo(false);
            }}
          />
        </div>
      </div>
      {isEditMode && !walkMode && inspectorTarget && (
        <WorldInspector
          target={inspectorTarget}
          lighting={sceneLighting}
          onClose={() => { setInspectorTarget(null); setSelectedElementKey(null); setSelectedElementId(null); }}
          onUpdatePosition={(posX, posY, posZ) => {
            if (inspectorTarget?.kind === "placement" && selectedElementKey) {
              handleNumericChange(selectedElementKey, "posX", posX);
              handleNumericChange(selectedElementKey, "posY", posY);
              handleNumericChange(selectedElementKey, "posZ", posZ);
            } else if (inspectorTarget?.kind === "element" && selectedElementId != null) {
              handleNumericChangeElement(selectedElementId, "posX", posX);
              handleNumericChangeElement(selectedElementId, "posY", posY);
              handleNumericChangeElement(selectedElementId, "posZ", posZ);
            }
          }}
          onUpdateRotation={(rotY) => {
            if (inspectorTarget?.kind === "placement" && selectedElementKey) {
              handleNumericChange(selectedElementKey, "rotY", rotY);
            } else if (inspectorTarget?.kind === "element" && selectedElementId != null) {
              handleNumericChangeElement(selectedElementId, "rotY", rotY);
            }
          }}
          onUpdateScale={(scale) => {
            if (inspectorTarget?.kind === "placement" && selectedElementKey) {
              handleNumericChange(selectedElementKey, "scale", scale);
            } else if (inspectorTarget?.kind === "element" && selectedElementId != null) {
              handleNumericChangeElement(selectedElementId, "scale", scale);
            }
          }}
          onUpdateColor={(colorHex, color2Hex) => {
            if (inspectorTarget?.kind === "element" && selectedElementId != null) {
              handleUpdateElementColor(selectedElementId, colorHex, color2Hex);
            }
          }}
          onUpdateLabel={(label) => {
            if (inspectorTarget?.kind === "element" && selectedElementId != null) {
              handleUpdateElementLabel(selectedElementId, label);
            }
          }}
          onUpdateLighting={setSceneLighting}
          onEnterBuilding={(route) => {
            const m = route.match(/enter=(nexus|meridian|apex|harborview)/);
            if (m) setBuildingToEnter(m[1] as "nexus" | "meridian" | "apex" | "harborview");
            setIsEditMode(false);
            setWalkMode(false);
          }}
          onDelete={() => {
            if (inspectorTarget?.kind === "placement" && selectedElementKey) handleDelete(selectedElementKey);
            else if (inspectorTarget?.kind === "element" && selectedElementId != null) handleDeleteElement(selectedElementId);
            setInspectorTarget(null);
            setSelectedElementKey(null);
            setSelectedElementId(null);
          }}
        />
      )}
    </div>
  );
}
