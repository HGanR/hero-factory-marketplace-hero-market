/**
 * Building Editor Controls
 *
 * Interactive 3D transform controls for building components with:
 * - Translation (move X, Y, Z)
 * - Rotation (rotate X, Y, Z)
 * - Scaling (scale X, Y, Z, uniform)
 * - Gizmo visualization
 * - Keyboard shortcuts
 * - Mouse drag support
 * - Grid snapping
 *
 * Adapted for this repo:
 * - Uses `building.exteriorComponents.removeComponent` (no `removeExteriorComponent` method exists here)
 * - Uses `MeshStandardMaterial` so we can highlight via emissive
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Building, BuildingComponent } from "@/lib/BuildingSystem";
import { Move3D, RotateCw, ZoomIn, Grid3x3, Lock, Unlock, Copy, Trash2, Eye, EyeOff } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type TransformMode = "translate" | "rotate" | "scale";
type TransformSpace = "local" | "world";
type DragAxis = "x" | "y" | "z" | "xy" | "xz" | "yz" | null;

interface TransformState {
  mode: TransformMode;
  space: TransformSpace;
  dragAxis: DragAxis;
  isDragging: boolean;
  startPosition: THREE.Vector3;
  startRotation: THREE.Euler;
  startScale: THREE.Vector3;
  startMousePosition: THREE.Vector2;
}

export interface ControlsConfig {
  gridSize?: number;
  snapToGrid?: boolean;
  constrainAxis?: boolean;
  showGizmo?: boolean;
  gizmoSize?: number;
  sensitivity?: number;
}

interface GizmoAxis {
  id: string;
  axis: "x" | "y" | "z";
  color: number;
  direction: THREE.Vector3;
  mesh: THREE.Object3D;
}

// ============================================================================
// Gizmo Factory
// ============================================================================

class TransformGizmo {
  private group: THREE.Group;
  private axes: Map<string, GizmoAxis> = new Map();
  private size: number;

  constructor(size: number = 1) {
    this.size = size;
    this.group = new THREE.Group();
    this.createAxes();
  }

  private createAxes(): void {
    const axisConfigs = [
      { id: "x", axis: "x" as const, color: 0xff0000, direction: new THREE.Vector3(1, 0, 0) },
      { id: "y", axis: "y" as const, color: 0x00ff00, direction: new THREE.Vector3(0, 1, 0) },
      { id: "z", axis: "z" as const, color: 0x0000ff, direction: new THREE.Vector3(0, 0, 1) },
    ];

    axisConfigs.forEach(({ id, axis, color, direction }) => {
      const arrowGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
      const arrowMaterial = new THREE.MeshStandardMaterial({ color, emissive: 0x000000, emissiveIntensity: 0.8 });
      const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);

      arrowMesh.position.copy(direction).multiplyScalar(this.size + 0.2);
      arrowMesh.lookAt(direction.clone().multiplyScalar(this.size + 1));

      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array([0, 0, 0, direction.x * this.size, direction.y * this.size, direction.z * this.size]);
      lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      const lineMaterial = new THREE.LineBasicMaterial({ color });
      const lineMesh = new THREE.Line(lineGeometry, lineMaterial);

      const axisGroup = new THREE.Group();
      axisGroup.add(lineMesh);
      axisGroup.add(arrowMesh);
      axisGroup.userData.axisId = id;

      this.group.add(axisGroup);
      this.axes.set(id, { id, axis, color, direction, mesh: axisGroup });
    });
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  setPosition(position: THREE.Vector3): void {
    this.group.position.copy(position);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  highlightAxis(axisId: string | null): void {
    this.axes.forEach((axis) => {
      const arrowMesh = axis.mesh.children[1] as THREE.Mesh | undefined;
      if (!arrowMesh) return;
      const mat = arrowMesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(axisId === axis.id ? 0x444444 : 0x000000);
      mat.needsUpdate = true;
    });
  }

  dispose(): void {
    this.axes.forEach((axis) => {
      axis.mesh.traverse((child) => {
        // Use runtime flags to avoid TS generic narrowing issues
        const anyChild = child as any;
        if (anyChild?.isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        } else if (anyChild?.isLine) {
          const line = child as THREE.Line;
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
        }
      });
    });
    this.group.clear();
  }
}

// ============================================================================
// Component
// ============================================================================

interface BuildingEditorControlsProps {
  building: Building;
  selectedComponentId: string | null;
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  onComponentTransformed?: (component: BuildingComponent) => void;
  onComponentDeleted?: (componentId: string) => void;
  onComponentDuplicated?: (component: BuildingComponent) => void;
  config?: ControlsConfig;
}

export const BuildingEditorControls = React.forwardRef<HTMLDivElement, BuildingEditorControlsProps>(
  (
    {
      building,
      selectedComponentId,
      scene,
      camera,
      renderer,
      onComponentTransformed,
      onComponentDeleted,
      onComponentDuplicated,
      config = {},
    },
    ref
  ) => {
    const gizmoRef = useRef<TransformGizmo | null>(null);
    const transformStateRef = useRef<TransformState>({
      mode: "translate",
      space: "world",
      dragAxis: null,
      isDragging: false,
      startPosition: new THREE.Vector3(),
      startRotation: new THREE.Euler(),
      startScale: new THREE.Vector3(1, 1, 1),
      startMousePosition: new THREE.Vector2(),
    });

    const [transformMode, setTransformMode] = useState<TransformMode>("translate");
    const [transformSpace, setTransformSpace] = useState<TransformSpace>("world");
    const [gridSnap, setGridSnap] = useState(config.snapToGrid ?? false);
    const [showGizmo, setShowGizmo] = useState(config.showGizmo ?? true);
    const [constrainAxis, setConstrainAxis] = useState(config.constrainAxis ?? false);

    const { gridSize = 0.5, gizmoSize = 1, sensitivity = 1 } = config;

    // Initialize gizmo
    useEffect(() => {
      gizmoRef.current = new TransformGizmo(gizmoSize);
      scene.add(gizmoRef.current.getGroup());

      return () => {
        if (!gizmoRef.current) return;
        gizmoRef.current.dispose();
        scene.remove(gizmoRef.current.getGroup());
        gizmoRef.current = null;
      };
    }, [scene, gizmoSize]);

    const getSelectedComponent = useCallback((): BuildingComponent | null => {
      if (!selectedComponentId) return null;
      // Note: this controls component only edits exterior components for now.
      return building.getExteriorComponents().find((c) => c.id === selectedComponentId) || null;
    }, [selectedComponentId, building]);

    // Update gizmo position when component selected
    useEffect(() => {
      if (!gizmoRef.current) return;
      const component = getSelectedComponent();
      if (!component) {
        gizmoRef.current.setVisible(false);
        return;
      }
      gizmoRef.current.setPosition(new THREE.Vector3(component.position.x, component.position.y, component.position.z));
      gizmoRef.current.setVisible(showGizmo);
    }, [getSelectedComponent, showGizmo]);

    const handleTranslate = (component: BuildingComponent, delta: THREE.Vector3, axis: DragAxis) => {
      const state = transformStateRef.current;
      if (axis === "x" || (constrainAxis && state.dragAxis === "x")) component.position.x = state.startPosition.x + delta.x;
      else if (axis === "y" || (constrainAxis && state.dragAxis === "y")) component.position.y = state.startPosition.y + delta.y;
      else if (axis === "z" || (constrainAxis && state.dragAxis === "z")) component.position.z = state.startPosition.z + delta.x;
      else {
        component.position.x = state.startPosition.x + delta.x;
        component.position.y = state.startPosition.y + delta.y;
      }

      if (gridSnap) {
        component.position.x = Math.round(component.position.x / gridSize) * gridSize;
        component.position.y = Math.round(component.position.y / gridSize) * gridSize;
        component.position.z = Math.round(component.position.z / gridSize) * gridSize;
      }
      if (component.position.y < 0) component.position.y = 0;
    };

    const handleRotate = (component: BuildingComponent, delta: THREE.Vector3, axis: DragAxis) => {
      const state = transformStateRef.current;
      const rotationSpeed = 0.01;
      if (axis === "x") component.rotation.x = state.startRotation.x + delta.y * rotationSpeed;
      else if (axis === "y") component.rotation.y = state.startRotation.y + delta.x * rotationSpeed;
      else if (axis === "z") component.rotation.z = state.startRotation.z + delta.x * rotationSpeed;
      else {
        component.rotation.x = state.startRotation.x + delta.y * rotationSpeed;
        component.rotation.y = state.startRotation.y + delta.x * rotationSpeed;
      }
    };

    const handleScale = (component: BuildingComponent, delta: THREE.Vector3, axis: DragAxis) => {
      const state = transformStateRef.current;
      const scaleSpeed = 0.01;
      const scaleDelta = delta.x * scaleSpeed;

      if (axis === "x") component.scale.x = Math.max(0.1, state.startScale.x + scaleDelta);
      else if (axis === "y") component.scale.y = Math.max(0.1, state.startScale.y + scaleDelta);
      else if (axis === "z") component.scale.z = Math.max(0.1, state.startScale.z + scaleDelta);
      else {
        const newScale = Math.max(0.1, state.startScale.x + scaleDelta);
        component.scale.x = newScale;
        component.scale.y = newScale;
        component.scale.z = newScale;
      }
    };

    const handleMouseDown = useCallback(
      (event: MouseEvent) => {
        const component = getSelectedComponent();
        if (!component || !gizmoRef.current) return;

        const state = transformStateRef.current;
        state.isDragging = true;
        state.startPosition.copy(new THREE.Vector3(component.position.x, component.position.y, component.position.z));
        state.startRotation.copy(new THREE.Euler(component.rotation.x, component.rotation.y, component.rotation.z));
        state.startScale.copy(new THREE.Vector3(component.scale.x, component.scale.y, component.scale.z));
        state.startMousePosition.set(event.clientX, event.clientY);

        // Raycast to determine which axis was clicked
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(gizmoRef.current.getGroup().children, true);
        if (intersects.length > 0) {
          const hitObject = intersects[0].object;
          const axisId = (hitObject.parent?.userData.axisId || hitObject.userData.axisId) as string;
          state.dragAxis = (axisId as DragAxis) || null;
          gizmoRef.current.highlightAxis(axisId);
        } else {
          state.dragAxis = null;
        }
      },
      [getSelectedComponent, renderer, camera]
    );

    const handleMouseMove = useCallback(
      (event: MouseEvent) => {
        const state = transformStateRef.current;
        if (!state.isDragging) return;
        const component = getSelectedComponent();
        if (!component) return;

        const deltaX = event.clientX - state.startMousePosition.x;
        const deltaY = event.clientY - state.startMousePosition.y;
        const delta = new THREE.Vector3(deltaX, -deltaY, 0).multiplyScalar(0.01 * sensitivity);

        if (state.mode === "translate") handleTranslate(component, delta, state.dragAxis);
        else if (state.mode === "rotate") handleRotate(component, delta, state.dragAxis);
        else handleScale(component, delta, state.dragAxis);

        onComponentTransformed?.(component);

        if (gizmoRef.current) {
          gizmoRef.current.setPosition(new THREE.Vector3(component.position.x, component.position.y, component.position.z));
        }
      },
      [getSelectedComponent, sensitivity, onComponentTransformed]
    );

    const handleMouseUp = useCallback(() => {
      const state = transformStateRef.current;
      state.isDragging = false;
      state.dragAxis = null;
      gizmoRef.current?.highlightAxis(null);
    }, []);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent) => {
        const component = getSelectedComponent();
        if (!component) return;

        const key = event.key.toLowerCase();

        if (key === "g") {
          setTransformMode("translate");
          transformStateRef.current.mode = "translate";
        } else if (key === "r") {
          setTransformMode("rotate");
          transformStateRef.current.mode = "rotate";
        } else if (key === "s") {
          setTransformMode("scale");
          transformStateRef.current.mode = "scale";
        }

        if (key === "x") transformStateRef.current.dragAxis = "x";
        else if (key === "y") transformStateRef.current.dragAxis = "y";
        else if (key === "z") transformStateRef.current.dragAxis = "z";

        if (event.key === "Shift") setGridSnap(true);

        if (key === "delete" && selectedComponentId) {
          building.exteriorComponents.removeComponent(selectedComponentId);
          onComponentDeleted?.(selectedComponentId);
        }

        if ((event.ctrlKey || event.metaKey) && key === "d") {
          event.preventDefault();
          const duplicated: BuildingComponent = {
            ...component,
            id: `${component.id}-copy-${Date.now()}`,
            position: { x: component.position.x + gridSize, y: component.position.y, z: component.position.z },
          };
          building.addExteriorComponent(duplicated);
          onComponentDuplicated?.(duplicated);
        }
      },
      [getSelectedComponent, selectedComponentId, building, gridSize, onComponentDeleted, onComponentDuplicated]
    );

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
      if (event.key === "Shift") setGridSnap(false);
    }, []);

    useEffect(() => {
      renderer.domElement.addEventListener("mousedown", handleMouseDown);
      renderer.domElement.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        renderer.domElement.removeEventListener("mousedown", handleMouseDown);
        renderer.domElement.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, [renderer, handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown, handleKeyUp]);

    return (
      <div
        ref={ref}
        className="absolute bottom-4 left-4 bg-slate-950/80 border border-white/10 rounded-lg p-4 space-y-4 text-white w-[320px]"
      >
        <h3 className="font-bold text-sm">Transform Controls</h3>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Mode (G/R/S)</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTransformMode("translate");
                transformStateRef.current.mode = "translate";
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium transition ${
                transformMode === "translate" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Move3D size={14} />
              Move
            </button>
            <button
              onClick={() => {
                setTransformMode("rotate");
                transformStateRef.current.mode = "rotate";
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium transition ${
                transformMode === "rotate" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <RotateCw size={14} />
              Rotate
            </button>
            <button
              onClick={() => {
                setTransformMode("scale");
                transformStateRef.current.mode = "scale";
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium transition ${
                transformMode === "scale" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <ZoomIn size={14} />
              Scale
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Space</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTransformSpace("world");
                transformStateRef.current.space = "world";
              }}
              className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${
                transformSpace === "world" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              World
            </button>
            <button
              onClick={() => {
                setTransformSpace("local");
                transformStateRef.current.space = "local";
              }}
              className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${
                transformSpace === "local" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Local
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Options</label>
          <div className="space-y-1">
            <button
              onClick={() => setGridSnap(!gridSnap)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition ${
                gridSnap ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <Grid3x3 size={14} />
                Grid Snap
              </span>
              {gridSnap ? <span className="text-xs">ON</span> : <span className="text-xs">OFF</span>}
            </button>

            <button
              onClick={() => setConstrainAxis(!constrainAxis)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition ${
                constrainAxis ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">{constrainAxis ? <Lock size={14} /> : <Unlock size={14} />}Constrain</span>
              {constrainAxis ? <span className="text-xs">ON</span> : <span className="text-xs">OFF</span>}
            </button>

            <button
              onClick={() => setShowGizmo(!showGizmo)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition ${
                showGizmo ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">{showGizmo ? <Eye size={14} /> : <EyeOff size={14} />}Gizmo</span>
              {showGizmo ? <span className="text-xs">ON</span> : <span className="text-xs">OFF</span>}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10">
          <p className="text-xs font-semibold text-slate-400 mb-2">Actions</p>
          <div className="flex gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700"
              onClick={() => {
                const component = getSelectedComponent();
                if (!component) return;
                const duplicated: BuildingComponent = {
                  ...component,
                  id: `${component.id}-copy-${Date.now()}`,
                  position: { x: component.position.x + gridSize, y: component.position.y, z: component.position.z },
                };
                building.addExteriorComponent(duplicated);
                onComponentDuplicated?.(duplicated);
              }}
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-xs font-medium bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/20"
              onClick={() => {
                if (!selectedComponentId) return;
                building.exteriorComponents.removeComponent(selectedComponentId);
                onComponentDeleted?.(selectedComponentId);
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>

        {selectedComponentId ? (
          <div className="pt-2 border-t border-white/10 text-xs text-slate-400">
            <p>
              <span className="font-mono">{transformMode.toUpperCase()}</span> • <span className="font-mono">{transformSpace.toUpperCase()}</span>
            </p>
            <p className="mt-1 truncate">Selected: <span className="font-mono text-slate-200">{selectedComponentId}</span></p>
          </div>
        ) : (
          <div className="pt-2 border-t border-white/10 text-xs text-slate-400">Select an exterior component to transform.</div>
        )}
      </div>
    );
  }
);

BuildingEditorControls.displayName = "BuildingEditorControls";

export default BuildingEditorControls;


