"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import WorldElements from "@/components/oasis/WorldElements";
import { clearPlacement, setPlacing, startPlacement, updatePlacementMetadata, useWorldStore } from "@/stores/worldStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuildingFactory } from "@/lib/oasis/BuildingSystem";
import { Building } from "@/lib/BuildingSystem";
import InteriorExteriorEditor from "@/components/3d/InteriorExteriorEditor";
import ThreeJSBuildingRenderer from "@/components/3d/ThreeJSBuildingRenderer";
import BuildingEditorControls from "@/components/3d/BuildingEditorControls";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBuildingDataService } from "@/services/buildingDataService";

type Category = { id: number; name: string; slug: string };
type ElementRow = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  assetUri: string;
  previewImageUri: string | null;
  price?: string;
  currency?: string;
  createdAt: string;
};

type Placement = {
  id: string;
  // Back-compat: old placements only have elementId (DB element)
  kind?: "db" | "library";
  elementId?: number;
  elementKey?: string;
  name?: string;
  modelUrl?: string;
  metadata?: Record<string, unknown>;
  x: number;
  y: number;
  z: number;
  ry: number;
  scale: number;
};

const PLACEMENTS_KEY = "oasis_world_placements_v1";
const HISTORY_KEY = "oasis_world_history_v1";

type PlacementMode = "free" | "grid" | "snap";

function toGateway(ipfsUri: string | null | undefined) {
  if (!ipfsUri) return null;
  return ipfsUri.replace("ipfs://", "https://nftstorage.link/ipfs/");
}

function loadPlacements(): Placement[] {
  try {
    const raw = localStorage.getItem(PLACEMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Placement[]) : [];
  } catch {
    return [];
  }
}

function savePlacements(p: Placement[]) {
  localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(p));
}

function loadHistory(): { stack: Placement[][]; idx: number } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { stack: [], idx: -1 };
    const parsed = JSON.parse(raw);
    const stack = Array.isArray(parsed?.stack) ? (parsed.stack as Placement[][]) : [];
    const idx = typeof parsed?.idx === "number" ? (parsed.idx as number) : stack.length - 1;
    return { stack, idx: Math.min(Math.max(idx, -1), stack.length - 1) };
  } catch {
    return { stack: [], idx: -1 };
  }
}

function saveHistory(stack: Placement[][], idx: number) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ stack, idx }));
}

function PreviewGhost({
  active,
  position,
  ry,
  scale,
}: {
  active: boolean;
  position: THREE.Vector3;
  ry: number;
  scale: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.visible = active;
    if (!active) return;
    ref.current.position.lerp(position, Math.min(1, dt * 16));
    ref.current.rotation.y = ry;
    ref.current.scale.setScalar(scale);
  });

  return (
    <group ref={ref} position={[position.x, position.y, position.z]}>
      <mesh>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="#00D1FF" transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.61, 0]}>
        <ringGeometry args={[0.7, 0.9, 32]} />
        <meshBasicMaterial color="#00D1FF" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function Ground({
  onHover,
  onPlace,
}: {
  onHover: (point: THREE.Vector3) => void;
  onPlace: (point: THREE.Vector3) => void;
}) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const planeRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const pick = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const plane = planeRef.current;
      if (!plane) return;
      const hit = raycaster.intersectObject(plane, false)[0];
      if (!hit) return;
      return hit.point.clone();
    };

    const onMove = (e: PointerEvent) => {
      const p = pick(e);
      if (!p) return;
      onHover(p);
    };

    const onDown = (e: PointerEvent) => {
      const p = pick(e);
      if (!p) return;
      onPlace(p);
    };

    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerdown", onDown);
    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerdown", onDown);
    };
  }, [camera, gl, onHover, onPlace, pointer, raycaster]);

  return (
    <mesh ref={planeRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      {/* Keep ground a flat "grass green" regardless of scene lighting/environment */}
      <meshBasicMaterial color="#3CB043" toneMapped={false} />
    </mesh>
  );
}

function ElementBillboard({ url }: { url: string }) {
  const tex = useMemo(() => new THREE.TextureLoader().load(url), [url]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  return (
    <mesh>
      <planeGeometry args={[1.4, 1.4]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  );
}

function PlacedObjects({
  placements,
  elementById,
  selectedPlacementId,
  onSelectPlacement,
}: {
  placements: Placement[];
  elementById: Map<number, ElementRow>;
  selectedPlacementId: string | null;
  onSelectPlacement: (id: string) => void;
}) {
  return (
    <>
      {placements.map((p) => {
        const isLegacyDb = typeof p.elementId === "number" && !p.kind;
        const kind: Placement["kind"] = p.kind ?? (isLegacyDb ? "db" : undefined);

        const el = kind === "db" && typeof p.elementId === "number" ? elementById.get(p.elementId) : undefined;
        // IMPORTANT:
        // - If the library asset is upgraded/removed later, we want already-placed objects to keep their original snapshot.
        // - We therefore prefer metadata snapshots (captured at placement time) over the live DB row.
        const snapshotPreviewUri = (p.metadata?.["previewImageUri"] as string | undefined) ?? null;
        const preview = toGateway(snapshotPreviewUri) ?? toGateway(el?.previewImageUri) ?? null;

        const label =
          p.name ??
          (kind === "library"
            ? p.elementKey ?? "World Element"
            : el?.name ?? `Element #${p.elementId ?? "?"}`);

        return (
          <group
            key={p.id}
            position={[p.x, p.y, p.z]}
            rotation={[0, p.ry, 0]}
            scale={[p.scale, p.scale, p.scale]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onSelectPlacement(p.id);
            }}
          >
            {selectedPlacementId === p.id ? (
              <mesh>
                <boxGeometry args={[1.6, 1.6, 1.6]} />
                <meshBasicMaterial color="#00D1FF" wireframe transparent opacity={0.9} />
              </mesh>
            ) : null}
            {kind === "library" ? (
              <mesh castShadow>
                <boxGeometry args={[1.2, 1.2, 1.2]} />
                <meshStandardMaterial color="#0f766e" />
              </mesh>
            ) : preview ? (
              <ElementBillboard url={preview} />
            ) : (
              <mesh castShadow>
                <boxGeometry args={[1.2, 1.2, 1.2]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            )}
            <Html center distanceFactor={16} transform>
              <div
                style={{
                  padding: "4px 8px",
                  borderRadius: 9999,
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#e2e8f0",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export default function OasisWorldPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | "all">("all");
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [historyStack, setHistoryStack] = useState<Placement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  const storePlacement = useWorldStore((s) => s.placement);
  const isPlacing = useWorldStore((s) => s.isPlacing);

  // When clicking a placed object, Ground's raw pointer handler would also "place" (same click).
  // This flag prevents that.
  const ignoreNextPlaceRef = useRef(false);

  // Building customization (only used for "buildings" category)
  const [buildingType, setBuildingType] = useState<"house" | "apartment" | "storefront" | "warehouse" | "office">("house");
  const [buildingFloors, setBuildingFloors] = useState(3);
  const [buildingEditorOpen, setBuildingEditorOpen] = useState(false);
  const [buildingEditorVersion, setBuildingEditorVersion] = useState(0);
  const { service: buildingService } = useBuildingDataService("/api");
  const [buildingSaveStatus, setBuildingSaveStatus] = useState<string>("");
  const [selectedBuildingComponentId, setSelectedBuildingComponentId] = useState<string | null>(null);
  const [threeCtx, setThreeCtx] = useState<{ scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer } | null>(null);

  // Placement tooling (from the provided folder)
  const [placementMode, setPlacementMode] = useState<PlacementMode>("grid");
  const [gridSize, setGridSize] = useState(1);
  const [snapDistance, setSnapDistance] = useState(0.5);
  const [previewPos, setPreviewPos] = useState(() => new THREE.Vector3(0, 0.8, 0));
  const [previewRy, setPreviewRy] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    setPlacements(loadPlacements());
    const h = loadHistory();
    if (h.stack.length) {
      setHistoryStack(h.stack);
      setHistoryIndex(h.idx);
      const snap = h.stack[h.idx] ?? null;
      if (snap) setPlacements(snap);
    } else {
      // seed history with current placements, so undo works after first place
      setHistoryStack((s) => (s.length ? s : [loadPlacements()]));
      setHistoryIndex((i) => (i !== -1 ? i : 0));
    }
  }, []);

  useEffect(() => {
    savePlacements(placements);
  }, [placements]);

  useEffect(() => {
    saveHistory(historyStack, historyIndex);
  }, [historyStack, historyIndex]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cRes = await fetch("/api/oasis/categories");
        const cData = await cRes.json();
        setCategories(Array.isArray(cData.categories) ? cData.categories : []);

        const eRes = await fetch("/api/oasis/elements");
        const eData = await eRes.json();
        setElements(Array.isArray(eData.elements) ? eData.elements : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredElements = useMemo(() => {
    if (activeCategoryId === "all") return elements;
    return elements.filter((e) => e.categoryId === activeCategoryId);
  }, [elements, activeCategoryId]);

  const elementById = useMemo(() => {
    const m = new Map<number, ElementRow>();
    for (const e of elements) m.set(e.id, e);
    return m;
  }, [elements]);

  const selectedElement = selectedElementId ? elementById.get(selectedElementId) ?? null : null;

  const selectedIsBuilding =
    storePlacement?.metadata?.["source"] === "library" && storePlacement?.category === "buildings" && storePlacement?.isCustomizable;

  const buildingData = storePlacement?.metadata?.["building"] as any;
  const buildingInstance = useMemo(() => {
    if (!buildingData) return null;
    try {
      return Building.import(buildingData);
    } catch {
      return null;
    }
    // include version so we can refresh after editor mutations
  }, [buildingData, buildingEditorVersion]);

  useEffect(() => {
    // When selecting a building element, seed building customization metadata.
    if (!selectedIsBuilding) return;
    const id = `bld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pos = { x: 0, y: 0, z: 0 };
    const building =
      buildingType === "house"
        ? BuildingFactory.createSimpleHouse(id, pos)
        : buildingType === "apartment"
          ? BuildingFactory.createApartmentBuilding(id, pos, buildingFloors)
          : buildingType === "storefront"
            ? BuildingFactory.createStorefront(id, pos)
            : buildingType === "warehouse"
              ? BuildingFactory.createWarehouse(id, pos)
              : BuildingFactory.createOfficeBuilding(id, pos, buildingFloors);

    updatePlacementMetadata({ building: building.export() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIsBuilding, buildingType, buildingFloors]);

  function quantize(point: THREE.Vector3) {
    const p = point.clone();
    if (placementMode === "grid") {
      p.x = Math.round(p.x / gridSize) * gridSize;
      p.z = Math.round(p.z / gridSize) * gridSize;
    } else if (placementMode === "snap") {
      p.x = Math.round(p.x / snapDistance) * snapDistance;
      p.z = Math.round(p.z / snapDistance) * snapDistance;
    }
    p.y = 0.8;
    return p;
  }

  function pushHistory(nextPlacements: Placement[]) {
    setHistoryStack((stack) => {
      const base = stack.slice(0, historyIndex + 1);
      base.push(nextPlacements);
      // cap to keep localStorage reasonable
      const capped = base.length > 60 ? base.slice(base.length - 60) : base;
      return capped;
    });
    setHistoryIndex((idx) => {
      const next = idx + 1;
      return Math.min(next, 59);
    });
  }

  function onHover(point: THREE.Vector3) {
    if (!isPlacing) return;
    setPreviewPos(quantize(point));
  }

  function onPlace(point: THREE.Vector3) {
    if (ignoreNextPlaceRef.current) {
      ignoreNextPlaceRef.current = false;
      return;
    }
    if (!isPlacing || !storePlacement) return;
    const pos = quantize(point);
    // basic validation (inspired by provided worldStore)
    const maxBound = 40;
    if (Math.abs(pos.x) > maxBound || Math.abs(pos.z) > maxBound) {
      setStatus("⚠️ Outside world bounds. Try placing closer to center.");
      return;
    }

    const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const source = storePlacement.metadata?.["source"];
    const isDb = source === "db" && typeof storePlacement.metadata?.["dbElementId"] === "number";
    const isLibrary = source === "library" && typeof storePlacement.metadata?.["elementId"] === "string";

    const next: Placement = {
      id,
      kind: isLibrary ? "library" : "db",
      elementId: isDb ? (storePlacement.metadata?.["dbElementId"] as number) : undefined,
      elementKey: isLibrary ? (storePlacement.metadata?.["elementId"] as string) : undefined,
      name: storePlacement.name,
      modelUrl: storePlacement.modelUrl,
      metadata: storePlacement.metadata,
      x: Math.round(pos.x * 10) / 10,
      y: 0.8,
      z: Math.round(pos.z * 10) / 10,
      ry: previewRy,
      scale: previewScale,
    };
    const nextPlacements = [next, ...placements];
    setPlacements(nextPlacements);
    pushHistory(nextPlacements);
    setStatus(`Placed: ${storePlacement.name ?? "Element"}`);

    // After a placement, exit placement mode so the user must explicitly re-select
    // an element. This prevents accidental repeated placements on subsequent taps.
    clearPlacement();
  }

  function updatePlacementById(id: string, patch: Partial<Placement>, note?: string) {
    setPlacements((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      pushHistory(next);
      return next;
    });
    if (note) setStatus(note);
  }

  function deletePlacement(id: string) {
    setPlacements((prev) => {
      const next = prev.filter((p) => p.id !== id);
      pushHistory(next);
      return next;
    });
    setSelectedPlacementId(null);
    setStatus("Deleted selected object.");
  }

  function clearAll() {
    if (!confirm("Clear all placed objects in this browser?")) return;
    setPlacements([]);
    pushHistory([]);
    setStatus("Cleared placements.");
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    const snap = historyStack[nextIdx] ?? [];
    setHistoryIndex(nextIdx);
    setPlacements(snap);
    setStatus("Undid last change.");
  }

  function redo() {
    if (historyIndex >= historyStack.length - 1) return;
    const nextIdx = historyIndex + 1;
    const snap = historyStack[nextIdx] ?? [];
    setHistoryIndex(nextIdx);
    setPlacements(snap);
    setStatus("Redid change.");
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // shortcuts inspired by the provided ElementPlacer
      const key = e.key.toLowerCase();

      if (key === "escape") {
        if (isPlacing) {
          clearPlacement();
          setStatus("Placement cancelled.");
        } else if (selectedPlacementId) {
          setSelectedPlacementId(null);
          setStatus("Selection cleared.");
        }
        return;
      }

      // Undo/redo everywhere
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Edit selected placement when not in placing mode
      if (!isPlacing && selectedPlacementId) {
        const selected = placements.find((p) => p.id === selectedPlacementId);
        if (!selected) return;

        const moveStep = e.shiftKey ? 0.5 : 0.1;
        const rotateStep = e.shiftKey ? Math.PI / 12 : Math.PI / 36;
        const scaleStep = e.shiftKey ? 0.2 : 0.1;

        if (key === "backspace" || key === "delete") {
          e.preventDefault();
          deletePlacement(selected.id);
        } else if (key === "arrowup") {
          e.preventDefault();
          updatePlacementById(selected.id, { z: selected.z - moveStep }, "Moved object.");
        } else if (key === "arrowdown") {
          e.preventDefault();
          updatePlacementById(selected.id, { z: selected.z + moveStep }, "Moved object.");
        } else if (key === "arrowleft") {
          e.preventDefault();
          updatePlacementById(selected.id, { x: selected.x - moveStep }, "Moved object.");
        } else if (key === "arrowright") {
          e.preventDefault();
          updatePlacementById(selected.id, { x: selected.x + moveStep }, "Moved object.");
        } else if (key === "r") {
          e.preventDefault();
          updatePlacementById(selected.id, { ry: selected.ry + rotateStep }, "Rotated object.");
        } else if (key === "q") {
          e.preventDefault();
          updatePlacementById(selected.id, { ry: selected.ry - rotateStep }, "Rotated object.");
        } else if (key === "+" || key === "=") {
          e.preventDefault();
          updatePlacementById(selected.id, { scale: Math.min(5, selected.scale + scaleStep) }, "Scaled object.");
        } else if (key === "-" || key === "_") {
          e.preventDefault();
          updatePlacementById(selected.id, { scale: Math.max(0.1, selected.scale - scaleStep) }, "Scaled object.");
        }
        return;
      }

      if (!isPlacing) return;

      if (key === "r") {
        setPreviewRy((v) => (v + Math.PI / 2) % (Math.PI * 2));
      } else if (key === "q") {
        setPreviewRy((v) => (v - Math.PI / 2) % (Math.PI * 2));
      } else if (key === "+" || key === "=") {
        setPreviewScale((s) => Math.min(5, Math.round((s + 0.1) * 10) / 10));
      } else if (key === "-") {
        setPreviewScale((s) => Math.max(0.1, Math.round((s - 0.1) * 10) / 10));
      } else if (key === " ") {
        // place at current preview
        onPlace(previewPos);
      } else if (key === "arrowup") {
        setPreviewPos((p: THREE.Vector3) => quantize(new THREE.Vector3(p.x, p.y, p.z - 1)));
      } else if (key === "arrowdown") {
        setPreviewPos((p: THREE.Vector3) => quantize(new THREE.Vector3(p.x, p.y, p.z + 1)));
      } else if (key === "arrowleft") {
        setPreviewPos((p: THREE.Vector3) => quantize(new THREE.Vector3(p.x - 1, p.y, p.z)));
      } else if (key === "arrowright") {
        setPreviewPos((p: THREE.Vector3) => quantize(new THREE.Vector3(p.x + 1, p.y, p.z)));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlacing, previewPos, previewRy, previewScale, placements, historyIndex, historyStack]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex h-screen">
        {/* Left sidebar */}
        <aside className="w-[360px] max-w-[92vw] border-r border-white/10 bg-slate-950/40 p-4 overflow-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-bold">OASIS World</div>
              <div className="text-xs text-slate-400 mt-1">
                Pick an element and click in the world to place it. (Demo placement persistence in localStorage)
              </div>
            </div>
            <button
              onClick={clearAll}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold">World Elements</div>
            <div className="mt-2">
              <WorldElements
                onElementSelected={(el: any) => {
                  setSelectedElementId(null);
                  setPreviewScale(1);
                  setStatus(`Selected: ${el.name}. Placement enabled.`);
                  setPlacing(true);
                }}
              />
            </div>
          </div>

          {selectedIsBuilding ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">Building Customization</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-slate-300">Type</Label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-2 py-2 text-sm"
                    value={buildingType}
                    onChange={(e) => setBuildingType(e.target.value as any)}
                  >
                    <option value="house">House</option>
                    <option value="apartment">Apartment</option>
                    <option value="storefront">Storefront</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="office">Office</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-slate-300">Floors (apartment/office)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={buildingFloors}
                    onChange={(e) => setBuildingFloors(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  />
                </div>
                <div className="col-span-2 text-[11px] text-slate-400">
                  This config is saved into the placed object metadata (for future procedural building rendering).
                </div>

                <div className="col-span-2 pt-2">
                  <Dialog open={buildingEditorOpen} onOpenChange={setBuildingEditorOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200"
                        disabled={!buildingInstance}
                      >
                        Edit Interior / Exterior
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
                      <DialogHeader className="border-b border-white/10">
                        <DialogTitle>Building Editor</DialogTitle>
                      </DialogHeader>
                      <div className="h-[calc(90vh-56px)] p-4">
                        {buildingInstance ? (
                          <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="h-full flex flex-col gap-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-slate-300">
                                  Preview updates as you edit components. Save persists to your account.
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                                    onClick={() => {
                                      const json = JSON.stringify(buildingInstance.export(), null, 2);
                                      navigator.clipboard?.writeText(json);
                                      setBuildingSaveStatus("Copied building JSON to clipboard.");
                                      setTimeout(() => setBuildingSaveStatus(""), 2000);
                                    }}
                                  >
                                    Copy JSON
                                  </Button>
                                  <Button
                                    type="button"
                                    className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30"
                                    disabled={!buildingService}
                                    onClick={async () => {
                                      try {
                                        setBuildingSaveStatus("Saving…");
                                        await buildingService!.updateBuilding(buildingInstance, "Edited in OASIS World");
                                        setBuildingSaveStatus("Saved.");
                                      } catch (e) {
                                        setBuildingSaveStatus(`Save failed: ${String(e)}`);
                                      } finally {
                                        setTimeout(() => setBuildingSaveStatus(""), 2500);
                                      }
                                    }}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                              {buildingSaveStatus ? (
                                <div className="text-xs text-slate-300 border border-white/10 bg-white/5 rounded-lg px-3 py-2">
                                  {buildingSaveStatus}
                                </div>
                              ) : null}
                              <div className="relative">
                                <ThreeJSBuildingRenderer
                                  building={buildingInstance}
                                  height={360}
                                  onReady={(ctx) => setThreeCtx(ctx)}
                                />
                                {threeCtx ? (
                                  <BuildingEditorControls
                                    building={buildingInstance}
                                    selectedComponentId={selectedBuildingComponentId}
                                    scene={threeCtx.scene}
                                    camera={threeCtx.camera}
                                    renderer={threeCtx.renderer}
                                    onComponentTransformed={() => {
                                      updatePlacementMetadata({ building: buildingInstance.export() });
                                      setBuildingEditorVersion((v) => v + 1);
                                    }}
                                    onComponentDeleted={() => {
                                      setSelectedBuildingComponentId(null);
                                      updatePlacementMetadata({ building: buildingInstance.export() });
                                      setBuildingEditorVersion((v) => v + 1);
                                    }}
                                    onComponentDuplicated={() => {
                                      updatePlacementMetadata({ building: buildingInstance.export() });
                                      setBuildingEditorVersion((v) => v + 1);
                                    }}
                                    config={{ gridSize: 0.5, showGizmo: true }}
                                  />
                                ) : null}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Note: components are rendered as colored boxes in preview until model GLBs are wired up.
                              </div>
                            </div>

                            <InteriorExteriorEditor
                              building={buildingInstance}
                              onSelectedComponentIdChange={setSelectedBuildingComponentId}
                              onComponentAdded={() => {
                                updatePlacementMetadata({ building: buildingInstance.export() });
                                setBuildingEditorVersion((v) => v + 1);
                              }}
                              onComponentUpdated={() => {
                                updatePlacementMetadata({ building: buildingInstance.export() });
                                setBuildingEditorVersion((v) => v + 1);
                              }}
                              onComponentRemoved={() => {
                                updatePlacementMetadata({ building: buildingInstance.export() });
                                setBuildingEditorVersion((v) => v + 1);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-full grid place-items-center text-slate-300">No building loaded.</div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold">Placement Tools</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (!storePlacement) {
                    setStatus("Select an element first, then enable placement.");
                    return;
                  }
                  setPlacing(!isPlacing);
                  setStatus(!isPlacing ? "Placement enabled. Move mouse and click to place." : "Placement paused.");
                }}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isPlacing ? "bg-cyan-500/20 border-cyan-400/60" : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                {isPlacing ? "Placing: ON" : "Placing: OFF"}
              </button>
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= historyStack.length - 1}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Redo
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Mode
                <select
                  className="mt-1 w-full rounded-lg bg-slate-950/40 border border-white/10 px-2 py-2 text-sm"
                  value={placementMode}
                  onChange={(e) => setPlacementMode(e.target.value as PlacementMode)}
                >
                  <option value="free">Free</option>
                  <option value="grid">Grid</option>
                  <option value="snap">Snap</option>
                </select>
              </label>
              <label className="text-xs text-slate-300">
                {placementMode === "snap" ? "Snap" : "Grid"} size
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={placementMode === "snap" ? snapDistance : gridSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (placementMode === "snap") setSnapDistance(v);
                    else setGridSize(v);
                  }}
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Rotation Y ({Math.round((previewRy * 180) / Math.PI)}°)
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={Math.PI * 2}
                  step={Math.PI / 36}
                  value={previewRy}
                  onChange={(e) => setPreviewRy(Number(e.target.value))}
                />
              </label>
              <label className="text-xs text-slate-300">
                Scale ({previewScale.toFixed(1)})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={previewScale}
                  onChange={(e) => setPreviewScale(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              Shortcuts: ESC cancel • SPACE place • R/Q rotate • +/- scale • arrows move • ⌘/Ctrl+Z undo • ⌘/Ctrl+Y redo
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold">Categories</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  activeCategoryId === "all" ? "bg-slate-700 border-slate-500" : "border-slate-700 hover:border-slate-600"
                }`}
                onClick={() => setActiveCategoryId("all")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={`px-3 py-1.5 rounded-xl border text-sm ${
                    activeCategoryId === c.id ? "bg-slate-700 border-slate-500" : "border-slate-700 hover:border-slate-600"
                  }`}
                  onClick={() => setActiveCategoryId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Elements</div>
              <div className="text-xs text-slate-400">{filteredElements.length}</div>
            </div>

            {loading ? (
              <div className="text-slate-300 mt-3">Loading…</div>
            ) : filteredElements.length === 0 ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-slate-300 text-sm">
                No elements yet. Add some in Admin → OASIS ELEMENTS.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {filteredElements.map((e) => {
                  const selected = e.id === selectedElementId;
                  const preview = toGateway(e.previewImageUri);
                  const priceLabel =
                    e.price && e.currency ? `${e.price} ${String(e.currency).replace("_", " ")}` : null;
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelectedElementId(e.id);
                        setPreviewScale(1);
                        startPlacement({
                          name: e.name,
                          type: "db",
                          modelUrl: e.assetUri,
                          category: "db",
                          price: Number(e.price ?? 0),
                          currency: (e.currency as any) ?? "TROO_POO",
                          isStackable: true,
                          isEnterable: false,
                          isCustomizable: false,
                          metadata: {
                            source: "db",
                            dbElementId: e.id,
                            previewImageUri: e.previewImageUri,
                            assetUri: e.assetUri,
                          },
                        });
                        setStatus(`Selected: ${e.name}. Placement enabled.`);
                        setPlacing(true);
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        selected ? "border-cyan-400/60 bg-slate-900" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-slate-800/60 shrink-0">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt={e.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-xs text-slate-400">No preview</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold truncate">{e.name}</div>
                            {priceLabel ? (
                              <div className="shrink-0 rounded-full border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[11px] text-slate-200">
                                {priceLabel}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{e.description || e.assetUri}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {status ? (
            <div className="mt-4 text-xs text-slate-300 border border-white/10 bg-white/5 rounded-xl p-3">
              {status}
            </div>
          ) : null}
        </aside>

        {/* 3D world */}
        <main className="flex-1 relative">
          <Canvas shadows camera={{ position: [8, 8, 8], fov: 50 }}>
            <color attach="background" args={["#060b16"]} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
            <Suspense fallback={null}>
              <Environment preset="city" />
            </Suspense>
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              minDistance={5}
              maxDistance={120}
              maxPolarAngle={Math.PI / 2 - 0.08}
            />

            <Ground onHover={onHover} onPlace={onPlace} />
            {/* Removed spinning marker (gizmo) to declutter the scene */}
            <PreviewGhost active={isPlacing && !!storePlacement} position={previewPos} ry={previewRy} scale={previewScale} />
            <PlacedObjects
              placements={placements}
              elementById={elementById}
              selectedPlacementId={selectedPlacementId}
              onSelectPlacement={(id) => {
                ignoreNextPlaceRef.current = true;
                setSelectedPlacementId(id);
                setStatus("Selected object. Use arrows/R-Q/+/- to edit.");
              }}
            />
          </Canvas>

          <div className="absolute bottom-4 right-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur px-4 py-3 text-xs text-slate-200 max-w-[360px]">
            <div className="font-semibold">Tip</div>
            <div className="mt-1 text-slate-300">
              Add categories/elements in <span className="text-white">Admin → OASIS ELEMENTS</span>. Then refresh this page to
              see them here.
            </div>
          </div>

          {selectedPlacementId && !isPlacing ? (
            <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur px-4 py-3 text-xs text-slate-200 max-w-[360px]">
              <div className="font-semibold">Selected object</div>
              <div className="mt-1 text-slate-300">Arrows move • R/Q rotate • +/- scale • DEL delete • ESC deselect</div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}


