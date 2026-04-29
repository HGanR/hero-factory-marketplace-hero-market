"use client";

/**
 * 3D Modeling Canvas
 * Professional 3D design tool for creating parametric models
 *
 * Copied from: /Users/apple/Desktop/3D Model Creation with Image and Audio Upload/ModelingCanvas.tsx
 * Adjusted for this repo (three export + shadowmap constant + async mesh creation).
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { InteriorEditor } from "./InteriorEditor";
import { GizmoControlsPanel, type GizmoMode } from "./GizmoModeButtons";
import { TransformGizmo, constrainToGround } from "./transform-gizmo";
import {
  createMeshFromObject,
  OBJECT_PRESETS,
  type ParametricObject,
  type ObjectType,
  type PolyLevel,
} from "./parametric-objects";
import { Plus, Trash2, Download, Save, Eye, EyeOff, AlertCircle } from "lucide-react";

export function ModelingCanvas({ onSave }: { onSave?: (object: ParametricObject, glbBlob: Blob) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const gizmoRef = useRef<TransformGizmo | null>(null);
  const selectedObjectIdRef = useRef<string | null>(null);

  const [objects, setObjects] = useState<ParametricObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [objectName, setObjectName] = useState("My Model");
  const [polyLevel, setPolyLevel] = useState<PolyLevel>("mid");
  const [showGrid, setShowGrid] = useState(true);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const GROUND_LEVEL = 0;

  const applyTransformToMesh = (mesh: THREE.Object3D, obj: ParametricObject) => {
    mesh.position.set(obj.position[0], obj.position[1], obj.position[2]);
    mesh.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
    mesh.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
    constrainToGround(mesh, GROUND_LEVEL);
  };

  useEffect(() => {
    selectedObjectIdRef.current = selectedObjectId;
  }, [selectedObjectId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 100, 1000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Make canvas focusable for better shortcut handling
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = "none";

    // Initialize gizmo
    const gizmo = new TransformGizmo(scene, camera, renderer, GROUND_LEVEL, {
      onTransformEnd: (obj3d) => {
        const id = selectedObjectIdRef.current;
        if (!id) return;
        const pos: [number, number, number] = [obj3d.position.x, obj3d.position.y, obj3d.position.z];
        const rot: [number, number, number] = [obj3d.rotation.x, obj3d.rotation.y, obj3d.rotation.z];
        const scl: [number, number, number] = [obj3d.scale.x, obj3d.scale.y, obj3d.scale.z];
        setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, position: pos, rotation: rot, scale: scl } : o)));
      },
    });
    gizmoRef.current = gizmo;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 100;
    scene.add(directionalLight);

    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
    gridHelper.position.y = 0;
    gridHelper.visible = showGrid;
    scene.add(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Orbit controls (right-click drag), leave left-click for gizmo interactions
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onDown = (e: MouseEvent) => {
      // Focus canvas so key shortcuts work
      (e.currentTarget as HTMLElement | null)?.focus?.();
      // Right click only
      if (e.button !== 2) return;
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01);
      camera.position.applyAxisAngle(
        new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01),
        deltaY * 0.01
      );
      camera.lookAt(0, 5, 0);
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const direction = camera.position.clone().normalize();
      const distance = camera.position.length();
      const newDistance = distance + e.deltaY * 0.1;
      camera.position.copy(direction.multiplyScalar(Math.max(5, newDistance)));
      camera.lookAt(0, 5, 0);
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    renderer.domElement.addEventListener("mousemove", onMove);
    renderer.domElement.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", (e: MouseEvent) => e.preventDefault());

    const animate = () => {
      requestAnimationFrame(animate);
      // Keep selected object above ground (cheap, avoids falling below 0 during gizmo use)
      const id = selectedObjectIdRef.current;
      if (id && objectsRef.current.has(id)) {
        const mesh = objectsRef.current.get(id);
        if (mesh) constrainToGround(mesh, GROUND_LEVEL);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("mousemove", onMove);
      renderer.domElement.removeEventListener("mouseup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel as any);
      renderer.dispose();
      gizmo.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts for gizmo modes (T/R/S), ignore when typing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;

      const k = e.key.toLowerCase();
      if (k !== "t" && k !== "r" && k !== "s") return;
      const next: GizmoMode = k === "t" ? "translate" : k === "r" ? "rotate" : "scale";
      setGizmoMode(next);
      gizmoRef.current?.setMode(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Update grid visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    const grid = sceneRef.current.children.find((c) => c instanceof THREE.GridHelper) as THREE.GridHelper | undefined;
    if (grid) grid.visible = showGrid;
  }, [showGrid]);

  // Keep gizmo in sync with selection and mode
  useEffect(() => {
    const gizmo = gizmoRef.current;
    if (!gizmo) return;
    if (selectedObjectId && objectsRef.current.has(selectedObjectId)) {
      gizmo.setObject(objectsRef.current.get(selectedObjectId) ?? null);
      gizmo.setMode(gizmoMode);
    } else {
      gizmo.setObject(null);
    }
  }, [selectedObjectId, gizmoMode]);

  // Keep the export filename aligned with the selected object's name (nice UX)
  useEffect(() => {
    if (!selectedObject) return;
    setObjectName(selectedObject.name || "My Model");
  }, [selectedObjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addObject = async (type: ObjectType) => {
    const preset = OBJECT_PRESETS[type];
    const newObject: ParametricObject = {
      id: `obj-${Date.now()}`,
      type,
      name: preset.name || "Object",
      parameters: (preset.parameters || {}) as any,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      material: (preset.material || { color: "#cccccc", metalness: 0.5, roughness: 0.5 }) as any,
      polyLevel,
    };

    setObjects((prev) => [...prev, newObject]);
    setSelectedObjectId(newObject.id);

    if (sceneRef.current) {
      const mesh = await createMeshFromObject(newObject);
      applyTransformToMesh(mesh, newObject);
      sceneRef.current.add(mesh);
      objectsRef.current.set(newObject.id, mesh);
      gizmoRef.current?.setObject(mesh);
    }
  };

  const updateObject = async (updates: Partial<ParametricObject>) => {
    if (!selectedObject || !selectedObjectId) return;
    const updated: ParametricObject = { ...selectedObject, ...updates };
    setObjects((prev) => prev.map((o) => (o.id === selectedObjectId ? updated : o)));

    const mesh = objectsRef.current.get(selectedObjectId);
    if (!sceneRef.current || !mesh) return;

    const touchesTransform = "position" in updates || "rotation" in updates || "scale" in updates;
    const touchesGeometry = "parameters" in updates || "polyLevel" in updates || "type" in updates || "interior" in updates;

    if (touchesTransform && !touchesGeometry) {
      // Apply transform without rebuilding geometry
      applyTransformToMesh(mesh, updated);
      gizmoRef.current?.setObject(mesh);
      return;
    }

    // Rebuild for geometry-affecting changes
    sceneRef.current.remove(mesh);
    const newMesh = await createMeshFromObject(updated);
    applyTransformToMesh(newMesh, updated);
    sceneRef.current.add(newMesh);
    objectsRef.current.set(selectedObjectId, newMesh);
    gizmoRef.current?.setObject(newMesh);
  };

  const deleteObject = (id: string) => {
    setObjects((prev) => prev.filter((o) => o.id !== id));
    if (sceneRef.current && objectsRef.current.has(id)) {
      const mesh = objectsRef.current.get(id);
      if (mesh) sceneRef.current.remove(mesh);
      objectsRef.current.delete(id);
    }
    if (selectedObjectId === id) setSelectedObjectId(null);
  };

  const exportToGlbBlob = async (obj3d: THREE.Object3D): Promise<Blob> => {
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const exporter = new GLTFExporter();
    const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        obj3d,
        (result) => {
          if (result instanceof ArrayBuffer) return resolve(result);
          try {
            const text = JSON.stringify(result);
            resolve(new TextEncoder().encode(text).buffer);
          } catch {
            reject(new Error("Unexpected export format"));
          }
        },
        (e) => reject(new Error((e as any)?.message || "Export failed")),
        { binary: true }
      );
    });
    return new Blob([ab], { type: "model/gltf-binary" });
  };

  const handleExport = async () => {
    if (!selectedObjectId) return;
    setSaving(true);
    setError(null);
    try {
      const obj3d = objectsRef.current.get(selectedObjectId);
      if (!obj3d) throw new Error("No mesh found for selected object");
      const glbBlob = await exportToGlbBlob(obj3d);
      const url = URL.createObjectURL(glbBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${objectName}.glb`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!selectedObjectId || !selectedObject) return;
    setSaving(true);
    setError(null);
    try {
      const obj3d = objectsRef.current.get(selectedObjectId);
      if (!obj3d) throw new Error("No mesh found for selected object");
      const glbBlob = await exportToGlbBlob(obj3d);
      onSave?.(selectedObject, glbBlob);
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[70vh]">
      <div className="lg:col-span-3">
        <div
          ref={containerRef}
          className="w-full min-h-[70vh] rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden"
        />
      </div>

      <div className="lg:col-span-1 space-y-4 overflow-y-auto pb-4">
        <GizmoControlsPanel
          mode={gizmoMode}
          onModeChange={(m) => {
            setGizmoMode(m);
            gizmoRef.current?.setMode(m);
          }}
          gizmoRef={gizmoRef}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Object</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                "building",
                "bridge",
                "lake",
                "river",
                "pond",
                "chair",
                "table",
                "street",
                "sidewalk",
                "lightpost",
                "tree",
                "bush",
              ] as ObjectType[]
            ).map((type) => (
              <Button
                key={type}
                onClick={() => void addObject(type)}
                variant="outline"
                size="sm"
                className="w-full text-xs justify-start"
              >
                <Plus className="h-3 w-3 mr-2" />
                {OBJECT_PRESETS[type].name}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Scene</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Poly Level</Label>
              <Select value={polyLevel} onValueChange={(v: any) => setPolyLevel(v)}>
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Poly</SelectItem>
                  <SelectItem value="mid">Mid Poly</SelectItem>
                  <SelectItem value="high">High Poly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setShowGrid((s) => !s)}
              variant="outline"
              size="sm"
              className="w-full text-xs gap-2"
            >
              {showGrid ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showGrid ? "Hide" : "Show"} Grid
            </Button>
            <Alert className="border-cyan-700/50 bg-cyan-900/20 p-2">
              <AlertCircle className="h-3 w-3 text-cyan-400" />
              <AlertDescription className="text-cyan-300 text-xs">
                Use gizmo: T=Translate, R=Rotate, S=Scale. Right-click drag rotates camera. Objects stay above ground (Y ≥ {GROUND_LEVEL}).
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Objects ({objects.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-40 overflow-y-auto">
            {objects.map((obj) => (
              <div
                key={obj.id}
                className={`p-2 rounded border text-xs cursor-pointer transition ${
                  selectedObjectId === obj.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
                onClick={() => setSelectedObjectId(obj.id)}
              >
                <div className="flex justify-between items-center">
                  <span>{obj.name}</span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteObject(obj.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {selectedObject ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Object Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={selectedObject.name}
                    onChange={(e) => void updateObject({ name: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={String(selectedObject.material.color)}
                      onChange={(e) =>
                        void updateObject({ material: { ...selectedObject.material, color: e.target.value } as any })
                      }
                      className="w-10 h-8 rounded cursor-pointer"
                    />
                    <Input
                      value={String(selectedObject.material.color)}
                      onChange={(e) =>
                        void updateObject({ material: { ...selectedObject.material, color: e.target.value } as any })
                      }
                      className="text-xs flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Scale</Label>
                  {(["X", "Y", "Z"] as const).map((axis, i) => (
                    <div key={axis}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-slate-400">{axis}</span>
                        <span className="text-xs text-cyan-400">{selectedObject.scale[i].toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[selectedObject.scale[i]]}
                        onValueChange={([v]) => {
                          const newScale = [...selectedObject.scale] as [number, number, number];
                          newScale[i] = v;
                          void updateObject({ scale: newScale });
                        }}
                        min={0.1}
                        max={3}
                        step={0.1}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedObject.type === "building" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Interior Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <InteriorEditor
                    interior={selectedObject.interior}
                    onUpdate={(interior) => void updateObject({ interior })}
                    buildingDimensions={{
                      width: Number(selectedObject.parameters.width || 4),
                      height: Number(selectedObject.parameters.height || 6),
                      depth: Number(selectedObject.parameters.depth || 3),
                    }}
                  />
                </CardContent>
              </Card>
            ) : null}

            {error ? (
              <Alert className="border-red-700/50 bg-red-900/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300 text-xs">{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Button
                onClick={() => void handleExport()}
                variant="secondary"
                className="w-full text-xs gap-2"
                disabled={saving}
              >
                <Download className="h-4 w-4" />
                Export GLB
              </Button>

              <Button
                onClick={() => void handleSaveToLibrary()}
                className="w-full text-xs gap-2 bg-cyan-600 hover:bg-cyan-700"
                disabled={saving}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save to Library"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default ModelingCanvas;


