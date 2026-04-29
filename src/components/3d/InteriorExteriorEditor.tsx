/**
 * Interior/Exterior Editor Component
 *
 * Comprehensive building customization editor with:
 * - Exterior customization (signs, billboards, awnings)
 * - Interior customization (furniture, stairs, windows, doors)
 * - Component library browser
 * - Drag-and-drop placement
 * - Real-time preview
 * - Component management
 *
 * Features:
 * - Tab-based UI (Exterior/Interior)
 * - Component library with categories
 * - Drag-and-drop placement
 * - Component properties editor
 * - Real-time 3D updates
 * - Undo/redo support
 */

"use client";

import React, { useRef, useState } from "react";
import { Grid3x3, GripHorizontal, Palette, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, BuildingComponent, SignConfig, AwningConfig } from "@/lib/BuildingSystem";
import { BuildingComponentPhysics } from "@/lib/oasis/BuildingComponentPhysics";

// ============================================================================
// Types
// ============================================================================

interface ComponentLibraryItem {
  id: string;
  name: string;
  type: BuildingComponent["type"];
  category: string;
  icon: string;
  modelUrl: string;
  defaultScale: { x: number; y: number; z: number };
  price: number;
  currency: string;
}

interface EditorState {
  selectedComponent: BuildingComponent | null;
  hoveredComponent: string | null;
  isDragging: boolean;
  showComponentLibrary: boolean;
  editMode: "exterior" | "interior";
  selectedFloor: number;
}

// ============================================================================
// Component Library
// ============================================================================

const COMPONENT_LIBRARY: ComponentLibraryItem[] = [
  // Exterior Components
  {
    id: "sign_neon_small",
    name: "Neon Sign - Small",
    type: "sign",
    category: "Signs",
    icon: "🔆",
    modelUrl: "/models/components/sign-neon-small.glb",
    defaultScale: { x: 1, y: 0.5, z: 0.1 },
    price: 200,
    currency: "TROO_POO",
  },
  {
    id: "sign_neon_large",
    name: "Neon Sign - Large",
    type: "sign",
    category: "Signs",
    icon: "🔆",
    modelUrl: "/models/components/sign-neon-large.glb",
    defaultScale: { x: 2, y: 1, z: 0.1 },
    price: 500,
    currency: "TROO_COIN",
  },
  {
    id: "sign_led",
    name: "LED Sign",
    type: "sign",
    category: "Signs",
    icon: "📺",
    modelUrl: "/models/components/sign-led.glb",
    defaultScale: { x: 1.5, y: 0.8, z: 0.1 },
    price: 300,
    currency: "TROO_POO",
  },
  {
    id: "sign_traditional",
    name: "Traditional Sign",
    type: "sign",
    category: "Signs",
    icon: "🪧",
    modelUrl: "/models/components/sign-traditional.glb",
    defaultScale: { x: 1, y: 0.6, z: 0.1 },
    price: 100,
    currency: "TROO_POO",
  },
  {
    id: "billboard_standard",
    name: "Standard Billboard",
    type: "sign",
    category: "Billboards",
    icon: "📢",
    modelUrl: "/models/components/billboard-standard.glb",
    defaultScale: { x: 3, y: 2, z: 0.2 },
    price: 1000,
    currency: "TROO_COIN",
  },
  {
    id: "billboard_digital",
    name: "Digital Billboard",
    type: "sign",
    category: "Billboards",
    icon: "📺",
    modelUrl: "/models/components/billboard-digital.glb",
    defaultScale: { x: 3.5, y: 2.5, z: 0.2 },
    price: 2000,
    currency: "TROO_COIN",
  },
  {
    id: "awning_fabric_red",
    name: "Fabric Awning - Red",
    type: "awning",
    category: "Awnings",
    icon: "🏮",
    modelUrl: "/models/components/awning-fabric-red.glb",
    defaultScale: { x: 3, y: 0.5, z: 1 },
    price: 150,
    currency: "TROO_POO",
  },
  {
    id: "awning_fabric_blue",
    name: "Fabric Awning - Blue",
    type: "awning",
    category: "Awnings",
    icon: "🏮",
    modelUrl: "/models/components/awning-fabric-blue.glb",
    defaultScale: { x: 3, y: 0.5, z: 1 },
    price: 150,
    currency: "TROO_POO",
  },
  {
    id: "awning_metal",
    name: "Metal Awning",
    type: "awning",
    category: "Awnings",
    icon: "⛱️",
    modelUrl: "/models/components/awning-metal.glb",
    defaultScale: { x: 3, y: 0.5, z: 1 },
    price: 250,
    currency: "TROO_COIN",
  },
  {
    id: "awning_canvas",
    name: "Canvas Awning",
    type: "awning",
    category: "Awnings",
    icon: "🏮",
    modelUrl: "/models/components/awning-canvas.glb",
    defaultScale: { x: 3, y: 0.5, z: 1 },
    price: 200,
    currency: "TROO_POO",
  },
  // Interior Components
  {
    id: "window_single",
    name: "Single Window",
    type: "window",
    category: "Windows",
    icon: "🪟",
    modelUrl: "/models/components/window-single.glb",
    defaultScale: { x: 1, y: 1, z: 0.1 },
    price: 50,
    currency: "TROO_POO",
  },
  {
    id: "window_double",
    name: "Double Window",
    type: "window",
    category: "Windows",
    icon: "🪟",
    modelUrl: "/models/components/window-double.glb",
    defaultScale: { x: 1.5, y: 1, z: 0.1 },
    price: 80,
    currency: "TROO_POO",
  },
  {
    id: "window_arched",
    name: "Arched Window",
    type: "window",
    category: "Windows",
    icon: "🪟",
    modelUrl: "/models/components/window-arched.glb",
    defaultScale: { x: 1, y: 1.3, z: 0.1 },
    price: 100,
    currency: "TROO_POO",
  },
  {
    id: "door_single",
    name: "Single Door",
    type: "door",
    category: "Doors",
    icon: "🚪",
    modelUrl: "/models/components/door-single.glb",
    defaultScale: { x: 1, y: 2, z: 0.1 },
    price: 100,
    currency: "TROO_POO",
  },
  {
    id: "door_double",
    name: "Double Door",
    type: "door",
    category: "Doors",
    icon: "🚪",
    modelUrl: "/models/components/door-double.glb",
    defaultScale: { x: 1.5, y: 2, z: 0.1 },
    price: 150,
    currency: "TROO_POO",
  },
  {
    id: "door_glass",
    name: "Glass Door",
    type: "door",
    category: "Doors",
    icon: "🚪",
    modelUrl: "/models/components/door-glass.glb",
    defaultScale: { x: 1, y: 2, z: 0.1 },
    price: 120,
    currency: "TROO_POO",
  },
  {
    id: "furniture_chair",
    name: "Chair",
    type: "furniture",
    category: "Furniture",
    icon: "🪑",
    modelUrl: "/models/components/furniture-chair.glb",
    defaultScale: { x: 0.5, y: 0.8, z: 0.5 },
    price: 30,
    currency: "TROO_POO",
  },
  {
    id: "furniture_table",
    name: "Table",
    type: "furniture",
    category: "Furniture",
    icon: "🪑",
    modelUrl: "/models/components/furniture-table.glb",
    defaultScale: { x: 1, y: 0.7, z: 1 },
    price: 50,
    currency: "TROO_POO",
  },
  {
    id: "furniture_sofa",
    name: "Sofa",
    type: "furniture",
    category: "Furniture",
    icon: "🛋️",
    modelUrl: "/models/components/furniture-sofa.glb",
    defaultScale: { x: 2, y: 0.8, z: 1 },
    price: 100,
    currency: "TROO_POO",
  },
  {
    id: "furniture_bed",
    name: "Bed",
    type: "furniture",
    category: "Furniture",
    icon: "🛏️",
    modelUrl: "/models/components/furniture-bed.glb",
    defaultScale: { x: 1.5, y: 0.5, z: 2 },
    price: 150,
    currency: "TROO_COIN",
  },
  {
    id: "furniture_desk",
    name: "Desk",
    type: "furniture",
    category: "Furniture",
    icon: "🪑",
    modelUrl: "/models/components/furniture-desk.glb",
    defaultScale: { x: 1.5, y: 0.7, z: 0.7 },
    price: 80,
    currency: "TROO_POO",
  },
  {
    id: "furniture_counter",
    name: "Counter",
    type: "furniture",
    category: "Furniture",
    icon: "📦",
    modelUrl: "/models/components/furniture-counter.glb",
    defaultScale: { x: 2, y: 1, z: 0.6 },
    price: 200,
    currency: "TROO_COIN",
  },
  {
    id: "furniture_shelf",
    name: "Shelf",
    type: "furniture",
    category: "Furniture",
    icon: "📚",
    modelUrl: "/models/components/furniture-shelf.glb",
    defaultScale: { x: 1, y: 1.5, z: 0.3 },
    price: 60,
    currency: "TROO_POO",
  },
  {
    id: "stairs_straight",
    name: "Straight Stairs",
    type: "stairs",
    category: "Stairs",
    icon: "🪜",
    modelUrl: "/models/components/stairs-straight.glb",
    defaultScale: { x: 1, y: 1, z: 2 },
    price: 300,
    currency: "TROO_COIN",
  },
  {
    id: "stairs_spiral",
    name: "Spiral Stairs",
    type: "stairs",
    category: "Stairs",
    icon: "🪜",
    modelUrl: "/models/components/stairs-spiral.glb",
    defaultScale: { x: 1.5, y: 1.5, z: 1.5 },
    price: 400,
    currency: "TROO_COIN",
  },
];

function ComponentLibraryBrowser({
  onComponentSelect,
  filterType,
}: {
  onComponentSelect: (component: ComponentLibraryItem) => void;
  filterType?: BuildingComponent["type"];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(COMPONENT_LIBRARY.map((item) => item.category)));

  const filteredComponents = COMPONENT_LIBRARY.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || item.type === filterType;
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search components..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="bg-slate-800 border-cyan-500/30 text-white"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="text-xs"
        >
          All
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="text-xs"
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
        {filteredComponents.map((component) => (
          <div
            key={component.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer?.setData("component", JSON.stringify(component));
            }}
            onClick={() => onComponentSelect(component)}
            className="p-3 bg-slate-800 border border-cyan-500/30 rounded cursor-grab hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all group"
          >
            <div className="text-2xl mb-1">{component.icon}</div>
            <div className="text-xs font-semibold text-cyan-300 truncate">{component.name}</div>
            <div className="text-xs text-cyan-500/70">
              {component.price} {component.currency}
            </div>
            <GripHorizontal className="w-3 h-3 text-cyan-500/50 mt-1 opacity-0 group-hover:opacity-100" />
          </div>
        ))}
      </div>

      {filteredComponents.length === 0 && <div className="text-center py-8 text-cyan-500/50">No components found</div>}
    </div>
  );
}

function ComponentPropertiesEditor({
  component,
  onUpdate,
  onDelete,
}: {
  component: BuildingComponent;
  onUpdate: (updates: Partial<BuildingComponent>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-slate-800 rounded border border-cyan-500/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-cyan-300">{component.type.toUpperCase()}</h3>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:bg-red-500/20">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-cyan-400">Position</label>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis}>
              <label className="text-xs text-cyan-500/70">{axis.toUpperCase()}</label>
              <Input
                type="number"
                step="0.1"
                value={component.position[axis]}
                onChange={(e) =>
                  onUpdate({
                    position: {
                      ...component.position,
                      [axis]: parseFloat(e.target.value),
                    },
                  })
                }
                className="bg-slate-700 border-cyan-500/20 text-white text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-cyan-400">Rotation (degrees)</label>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis}>
              <label className="text-xs text-cyan-500/70">{axis.toUpperCase()}</label>
              <Input
                type="number"
                step="1"
                value={Math.round((component.rotation[axis] * 180) / Math.PI)}
                onChange={(e) =>
                  onUpdate({
                    rotation: {
                      ...component.rotation,
                      [axis]: (parseFloat(e.target.value) * Math.PI) / 180,
                    },
                  })
                }
                className="bg-slate-700 border-cyan-500/20 text-white text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-cyan-400">Scale</label>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis}>
              <label className="text-xs text-cyan-500/70">{axis.toUpperCase()}</label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={component.scale[axis]}
                onChange={(e) =>
                  onUpdate({
                    scale: {
                      ...component.scale,
                      [axis]: parseFloat(e.target.value),
                    },
                  })
                }
                className="bg-slate-700 border-cyan-500/20 text-white text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {component.type === "sign" && (
        <div className="space-y-2 pt-2 border-t border-cyan-500/20">
          <label className="text-xs text-cyan-400">Sign Text</label>
          <Input
            type="text"
            placeholder="Enter sign text..."
            defaultValue={(component as SignConfig).text || ""}
            onChange={(e) =>
              onUpdate({
                metadata: {
                  ...(component.metadata || {}),
                  text: e.target.value,
                },
              })
            }
            className="bg-slate-700 border-cyan-500/20 text-white text-sm"
          />

          <label className="text-xs text-cyan-400">Sign Type</label>
          <Select
            defaultValue={(component as SignConfig).signType || "neon"}
            onValueChange={(value) =>
              onUpdate({
                metadata: {
                  ...(component.metadata || {}),
                  signType: value,
                },
              })
            }
          >
            <SelectTrigger className="bg-slate-700 border-cyan-500/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-cyan-500/30">
              <SelectItem value="neon">Neon</SelectItem>
              <SelectItem value="led">LED</SelectItem>
              <SelectItem value="traditional">Traditional</SelectItem>
              <SelectItem value="billboard">Billboard</SelectItem>
            </SelectContent>
          </Select>

          <label className="text-xs text-cyan-400">Glow Intensity</label>
          <Slider
            min={0}
            max={2}
            step={0.1}
            defaultValue={[(component as SignConfig).glowIntensity || 1]}
            onValueChange={(value) =>
              onUpdate({
                metadata: {
                  ...(component.metadata || {}),
                  glowIntensity: value[0],
                },
              })
            }
            className="w-full"
          />
        </div>
      )}

      {component.type === "awning" && (
        <div className="space-y-2 pt-2 border-t border-cyan-500/20">
          <label className="text-xs text-cyan-400">Awning Material</label>
          <Select
            defaultValue={(component as AwningConfig).material || "fabric"}
            onValueChange={(value) =>
              onUpdate({
                metadata: {
                  ...(component.metadata || {}),
                  material: value,
                },
              })
            }
          >
            <SelectTrigger className="bg-slate-700 border-cyan-500/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-cyan-500/30">
              <SelectItem value="fabric">Fabric</SelectItem>
              <SelectItem value="metal">Metal</SelectItem>
              <SelectItem value="canvas">Canvas</SelectItem>
            </SelectContent>
          </Select>

          <label className="text-xs text-cyan-400">Color</label>
          <div className="flex gap-2">
            <Input
              type="color"
              defaultValue={(component as AwningConfig).color || "#FF0000"}
              onChange={(e) =>
                onUpdate({
                  metadata: {
                    ...(component.metadata || {}),
                    color: e.target.value,
                  },
                })
              }
              className="w-12 h-10 bg-slate-700 border-cyan-500/20"
            />
            <Input
              type="text"
              placeholder="#FF0000"
              defaultValue={(component as AwningConfig).color || "#FF0000"}
              onChange={(e) =>
                onUpdate({
                  metadata: {
                    ...(component.metadata || {}),
                    color: e.target.value,
                  },
                })
              }
              className="flex-1 bg-slate-700 border-cyan-500/20 text-white text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Editor Component
// ============================================================================

export function InteriorExteriorEditor({
  building,
  onComponentAdded,
  onComponentUpdated,
  onComponentRemoved,
  onSelectedComponentIdChange,
}: {
  building: Building;
  onComponentAdded?: (component: BuildingComponent) => void;
  onComponentUpdated?: (component: BuildingComponent) => void;
  onComponentRemoved?: (componentId: string) => void;
  onSelectedComponentIdChange?: (componentId: string | null) => void;
}) {
  const [state, setState] = useState<EditorState>({
    selectedComponent: null,
    hoveredComponent: null,
    isDragging: false,
    showComponentLibrary: true,
    editMode: "exterior",
    selectedFloor: 1,
  });

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef<BuildingComponentPhysics | null>(null);
  const [physicsMessage, setPhysicsMessage] = useState<string>("");

  // Lazy init physics world and seed with current components.
  if (!physicsRef.current) {
    physicsRef.current = new BuildingComponentPhysics({ enableGravity: false, enableCollisions: true, groundHeight: 0 });
    const seed = (components: BuildingComponent[]) => components.forEach((c) => physicsRef.current!.addComponent(c));
    seed(building.getExteriorComponents());
    building.getAllFloors().forEach((f) => seed(f.components.getAllComponents()));
  }

  const getDisplayComponents = () => {
    if (state.editMode === "exterior") {
      return building.getExteriorComponents();
    }
    const floor = building.getFloor(state.selectedFloor);
    return floor?.components.getAllComponents() || [];
  };

  const displayComponents = getDisplayComponents();

  const handleComponentSelect = (libraryItem: ComponentLibraryItem) => {
    const newComponent: BuildingComponent = {
      id: `${libraryItem.id}-${Date.now()}`,
      type: libraryItem.type,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: libraryItem.defaultScale,
      modelUrl: libraryItem.modelUrl,
      metadata: {
        libraryId: libraryItem.id,
        name: libraryItem.name,
      },
    };

    setState((prev) => ({
      ...prev,
      selectedComponent: newComponent,
    }));
    onSelectedComponentIdChange?.(newComponent.id);
  };

  const handleAddComponent = () => {
    if (!state.selectedComponent) return;

    // Physics validation to prevent overlaps / below-ground placements.
    const validation = physicsRef.current?.validatePlacement(state.selectedComponent);
    if (validation && !validation.isValid) {
      setPhysicsMessage(validation.reason || "Invalid placement");
      setTimeout(() => setPhysicsMessage(""), 2500);
      return;
    }

    if (state.editMode === "exterior") {
      building.addExteriorComponent(state.selectedComponent);
    } else {
      const floor = building.getFloor(state.selectedFloor);
      if (floor) floor.components.addComponent(state.selectedComponent);
    }

    physicsRef.current?.addComponent(state.selectedComponent);
    onComponentAdded?.(state.selectedComponent);

    setState((prev) => ({
      ...prev,
      selectedComponent: null,
    }));
    onSelectedComponentIdChange?.(null);
  };

  const handleUpdateComponent = (componentId: string, updates: Partial<BuildingComponent>) => {
    const component = displayComponents.find((c) => c.id === componentId);
    if (!component) return;

    const updated = { ...component, ...updates };

    if (state.editMode === "exterior") building.exteriorComponents.updateComponent(componentId, updates);
    else {
      const floor = building.getFloor(state.selectedFloor);
      if (floor) floor.components.updateComponent(componentId, updates);
    }

    // Keep physics world in sync and revalidate.
    physicsRef.current?.updatePhysicsFromComponent(updated);
    const validation = physicsRef.current?.validatePlacement(updated);
    if (validation && !validation.isValid) {
      setPhysicsMessage(validation.reason || "Invalid placement");
      setTimeout(() => setPhysicsMessage(""), 2500);
    }

    onComponentUpdated?.(updated);

    setState((prev) => ({
      ...prev,
      selectedComponent: updated,
    }));
    onSelectedComponentIdChange?.(updated.id);
  };

  const handleDeleteComponent = (componentId: string) => {
    if (state.editMode === "exterior") building.exteriorComponents.removeComponent(componentId);
    else {
      const floor = building.getFloor(state.selectedFloor);
      if (floor) floor.components.removeComponent(componentId);
    }

    physicsRef.current?.removeComponent(componentId);
    onComponentRemoved?.(componentId);

    setState((prev) => ({
      ...prev,
      selectedComponent: null,
    }));
    onSelectedComponentIdChange?.(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isDragging: true }));
  };

  const handleDragLeave = () => {
    setState((prev) => ({ ...prev, isDragging: false }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isDragging: false }));

    const componentData = e.dataTransfer.getData("component");
    if (!componentData) return;

    const libraryItem: ComponentLibraryItem = JSON.parse(componentData);
    const rect = dropZoneRef.current?.getBoundingClientRect();

    const newComponent: BuildingComponent = {
      id: `${libraryItem.id}-${Date.now()}`,
      type: libraryItem.type,
      position: {
        x: rect ? ((e.clientX - rect.left) / rect.width) * 10 - 5 : 0,
        y: 0,
        z: rect ? ((e.clientY - rect.top) / rect.height) * 10 - 5 : 0,
      },
      rotation: { x: 0, y: 0, z: 0 },
      scale: libraryItem.defaultScale,
      modelUrl: libraryItem.modelUrl,
      metadata: {
        libraryId: libraryItem.id,
        name: libraryItem.name,
      },
    };

    if (state.editMode === "exterior") building.addExteriorComponent(newComponent);
    else {
      const floor = building.getFloor(state.selectedFloor);
      if (floor) floor.components.addComponent(newComponent);
    }

    const validation = physicsRef.current?.validatePlacement(newComponent);
    if (validation && !validation.isValid) {
      setPhysicsMessage(validation.reason || "Invalid placement");
      setTimeout(() => setPhysicsMessage(""), 2500);
      return;
    }
    physicsRef.current?.addComponent(newComponent);
    onComponentAdded?.(newComponent);
    onSelectedComponentIdChange?.(newComponent.id);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border border-cyan-500/30 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/30 bg-slate-800">
        <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Building Editor
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyan-500/70">{displayComponents.length} components</span>
        </div>
      </div>

      {physicsMessage ? (
        <div className="px-4 py-2 text-xs text-amber-200 border-b border-amber-500/20 bg-amber-500/10">
          Physics validation: {physicsMessage}
        </div>
      ) : null}

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        <div className="w-80 flex flex-col border border-cyan-500/30 rounded-lg bg-slate-800 overflow-hidden">
          <div className="p-4 border-b border-cyan-500/30">
            <h3 className="font-semibold text-cyan-300 mb-2">Component Library</h3>
            <p className="text-xs text-cyan-500/70">Drag components to the canvas or click to select</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ComponentLibraryBrowser onComponentSelect={handleComponentSelect} filterType={state.editMode === "exterior" ? "sign" : undefined} />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <Tabs value={state.editMode} onValueChange={(v) => setState((p) => ({ ...p, editMode: v as "exterior" | "interior" }))} className="mb-4">
            <TabsList className="bg-slate-800 border border-cyan-500/30">
              <TabsTrigger value="exterior" className="data-[state=active]:bg-cyan-500/20">
                Exterior
              </TabsTrigger>
              <TabsTrigger value="interior" className="data-[state=active]:bg-cyan-500/20">
                Interior
              </TabsTrigger>
            </TabsList>
            <TabsContent value="exterior" />
            <TabsContent value="interior" />
          </Tabs>

          {state.editMode === "interior" && (
            <div className="mb-4 flex items-center gap-2">
              <label className="text-sm text-cyan-300">Floor:</label>
              <Select value={state.selectedFloor.toString()} onValueChange={(v) => setState((p) => ({ ...p, selectedFloor: parseInt(v) }))}>
                <SelectTrigger className="w-32 bg-slate-800 border-cyan-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-cyan-500/30">
                  {building.getAllFloors().map((floor) => (
                    <SelectItem key={floor.floorNumber} value={floor.floorNumber.toString()}>
                      Floor {floor.floorNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 border-2 border-dashed rounded-lg p-4 transition-all ${
              state.isDragging ? "border-cyan-400 bg-cyan-500/10" : "border-cyan-500/30 bg-slate-800/50"
            }`}
          >
            {displayComponents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-cyan-500/50">
                <Grid3x3 className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">Drag components here to add them</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-cyan-500/70 mb-4">
                  {state.editMode === "exterior" ? "Exterior Components" : `Floor ${state.selectedFloor} Components`}
                </p>
                <div className="space-y-2 max-h-full overflow-y-auto">
                  {displayComponents.map((component) => (
                    <div
                      key={component.id}
                      onClick={() => {
                        setState((p) => ({ ...p, selectedComponent: component }));
                        onSelectedComponentIdChange?.(component.id);
                      }}
                      onMouseEnter={() => setState((p) => ({ ...p, hoveredComponent: component.id }))}
                      onMouseLeave={() => setState((p) => ({ ...p, hoveredComponent: null }))}
                      className={`p-3 rounded border cursor-pointer transition-all ${
                        state.selectedComponent?.id === component.id
                          ? "bg-cyan-500/30 border-cyan-400"
                          : state.hoveredComponent === component.id
                            ? "bg-cyan-500/10 border-cyan-500/50"
                            : "bg-slate-700 border-cyan-500/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-cyan-300">{(component.metadata as any)?.name || component.type}</div>
                          <div className="text-xs text-cyan-500/70">ID: {component.id.slice(0, 12)}...</div>
                        </div>
                        <div className="text-xs text-cyan-500/50">{component.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 flex flex-col border border-cyan-500/30 rounded-lg bg-slate-800 overflow-hidden">
          <div className="p-4 border-b border-cyan-500/30">
            <h3 className="font-semibold text-cyan-300">Properties</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {state.selectedComponent ? (
              <ComponentPropertiesEditor
                component={state.selectedComponent}
                onUpdate={(updates) => handleUpdateComponent(state.selectedComponent!.id, updates)}
                onDelete={() => handleDeleteComponent(state.selectedComponent!.id)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-cyan-500/50">
                <p className="text-sm">Select a component to edit</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-cyan-500/30 bg-slate-800 flex items-center justify-between">
        <div className="text-xs text-cyan-500/70">{state.editMode === "exterior" ? "Exterior" : `Interior - Floor ${state.selectedFloor}`}</div>
        <Button
          onClick={handleAddComponent}
          disabled={!state.selectedComponent}
          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Component
        </Button>
      </div>
    </div>
  );
}

export default InteriorExteriorEditor;


