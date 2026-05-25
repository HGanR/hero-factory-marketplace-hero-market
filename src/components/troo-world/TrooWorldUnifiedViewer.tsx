"use client";

/**
 * TrooWorldUnifiedViewer — Full viewport 3D world with both buildings.
 * Wide-screen immersive view. Enter a building to explore interior.
 * NPCs hooked to admin panel AI agents.
 *
 * Supports optional placements from DB (admin-editable) and edit mode with TransformControls.
 *
 * GLB REFERENCE:
 * - Troo World Nexus:  /models/nexus-tower/modern_building.glb (same as Dashboard → Nexus Tower interior)
 * - Troo World Meridian: /models/meridian-tower/meridian_tower.glb
 * - Dashboard "Nexus Tower" button → NexusBuildingViewer uses same modern_building.glb
 * - Dashboard "Meridian Tower" button → MeridianBuildingViewer uses procedural (no GLB)
 * - office-building-3d: client/public/modern_building.glb (same file, 21KB)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import dynamic from "next/dynamic";
import Link from "next/link";
import { buildTerrain, animateTerrain } from "@/lib/troo-world/WorldTerrain";
import { buildApexExterior } from "@/lib/troo-world/apex/ApexExterior";
import { buildHarborviewExterior } from "@/lib/troo-world/harborview/HarborviewExterior";
import { renderWorldElements, getAllElementGroups, getElementGroup, animateWorldElements } from "@/lib/troo-world/WorldElementSystem";
import type { WorldElementData } from "@/lib/troo-world/WorldElementSystem";
import type { SceneLighting } from "./WorldInspector";

const NEXUS_GLB = "/models/nexus-tower/modern_building.glb";

const DEFAULT_SCENE_LIGHTING: SceneLighting = {
  ambientIntensity: 0.7,
  sunIntensity: 1.8,
  sunAzimuth: 45,
  sunElevation: 60,
};
const MERIDIAN_GLB = "/models/meridian-tower/meridian_tower.glb";

/** Floating building name label sprite above each building */
function makeBuildingLabel(name: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = "rgba(5,15,35,0.85)";
  const r = 18;
  ctx.beginPath();
  ctx.moveTo(r + 8, 8); ctx.lineTo(504 - r, 8);
  ctx.quadraticCurveTo(504, 8, 504, r + 8);
  ctx.lineTo(504, 88 - r); ctx.quadraticCurveTo(504, 88, 504 - r, 88);
  ctx.lineTo(r + 8, 88); ctx.quadraticCurveTo(8, 88, 8, 88 - r);
  ctx.lineTo(8, r + 8); ctx.quadraticCurveTo(8, 8, r + 8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(100,180,255,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#d0eeff";
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(20, 3.75, 1);
  sprite.userData.isNameLabel = true;
  return sprite;
}

function placementKeyToDisplayName(key: string): string {
  return key
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export type Placement = {
  elementKey: string;
  glbUrl: string;
  posX: number;
  posY: number;
  posZ: number;
  scale: number;
  rotY: number;
};

const NexusBuildingViewer = dynamic(
  () => import("@/components/troo-world/nexus/NexusBuildingViewer"),
  { ssr: false }
);

const MeridianBuildingViewer = dynamic(
  () => import("@/components/troo-world/meridian/MeridianBuildingViewer"),
  { ssr: false }
);

const ApexBuildingViewer = dynamic(
  () => import("@/components/troo-world/apex/ApexBuildingViewer"),
  { ssr: false }
);

const HarborviewBuildingViewer = dynamic(
  () => import("@/components/troo-world/harborview/HarborviewBuildingViewer"),
  { ssr: false }
);

type ViewMode = "world" | "nexus" | "meridian" | "apex" | "harborview";

interface Props {
  initialBuilding?: "nexus" | "meridian" | "apex" | "harborview";
  /** Called when user exits a building (Back to World) */
  onExitBuilding?: () => void;
  /** When provided, use these placements instead of hardcoded defaults */
  placements?: Placement[] | null;
  /** Edit mode: draggable objects, no building enter */
  editMode?: boolean;
  /** Walk mode: first-person walk (WASD + mouse), E to enter building */
  walkMode?: boolean;
  /** Called when placements change (edit mode, after drag) */
  onPlacementsChange?: (placements: Placement[]) => void;
  /** When true, use absolute positioning to fill parent (for embedding in editor) */
  embedded?: boolean;
  /** Transform mode: translate | rotate | scale */
  transformMode?: "translate" | "rotate" | "scale";
  /** Currently selected placement elementKey (for outliner sync) */
  selectedElementKey?: string | null;
  /** Called when selection changes */
  onSelect?: (elementKey: string | null) => void;
  /** DB-backed scenery elements (trees, lights, benches). When present, terrain skips hardcoded scenery. */
  elements?: WorldElementData[] | null;
  /** Called when elements change (edit mode, after drag) */
  onElementsChange?: (elements: WorldElementData[]) => void;
  /** Currently selected element id (for outliner sync) */
  selectedElementId?: number | null;
  /** Called when element selection changes */
  onSelectElement?: (id: number | null) => void;
  /** Scene lighting (ambient, sun) — applied when provided */
  sceneLighting?: { ambientIntensity: number; sunIntensity: number; sunAzimuth: number; sunElevation: number };
  /** Called when placement drag ends (for undo history) */
  onPlacementDragEnd?: (key: string, prev: Placement, next: Placement) => void;
  /** Called when element drag ends (for undo history) */
  onElementDragEnd?: (id: number, prev: WorldElementData, next: WorldElementData) => void;
  /** World/campus title (e.g. "MERIDIAN CAMPUS") */
  worldTitle?: string;
  /** Optional terrain flavor label (e.g. from `troo_worlds.terrainType`); reserved for future terrain variants. */
  terrainType?: string;
}

export default function TrooWorldUnifiedViewer({
  initialBuilding,
  onExitBuilding,
  placements,
  editMode,
  walkMode,
  onPlacementsChange,
  embedded,
  transformMode = "translate",
  selectedElementKey,
  onSelect,
  elements,
  onElementsChange,
  selectedElementId,
  onSelectElement,
  sceneLighting,
  onPlacementDragEnd,
  onElementDragEnd,
  worldTitle = "TROO WORLD",
  terrainType: _terrainType,
}: Props) {
  void _terrainType;
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    initialBuilding === "nexus" ? "nexus" : initialBuilding === "meridian" ? "meridian" : initialBuilding === "apex" ? "apex" : initialBuilding === "harborview" ? "harborview" : "world"
  );
  const [hoveredBuilding, setHoveredBuilding] = useState<"nexus" | "meridian" | "apex" | "harborview" | null>(null);

  const enterNexus = useCallback(() => setViewMode("nexus"), []);
  const enterMeridian = useCallback(() => setViewMode("meridian"), []);
  const enterApex = useCallback(() => setViewMode("apex"), []);
  const enterHarborview = useCallback(() => setViewMode("harborview"), []);
  const exitBuilding = useCallback(() => {
    setViewMode("world");
    onExitBuilding?.();
  }, [onExitBuilding]);

  useEffect(() => {
    if (initialBuilding === "nexus") setViewMode("nexus");
    else if (initialBuilding === "meridian") setViewMode("meridian");
    else if (initialBuilding === "apex") setViewMode("apex");
    else if (initialBuilding === "harborview") setViewMode("harborview");
  }, [initialBuilding]);

  if (!editMode && viewMode === "nexus") {
    return (
      <div className="fixed inset-0 z-50 bg-[#020408]">
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={exitBuilding}
            className="px-4 py-2 text-sm text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 transition-colors"
          >
            ← Back to World
          </button>
        </div>
        <NexusBuildingViewer />
      </div>
    );
  }

  if (!editMode && viewMode === "meridian") {
    return (
      <div className="fixed inset-0 z-50 bg-[#020408]">
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={exitBuilding}
            className="px-4 py-2 text-sm text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 transition-colors"
          >
            ← Back to World
          </button>
        </div>
        <MeridianBuildingViewer />
      </div>
    );
  }

  if (!editMode && viewMode === "apex") {
    return (
      <div className="fixed inset-0 z-50 bg-[#020408]">
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={exitBuilding}
            className="px-4 py-2 text-sm text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/10 transition-colors"
          >
            ← Back to World
          </button>
        </div>
        <ApexBuildingViewer />
      </div>
    );
  }

  if (!editMode && viewMode === "harborview") {
    return (
      <div className="fixed inset-0 z-50 bg-[#020408]">
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={exitBuilding}
            className="px-4 py-2 text-sm text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 transition-colors"
          >
            ← Back to World
          </button>
        </div>
        <HarborviewBuildingViewer />
      </div>
    );
  }

  return (
    <WorldView
      onEnterNexus={enterNexus}
      onEnterMeridian={enterMeridian}
      onEnterApex={enterApex}
      onEnterHarborview={enterHarborview}
      hoveredBuilding={hoveredBuilding}
      setHoveredBuilding={setHoveredBuilding}
      placements={placements}
      editMode={editMode}
      walkMode={walkMode}
      onPlacementsChange={onPlacementsChange}
      embedded={embedded}
      transformMode={transformMode}
      selectedElementKey={selectedElementKey}
      onSelect={onSelect}
      elements={elements}
      onElementsChange={onElementsChange}
      selectedElementId={selectedElementId}
      onSelectElement={onSelectElement}
      sceneLighting={sceneLighting}
      onPlacementDragEnd={onPlacementDragEnd}
      onElementDragEnd={onElementDragEnd}
      worldTitle={worldTitle}
    />
  );
}

function WorldView({
  onEnterNexus,
  onEnterMeridian,
  onEnterApex,
  onEnterHarborview,
  walkMode,
  hoveredBuilding,
  setHoveredBuilding,
  placements,
  editMode,
  onPlacementsChange,
  embedded,
  transformMode,
  selectedElementKey,
  onSelect,
  elements,
  onElementsChange,
  selectedElementId,
  onSelectElement,
  sceneLighting,
  onPlacementDragEnd,
  onElementDragEnd,
  worldTitle = "TROO WORLD",
}: {
  onEnterNexus: () => void;
  onEnterMeridian: () => void;
  onEnterApex: () => void;
  onEnterHarborview: () => void;
  hoveredBuilding: "nexus" | "meridian" | "apex" | "harborview" | null;
  setHoveredBuilding: (b: "nexus" | "meridian" | "apex" | "harborview" | null) => void;
  placements?: Placement[] | null;
  editMode?: boolean;
  walkMode?: boolean;
  onPlacementsChange?: (p: Placement[]) => void;
  embedded?: boolean;
  transformMode?: "translate" | "rotate" | "scale";
  selectedElementKey?: string | null;
  onSelect?: (elementKey: string | null) => void;
  elements?: WorldElementData[] | null;
  onElementsChange?: (e: WorldElementData[]) => void;
  selectedElementId?: number | null;
  onSelectElement?: (id: number | null) => void;
  sceneLighting?: { ambientIntensity: number; sunIntensity: number; sunAzimuth: number; sunElevation: number };
  onPlacementDragEnd?: (key: string, prev: Placement, next: Placement) => void;
  onElementDragEnd?: (id: number, prev: WorldElementData, next: WorldElementData) => void;
  worldTitle?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelsByKeyRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const transformControlsRef = useRef<TransformControls | null>(null);
  const selectedElementKeyRef = useRef<string | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const clickableRef = useRef<THREE.Object3D[]>([]);
  const selectedElementIdRef = useRef<number | null>(null);
  const walkPosRef = useRef(new THREE.Vector3(0, 1.75, 50));
  const walkYawRef = useRef(Math.PI);
  const walkPitchRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const pointerLockedRef = useRef(false);
  const [nearBuilding, setNearBuilding] = useState<"nexus" | "meridian" | "apex" | "harborview" | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [timePaused, setTimePaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [displayTime, setDisplayTime] = useState(() => {
    const d = new Date();
    return { h: d.getHours(), m: d.getMinutes() };
  });
  useEffect(() => {
    if (timePaused) return;
    const tick = () => {
      const d = new Date();
      setDisplayTime({ h: d.getHours(), m: d.getMinutes() });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timePaused]);
  const period = displayTime.h >= 6 && displayTime.h < 12 ? "MORNING" : displayTime.h >= 12 && displayTime.h < 18 ? "MIDDAY" : displayTime.h >= 18 && displayTime.h < 21 ? "EVENING" : "NIGHT";

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 150, 250);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      500
    );
    camera.position.set(0, 35, 80);
    camera.lookAt(0, 15, 0);
    cameraRef.current = camera;

    // Time-of-day: use user's local hour for sun/moon
    const getTimeOfDay = () => {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      return h + m / 60;
    };

    // Lighting — Meridian Campus daytime
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    ambient.name = "ambient";
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c3f, 0.5);
    hemi.name = "hemi";
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.8);
    sun.name = "sun";
    sun.position.set(40, 80, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    scene.add(new THREE.DirectionalLight(0xadd8e6, 0.4).translateX(-40).translateY(30).translateZ(-40));

    scene.userData.timeOfDayLights = null;
    scene.userData.ambientLight = ambient;
    scene.userData.sunLight = sun;

    // Terrain: roads, sidewalks, building pads, lake. When elements provided, skip scenery (trees, lights, benches).
    const useElements = !!(elements && elements.length > 0);
    buildTerrain(scene, { skipScenery: useElements });
    if (useElements) {
      renderWorldElements(scene, elements);
      // Collect element meshes for raycasting
      const elementClickables: THREE.Object3D[] = [];
      getAllElementGroups().forEach((group) => {
        group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) elementClickables.push(obj);
        });
      });
      clickableRef.current = [...clickableRef.current, ...elementClickables];
    }

    const defaultPlacements: Placement[] = [
      { elementKey: "nexus-tower", glbUrl: NEXUS_GLB, posX: -35, posY: 0, posZ: 0, scale: 1, rotY: 0 },
      { elementKey: "meridian-tower", glbUrl: MERIDIAN_GLB, posX: 35, posY: 0, posZ: 0, scale: 1, rotY: 0 },
      { elementKey: "apex-tower", glbUrl: "procedural:apex", posX: 0, posY: 0, posZ: 0, scale: 1, rotY: 0 },
      { elementKey: "harborview-tower", glbUrl: "procedural:harborview", posX: -55, posY: 0, posZ: -55, scale: 1, rotY: 0 },
    ];
    const effectivePlacements = placements?.length ? placements : defaultPlacements;

    const placementModelsRef: { root: THREE.Object3D; placement: Placement }[] = [];
    const loader = new GLTFLoader();

    function loadPlacement(pl: Placement) {
      const isProceduralHarborview = pl.glbUrl === "procedural:harborview" || pl.elementKey === "harborview-tower";
      if (isProceduralHarborview) {
        const model = buildHarborviewExterior();
        const building = "harborview";
        const clickables: THREE.Object3D[] = [];
        model.position.set(pl.posX, pl.posY, pl.posZ);
        model.scale.setScalar(pl.scale);
        model.rotation.y = pl.rotY * (Math.PI / 180);
        model.userData.placementElementKey = pl.elementKey;
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { ...mesh.userData, building };
            clickables.push(obj);
          }
        });
        const harborBox = new THREE.Box3().setFromObject(model);
        const harborLabel = makeBuildingLabel(placementKeyToDisplayName(pl.elementKey));
        harborLabel.position.set(0, harborBox.max.y - model.position.y + 4, 0);
        model.add(harborLabel);
        scene.add(model);
        placementModelsRef.push({ root: model, placement: pl });
        modelsByKeyRef.current.set(pl.elementKey, model);
        clickableRef.current = [...clickableRef.current, ...clickables];
        if (selectedElementKeyRef.current === pl.elementKey && transformControlsRef.current) {
          transformControlsRef.current.attach(model);
        }
        return;
      }
      const isProceduralApex = pl.glbUrl === "procedural:apex" || pl.elementKey === "apex-tower";
      if (isProceduralApex) {
        const model = buildApexExterior();
        const building = "apex";
        const clickables: THREE.Object3D[] = [];
        model.position.set(pl.posX, pl.posY, pl.posZ);
        model.scale.setScalar(pl.scale);
        model.rotation.y = pl.rotY * (Math.PI / 180);
        model.userData.placementElementKey = pl.elementKey;
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { ...mesh.userData, building };
            clickables.push(obj);
          }
        });
        const apexBox = new THREE.Box3().setFromObject(model);
        const apexLabel = makeBuildingLabel(placementKeyToDisplayName(pl.elementKey));
        apexLabel.position.set(0, apexBox.max.y - model.position.y + 4, 0);
        model.add(apexLabel);
        scene.add(model);
        placementModelsRef.push({ root: model, placement: pl });
        modelsByKeyRef.current.set(pl.elementKey, model);
        clickableRef.current = [...clickableRef.current, ...clickables];
        if (selectedElementKeyRef.current === pl.elementKey && transformControlsRef.current) {
          transformControlsRef.current.attach(model);
        }
        return;
      }
      loader.load(pl.glbUrl, (gltf) => {
        const model = gltf.scene;
        const building = pl.elementKey.includes("nexus") ? "nexus" : pl.elementKey.includes("meridian") ? "meridian" : pl.elementKey.includes("apex") ? "apex" : pl.elementKey.includes("harborview") ? "harborview" : undefined;
        const clickables: THREE.Object3D[] = [];
        model.position.set(pl.posX, pl.posY, pl.posZ);
        model.scale.setScalar(pl.scale);
        model.rotation.y = pl.rotY * (Math.PI / 180);
        model.userData.placementElementKey = pl.elementKey;
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (building) mesh.userData = { ...mesh.userData, building };
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const processed = mats.map((m) => {
              const old = m as THREE.Material;
              let mat: THREE.MeshStandardMaterial;
              if ("emissive" in old && "metalness" in old) {
                mat = old.clone() as THREE.MeshStandardMaterial;
                mat.emissive = (mat.color as THREE.Color).clone();
                mat.emissiveIntensity = 0.2;
              } else {
                const c = "color" in old && old.color ? (old.color as THREE.Color).clone() : new THREE.Color(0x4a7a9a);
                const baseMap =
                  "map" in old && old.map instanceof THREE.Texture ? (old.map as THREE.Texture) : undefined;
                mat = new THREE.MeshStandardMaterial({
                  color: c,
                  roughness: 0.6,
                  metalness: 0.2,
                  emissive: c.clone(),
                  emissiveIntensity: 0.15,
                  map: baseMap,
                });
              }
              mat.side = THREE.DoubleSide;
              return mat;
            });
            mesh.material = processed.length === 1 ? processed[0] : processed;
            clickables.push(obj);
          }
        });
        const box = new THREE.Box3().setFromObject(model);
        model.position.y += pl.posY - box.min.y;
        const glbBox = new THREE.Box3().setFromObject(model);
        const glbLabel = makeBuildingLabel(placementKeyToDisplayName(pl.elementKey));
        glbLabel.position.set(0, glbBox.max.y - model.position.y + 4, 0);
        model.add(glbLabel);
        scene.add(model);
        placementModelsRef.push({ root: model, placement: pl });
        modelsByKeyRef.current.set(pl.elementKey, model);
        if (selectedElementKeyRef.current === pl.elementKey && transformControlsRef.current) {
          transformControlsRef.current.attach(model);
        }
        clickableRef.current = [...clickableRef.current, ...clickables];
      });
    }

    effectivePlacements.forEach(loadPlacement);

    const mode = transformMode ?? "translate";
    let transformControls: TransformControls | null = null;
    let transformDragging = false;
    if (editMode && (onPlacementsChange || onElementsChange)) {
      transformControls = new TransformControls(camera, renderer.domElement);
      transformControls.setMode(mode);
      transformControlsRef.current = transformControls;
      scene.add(transformControls as unknown as THREE.Object3D);
      const dragStartRef: { placement?: Placement; element?: WorldElementData } = {};
      transformControls.addEventListener("dragging-changed", (ev) => {
        transformDragging = Boolean(ev.value);
        const attached = transformControls?.object;
        if (ev.value && attached) {
          const placementEntry = placementModelsRef.find((e) => e.root === attached);
          if (placementEntry) {
            dragStartRef.placement = { ...placementEntry.placement };
          } else {
            const elemId = (attached.userData as { elementId?: number }).elementId;
            if (elemId != null && elements?.length) {
              const el = elements.find((e) => e.id === elemId);
              if (el) dragStartRef.element = { ...el };
            }
          }
        } else if (!ev.value && attached) {
          const placementEntry = placementModelsRef.find((e) => e.root === attached);
          if (placementEntry && dragStartRef.placement && onPlacementDragEnd) {
            const root = attached as THREE.Object3D;
            const euler = new THREE.Euler().setFromQuaternion(root.quaternion);
            const next: Placement = {
              ...placementEntry.placement,
              posX: root.position.x,
              posY: root.position.y,
              posZ: root.position.z,
              scale: root.scale.x,
              rotY: (euler.y * 180) / Math.PI,
            };
            onPlacementDragEnd(placementEntry.placement.elementKey, dragStartRef.placement, next);
            delete dragStartRef.placement;
          } else {
            const elemId = (attached.userData as { elementId?: number }).elementId;
            if (elemId != null && dragStartRef.element && onElementDragEnd) {
              const group = getElementGroup(elemId);
              if (group) {
                const euler = new THREE.Euler().setFromQuaternion(group.quaternion);
                const next: WorldElementData = {
                  ...dragStartRef.element,
                  posX: group.position.x,
                  posY: group.position.y,
                  posZ: group.position.z,
                  rotY: (euler.y * 180) / Math.PI,
                  scale: group.scale.x,
                };
                onElementDragEnd(elemId, dragStartRef.element, next);
                delete dragStartRef.element;
              }
            }
          }
        }
      });
      transformControls.addEventListener("objectChange", () => {
        const attached = transformControls?.object;
        if (!attached) return;
        const placementEntry = placementModelsRef.find((e) => e.root === attached);
        if (placementEntry) {
          const root = attached as THREE.Object3D;
          const euler = new THREE.Euler().setFromQuaternion(root.quaternion);
          const updated: Placement[] = effectivePlacements.map((p) =>
            p.elementKey === placementEntry.placement.elementKey
              ? {
                  ...p,
                  posX: root.position.x,
                  posY: root.position.y,
                  posZ: root.position.z,
                  scale: root.scale.x,
                  rotY: (euler.y * 180) / Math.PI,
                }
              : p
          );
          onPlacementsChange?.(updated);
          return;
        }
        const elemId = (attached.userData as { elementId?: number }).elementId;
        if (elemId != null && onElementsChange && elements?.length) {
          const root = attached as THREE.Object3D;
          const euler = new THREE.Euler().setFromQuaternion(root.quaternion);
          const updated = elements.map((el) =>
            el.id === elemId
              ? {
                  ...el,
                  posX: root.position.x,
                  posY: root.position.y,
                  posZ: root.position.z,
                  rotY: (euler.y * 180) / Math.PI,
                  scale: root.scale.x,
                }
              : el
          );
          onElementsChange(updated);
        }
      });
    }

    const clock = new THREE.Clock();
    let orbitTheta = 0.5;
    let orbitPhi = 0.35;
    let orbitRadius = 95;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      pointerLockedRef.current = locked;
      setPointerLocked(locked);
    };
    const onWalkMouseMove = (e: MouseEvent) => {
      if (!walkMode || !pointerLockedRef.current) return;
      walkYawRef.current -= e.movementX * 0.002;
      walkPitchRef.current = Math.max(-1.2, Math.min(1.2, walkPitchRef.current - e.movementY * 0.002));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (walkMode) {
        if (e.code === "Escape") document.exitPointerLock();
        else if (e.code === "KeyE") {
          const nb = nearBuildingRef;
          if (nb === "nexus") onEnterNexus();
          else if (nb === "meridian") onEnterMeridian();
          else if (nb === "apex") onEnterApex();
          else if (nb === "harborview") onEnterHarborview();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { delete keysRef.current[e.code]; };

    const onMouseDown = (e: MouseEvent) => {
      if (walkMode) {
        if (!pointerLockedRef.current) renderer.domElement.requestPointerLock();
        return;
      }
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (walkMode) return;
      if (isDragging && !transformDragging) {
        orbitTheta -= (e.clientX - lastX) * 0.004;
        orbitPhi = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, orbitPhi - (e.clientY - lastY) * 0.004));
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        const rect = mount.getBoundingClientRect();
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const hits = raycasterRef.current.intersectObjects(clickableRef.current);
        if (hits.length > 0) {
          const b = (hits[0].object as THREE.Mesh & { userData: { building?: string } }).userData?.building;
          setHoveredBuilding(b === "nexus" ? "nexus" : b === "meridian" ? "meridian" : b === "apex" ? "apex" : b === "harborview" ? "harborview" : null);
        } else {
          setHoveredBuilding(null);
        }
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onClick = (e: MouseEvent) => {
      if (isDragging) return;
      if (walkMode) return; // Walk mode uses E key to enter
      const rect = mount.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(clickableRef.current);
      if (editMode && transformControls) {
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          let placementKey: string | null = null;
          let elemId: number | null = null;
          while (obj) {
            const ud = obj.userData as { placementElementKey?: string; elementId?: number };
            if (ud.placementElementKey) {
              placementKey = ud.placementElementKey;
              break;
            }
            if (ud.elementId != null) {
              elemId = ud.elementId;
              break;
            }
            obj = obj.parent;
          }
          if (placementKey) {
            const model = modelsByKeyRef.current.get(placementKey);
            if (model) {
              transformControls.attach(model);
              onSelect?.(placementKey);
              onSelectElement?.(null);
            }
          } else if (elemId != null) {
            const group = getElementGroup(elemId);
            if (group) {
              transformControls.attach(group);
              onSelectElement?.(elemId);
              onSelect?.(null);
            }
          } else {
            transformControls.detach();
            onSelect?.(null);
            onSelectElement?.(null);
          }
        } else {
          transformControls.detach();
          onSelect?.(null);
          onSelectElement?.(null);
        }
        return;
      }
      if (hits.length > 0) {
        const b = (hits[0].object as THREE.Mesh & { userData: { building?: string } }).userData?.building;
        if (b === "nexus") onEnterNexus();
        else if (b === "meridian") onEnterMeridian();
        else if (b === "apex") onEnterApex();
        else if (b === "harborview") onEnterHarborview();
      }
    };
    const onWheel = (e: WheelEvent) => {
      orbitRadius = Math.max(40, Math.min(150, orbitRadius + e.deltaY * 0.08));
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousemove", onWalkMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

    const WALK_SPEED = 0.12;
    const PROXIMITY = 22;
    let nearBuildingRef: "nexus" | "meridian" | "apex" | "harborview" | null = null;

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      animateTerrain(scene, elapsed);
      if (useElements) animateWorldElements(elapsed);

      if (walkMode) {
        const keys = keysRef.current;
        const yaw = walkYawRef.current;
        const pitch = walkPitchRef.current;
        const pos = walkPosRef.current;
        const speed = (keys["ShiftLeft"] || keys["ShiftRight"]) ? WALK_SPEED * 2 : WALK_SPEED;
        const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        if (keys["KeyW"] || keys["ArrowUp"]) pos.addScaledVector(fwd, speed);
        if (keys["KeyS"] || keys["ArrowDown"]) pos.addScaledVector(fwd, -speed);
        if (keys["KeyA"] || keys["ArrowLeft"]) pos.addScaledVector(right, -speed);
        if (keys["KeyD"] || keys["ArrowRight"]) pos.addScaledVector(right, speed);
        pos.x = Math.max(-120, Math.min(120, pos.x));
        pos.z = Math.max(-120, Math.min(120, pos.z));
        camera.position.copy(pos);
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
        // Proximity check vs placements
        let found: "nexus" | "meridian" | "apex" | "harborview" | null = null;
        for (const p of effectivePlacements) {
          const dx = pos.x - p.posX, dz = pos.z - p.posZ;
          if (Math.sqrt(dx * dx + dz * dz) < PROXIMITY) {
            if (p.elementKey.includes("nexus")) found = "nexus";
            else if (p.elementKey.includes("meridian")) found = "meridian";
            else if (p.elementKey.includes("apex")) found = "apex";
            else if (p.elementKey.includes("harborview")) found = "harborview";
            break;
          }
        }
        if (found !== nearBuildingRef) {
          nearBuildingRef = found;
          setNearBuilding(found);
        }
      } else {
        const x = orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
        const y = orbitRadius * Math.sin(orbitPhi) + 20;
        const z = orbitRadius * Math.cos(orbitPhi) * Math.cos(orbitTheta);
        camera.position.set(x, y, z);
        camera.lookAt(0, 15, 0);
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      transformControlsRef.current = null;
      modelsByKeyRef.current.clear();
      transformControls?.dispose();
      cancelAnimationFrame(raf);
      document.exitPointerLock();
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousemove", onWalkMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [onEnterNexus, onEnterMeridian, onEnterApex, onEnterHarborview, setHoveredBuilding, placements?.map((p) => `${p.elementKey}:${p.glbUrl}`).join(";"), elements?.map((e) => e.id).join(","), editMode, walkMode, onPlacementsChange, onElementsChange]);

  useEffect(() => {
    const scene = sceneRef.current;
    const lighting = sceneLighting ?? DEFAULT_SCENE_LIGHTING;
    const ambient = scene?.userData?.ambientLight as THREE.AmbientLight | undefined;
    const sun = scene?.userData?.sunLight as THREE.DirectionalLight | undefined;
    if (!ambient || !sun) return;
    ambient.intensity = lighting.ambientIntensity;
    sun.intensity = lighting.sunIntensity;
    const az = (lighting.sunAzimuth * Math.PI) / 180;
    const el = (lighting.sunElevation * Math.PI) / 180;
    sun.position.set(
      Math.cos(el) * Math.sin(az) * 80,
      Math.sin(el) * 80,
      Math.cos(el) * Math.cos(az) * 80
    );
  }, [sceneLighting]);

  useEffect(() => {
    if (!editMode) return;
    selectedElementKeyRef.current = selectedElementKey ?? null;
    selectedElementIdRef.current = selectedElementId ?? null;
    const tc = transformControlsRef.current;
    if (!tc) return;
    if (selectedElementKey) {
      const obj = modelsByKeyRef.current.get(selectedElementKey);
      if (obj) tc.attach(obj);
      else tc.detach();
    } else if (selectedElementId != null) {
      const group = getElementGroup(selectedElementId);
      if (group) tc.attach(group);
      else tc.detach();
    } else {
      tc.detach();
    }
  }, [editMode, selectedElementKey, selectedElementId]);

  useEffect(() => {
    if (!editMode) return;
    transformControlsRef.current?.setMode(transformMode ?? "translate");
  }, [editMode, transformMode]);

  useEffect(() => {
    if (!editMode || !placements?.length) return;
    placements.forEach((pl) => {
      const obj = modelsByKeyRef.current.get(pl.elementKey);
      if (obj) {
        obj.position.set(pl.posX, pl.posY, pl.posZ);
        obj.scale.setScalar(pl.scale);
        obj.rotation.y = (pl.rotY * Math.PI) / 180;
      }
    });
  }, [editMode, placements]);

  useEffect(() => {
    if (!editMode || !elements?.length) return;
    elements.forEach((el) => {
      const group = getElementGroup(el.id);
      if (group) {
        group.position.set(el.posX, el.posY, el.posZ);
        group.rotation.y = (el.rotY * Math.PI) / 180;
        group.scale.setScalar(el.scale);
      }
    });
  }, [editMode, elements]);

  return (
    <div className={embedded ? "absolute inset-0 bg-[#020408]" : "fixed inset-0 bg-[#020408]"}>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(2,4,8,0.85) 0%, transparent 100%)" }}>
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-cyan-400">{worldTitle}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {editMode ? "G/R/S: Move • Rotate • Scale • Click to select • Del: Delete • Esc: Deselect" : walkMode ? "WASD move • Shift run • Click to capture mouse • ESC to exit" : "Click a building to enter • Drag to orbit • Scroll to zoom"}
          </p>
        </div>
        <Link href="/dashboard" className="pointer-events-auto px-4 py-2 text-sm text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 transition-colors">
          ← Dashboard
        </Link>
      </div>
      {!editMode && !walkMode && (
        <div className="absolute top-[72px] left-4 z-10 w-[200px] pointer-events-auto">
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/90 backdrop-blur px-3 py-3">
            <div className="text-[11px] tracking-wider text-cyan-400/90 font-mono mb-2">BUILDINGS IN WORLD</div>
            <div className="space-y-1">
              {["nexus-tower", "meridian-tower", "apex-tower", "harborview-tower"].map((key) => {
                const name = key === "nexus-tower" ? "Nexus Tower" : key === "meridian-tower" ? "Meridian Tower" : key === "apex-tower" ? "Apex Tower" : "Harborview Tower";
                const isPresent = placements?.some((p) => p.elementKey === key);
                return (
                  <div key={key} className="flex items-center gap-2 py-1.5 px-2 rounded text-sm text-slate-200">
                    <span className={isPresent ? "text-emerald-400" : "text-amber-400/80"}>●</span>
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col pointer-events-none" style={{ background: "linear-gradient(to top, rgba(2,4,8,0.9) 0%, transparent 100%)" }}>
        <div className="flex items-center justify-between px-6 py-3">
          <p className="text-slate-400 text-xs tracking-wide">Drag — Orbit | Scroll — Zoom | Right-drag — Pan</p>
          <div className="pointer-events-auto flex items-center gap-4 text-slate-300 text-sm">
            <span>☀️</span>
            <span>{String(displayTime.h).padStart(2, "0")}:{String(displayTime.m).padStart(2, "0")}</span>
            <span className="text-cyan-400/90">{period}</span>
            <button
              type="button"
              onClick={() => setTimePaused((p) => !p)}
              className="px-2 py-1 rounded bg-slate-700/80 hover:bg-slate-600 text-xs"
            >
              {timePaused ? "▶" : "⏸"}
            </button>
            <span className="text-slate-400">SPEED</span>
            <span>{speed.toFixed(1)}x</span>
          </div>
        </div>
      {!editMode && !walkMode && (
        <div className="flex flex-wrap gap-6 px-6 py-4">
          <button
            onClick={onEnterNexus}
            className={`pointer-events-auto px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              hoveredBuilding === "nexus" ? "bg-cyan-500/30 border-2 border-cyan-400" : "bg-slate-800/60 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/15"
            }`}
          >
            Nexus Tower — 9 floors, workers, elevator
          </button>
          <button
            onClick={onEnterApex}
            className={`pointer-events-auto px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              hoveredBuilding === "apex" ? "bg-amber-500/30 border-2 border-amber-400" : "bg-slate-800/60 border border-amber-500/30 text-amber-400 hover:bg-amber-500/15"
            }`}
          >
            Apex Tower — Corporate HQ
          </button>
          <button
            onClick={onEnterMeridian}
            className={`pointer-events-auto px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              hoveredBuilding === "meridian" ? "bg-cyan-500/30 border-2 border-cyan-400" : "bg-slate-800/60 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/15"
            }`}
          >
            Meridian Tower — 2 floors, receptionists
          </button>
          <button
            onClick={onEnterHarborview}
            className={`pointer-events-auto px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              hoveredBuilding === "harborview" ? "bg-sky-500/30 border-2 border-sky-400" : "bg-slate-800/60 border border-sky-500/30 text-sky-400 hover:bg-sky-500/15"
            }`}
          >
            Harborview Tower — Waterfront, 7 floors
          </button>
        </div>
      )}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        {walkMode && (
          <>
            <div className="w-4 h-4 border-2 border-cyan-400/80 rounded-full" style={{ marginLeft: -8, marginTop: -8 }} />
            {nearBuilding && (
              <div className="mt-6 bg-slate-900/90 border border-cyan-500/40 rounded-lg px-4 py-2 text-sm font-medium text-cyan-400">
                Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">E</kbd> to enter {nearBuilding === "nexus" ? "Nexus Tower" : nearBuilding === "apex" ? "Apex Tower" : nearBuilding === "harborview" ? "Harborview Tower" : "Meridian Tower"}
              </div>
            )}
          </>
        )}
        {!editMode && !walkMode && hoveredBuilding && (
          <div className={`bg-slate-900/90 border rounded-lg px-4 py-2 text-sm font-medium ${
            hoveredBuilding === "apex"
              ? "border-amber-500/40 text-amber-400"
              : hoveredBuilding === "harborview"
              ? "border-sky-500/40 text-sky-400"
              : "border-cyan-500/40 text-cyan-400"
          }`}>
            Click to enter {hoveredBuilding === "nexus" ? "Nexus Tower" : hoveredBuilding === "apex" ? "Apex Tower" : hoveredBuilding === "harborview" ? "Harborview Tower" : "Meridian Tower"}
          </div>
        )}
      </div>
    </div>
  );
}
