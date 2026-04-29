/**
 * Building Factory Module
 *
 * Factory pattern implementation for creating pre-configured buildings with:
 * - Default structures
 * - Pre-configured components
 * - Customizable templates
 * - Building templates for common types
 * - Component presets
 *
 * NOTE: This file is adapted to the existing `BuildingSystem` in this repo:
 * - `BuildingConfig["type"]` is one of: house | apartment | storefront | office | warehouse
 * - Extra per-component fields (doorType/windowType/etc) are stored under `metadata`
 */

import { Building, type BuildingComponent, type BuildingConfig } from "@/lib/BuildingSystem";

// ============================================================================
// Types
// ============================================================================

export interface BuildingTemplate {
  id: string;
  name: string;
  description: string;
  category: "residential" | "commercial" | "utility" | "landmark";
  type: BuildingConfig["type"];
  width: number;
  depth: number;
  floorHeight: number;
  numberOfFloors: number;
  defaultComponents: BuildingComponent[];
  defaultExteriorComponents: BuildingComponent[];
  price: number;
  currency: "TROO_POO" | "TROO_COIN";
  thumbnail?: string;
  tags: string[];
}

export interface ComponentPreset {
  id: string;
  name: string;
  type: BuildingComponent["type"];
  category: string;
  scale: { x: number; y: number; z: number };
  material?: string;
  properties?: Record<string, any>;
  price: number;
  currency: "TROO_POO" | "TROO_COIN";
}

type V3 = { x: number; y: number; z: number };

function baseComponent(input: {
  id: string;
  type: BuildingComponent["type"];
  position: V3;
  rotation?: V3;
  scale: V3;
  modelUrl: string;
  metadata?: Record<string, any>;
}): BuildingComponent {
  return {
    id: input.id,
    type: input.type,
    position: input.position,
    rotation: input.rotation ?? { x: 0, y: 0, z: 0 },
    scale: input.scale,
    modelUrl: input.modelUrl,
    metadata: input.metadata,
  };
}

function addComponentToAllFloors(building: Building, component: BuildingComponent) {
  for (const floor of building.getAllFloors()) {
    floor.components.addComponent({
      ...component,
      id: `${component.id}-floor-${floor.floorNumber}`,
    });
  }
}

// ============================================================================
// Building Templates
// ============================================================================

const BUILDING_TEMPLATES: Map<string, BuildingTemplate> = new Map([
  [
    "residential_house",
    {
      id: "residential_house",
      name: "House",
      description: "Single-family residential house with 2 floors",
      category: "residential",
      type: "house",
      width: 8,
      depth: 10,
      floorHeight: 3,
      numberOfFloors: 2,
      defaultComponents: [
        baseComponent({
          id: "door-entry-1",
          type: "door",
          position: { x: -3, y: 0, z: 5 },
          scale: { x: 1, y: 2, z: 0.1 },
          modelUrl: "/models/door-wood.glb",
          metadata: { doorType: "single", material: "wood" },
        }),
        baseComponent({
          id: "window-1-1",
          type: "window",
          position: { x: -2, y: 1.5, z: 5 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
        baseComponent({
          id: "window-1-2",
          type: "window",
          position: { x: 2, y: 1.5, z: 5 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
        baseComponent({
          id: "furniture-sofa-1",
          type: "furniture",
          position: { x: 0, y: 0.5, z: 0 },
          scale: { x: 2, y: 0.8, z: 1 },
          modelUrl: "/models/sofa.glb",
          metadata: { furnitureType: "sofa", material: "furniture_fabric" },
        }),
        baseComponent({
          id: "furniture-table-1",
          type: "furniture",
          position: { x: 0, y: 0.7, z: -2 },
          scale: { x: 1, y: 0.7, z: 1 },
          modelUrl: "/models/table.glb",
          metadata: { furnitureType: "table", material: "furniture_wood" },
        }),
      ],
      defaultExteriorComponents: [
        baseComponent({
          id: "sign-house-1",
          type: "sign",
          position: { x: -3.5, y: 2, z: 5.2 },
          scale: { x: 1, y: 0.5, z: 0.1 },
          modelUrl: "/models/sign-traditional.glb",
          metadata: { signType: "traditional", text: "Home", color: "#333333", glowIntensity: 0 },
        }),
        baseComponent({
          id: "awning-entry-1",
          type: "awning",
          position: { x: -3, y: 2.5, z: 5.2 },
          scale: { x: 2, y: 0.3, z: 1 },
          modelUrl: "/models/awning-fabric.glb",
          metadata: { awningType: "fabric", material: "red", width: 2, depth: 1 },
        }),
      ],
      price: 5000,
      currency: "TROO_POO",
      tags: ["residential", "house", "family", "beginner"],
    },
  ],
  [
    "residential_apartment",
    {
      id: "residential_apartment",
      name: "Apartment Building",
      description: "Multi-unit apartment building with 4 floors",
      category: "residential",
      type: "apartment",
      width: 12,
      depth: 15,
      floorHeight: 3,
      numberOfFloors: 4,
      defaultComponents: [
        baseComponent({
          id: "door-unit-1-1",
          type: "door",
          position: { x: -4, y: 0, z: 0 },
          scale: { x: 1, y: 2, z: 0.1 },
          modelUrl: "/models/door-wood.glb",
          metadata: { doorType: "single", material: "wood" },
        }),
        baseComponent({
          id: "door-unit-1-2",
          type: "door",
          position: { x: 4, y: 0, z: 0 },
          scale: { x: 1, y: 2, z: 0.1 },
          modelUrl: "/models/door-wood.glb",
          metadata: { doorType: "single", material: "wood" },
        }),
        baseComponent({
          id: "window-apt-1-1",
          type: "window",
          position: { x: -4, y: 1.5, z: -7 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
        baseComponent({
          id: "window-apt-1-2",
          type: "window",
          position: { x: 4, y: 1.5, z: -7 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
        baseComponent({
          id: "stairs-apt-1",
          type: "stairs",
          position: { x: 0, y: 0, z: 5 },
          scale: { x: 1, y: 1, z: 2 },
          modelUrl: "/models/stairs-straight.glb",
          metadata: { stairsType: "straight", steps: 12 },
        }),
      ],
      defaultExteriorComponents: [
        baseComponent({
          id: "sign-apt-1",
          type: "sign",
          position: { x: -5.5, y: 3, z: -7.5 },
          scale: { x: 2, y: 1, z: 0.1 },
          modelUrl: "/models/sign-led.glb",
          metadata: { signType: "led", text: "Apartments", color: "#ff0000", glowIntensity: 1.2 },
        }),
      ],
      price: 12000,
      currency: "TROO_POO",
      tags: ["residential", "apartment", "multi-unit", "intermediate"],
    },
  ],
  [
    "commercial_storefront",
    {
      id: "commercial_storefront",
      name: "Storefront",
      description: "Commercial storefront with display windows",
      category: "commercial",
      type: "storefront",
      width: 6,
      depth: 8,
      floorHeight: 3.5,
      numberOfFloors: 1,
      defaultComponents: [
        baseComponent({
          id: "counter-1",
          type: "furniture",
          position: { x: 0, y: 0.5, z: -3 },
          scale: { x: 2, y: 1, z: 0.6 },
          modelUrl: "/models/counter.glb",
          metadata: { furnitureType: "counter", material: "furniture_wood" },
        }),
        baseComponent({
          id: "shelf-1",
          type: "furniture",
          position: { x: -2, y: 1, z: -2 },
          scale: { x: 1, y: 1.5, z: 0.3 },
          modelUrl: "/models/shelf.glb",
          metadata: { furnitureType: "shelf", material: "furniture_wood" },
        }),
        baseComponent({
          id: "shelf-2",
          type: "furniture",
          position: { x: 2, y: 1, z: -2 },
          scale: { x: 1, y: 1.5, z: 0.3 },
          modelUrl: "/models/shelf.glb",
          metadata: { furnitureType: "shelf", material: "furniture_wood" },
        }),
      ],
      defaultExteriorComponents: [
        baseComponent({
          id: "window-display-1",
          type: "window",
          position: { x: -2, y: 1.5, z: 4 },
          scale: { x: 1.5, y: 2, z: 0.1 },
          modelUrl: "/models/window-display.glb",
          metadata: { windowType: "display", material: "glass_clear" },
        }),
        baseComponent({
          id: "window-display-2",
          type: "window",
          position: { x: 2, y: 1.5, z: 4 },
          scale: { x: 1.5, y: 2, z: 0.1 },
          modelUrl: "/models/window-display.glb",
          metadata: { windowType: "display", material: "glass_clear" },
        }),
        baseComponent({
          id: "door-entry-store",
          type: "door",
          position: { x: 0, y: 0, z: 4 },
          scale: { x: 1.2, y: 2.2, z: 0.1 },
          modelUrl: "/models/door-glass.glb",
          metadata: { doorType: "glass", material: "door_glass" },
        }),
        baseComponent({
          id: "sign-neon-store",
          type: "sign",
          position: { x: 0, y: 3, z: 4.2 },
          scale: { x: 2, y: 0.8, z: 0.1 },
          modelUrl: "/models/sign-neon.glb",
          metadata: { signType: "neon", text: "Store", color: "#00ffff", glowIntensity: 1.5 },
        }),
        baseComponent({
          id: "awning-store",
          type: "awning",
          position: { x: 0, y: 3.5, z: 4.2 },
          scale: { x: 3, y: 0.3, z: 1 },
          modelUrl: "/models/awning-fabric.glb",
          metadata: { awningType: "fabric", material: "blue", width: 3, depth: 1 },
        }),
        baseComponent({
          id: "billboard-store",
          type: "sign",
          position: { x: -3.5, y: 2, z: 4.2 },
          scale: { x: 1.5, y: 1.5, z: 0.1 },
          modelUrl: "/models/billboard.glb",
          metadata: { signType: "billboard", text: "Welcome!", color: "#ffff00", glowIntensity: 0.8 },
        }),
      ],
      price: 8000,
      currency: "TROO_POO",
      tags: ["commercial", "storefront", "retail", "intermediate"],
    },
  ],
  [
    "commercial_office",
    {
      id: "commercial_office",
      name: "Office Building",
      description: "Modern office building with 5 floors",
      category: "commercial",
      type: "office",
      width: 10,
      depth: 12,
      floorHeight: 3.2,
      numberOfFloors: 5,
      defaultComponents: [
        baseComponent({
          id: "desk-office-1",
          type: "furniture",
          position: { x: -3, y: 0.7, z: 0 },
          scale: { x: 1.5, y: 0.7, z: 0.7 },
          modelUrl: "/models/desk.glb",
          metadata: { furnitureType: "desk", material: "furniture_wood" },
        }),
        baseComponent({
          id: "desk-office-2",
          type: "furniture",
          position: { x: 0, y: 0.7, z: 0 },
          scale: { x: 1.5, y: 0.7, z: 0.7 },
          modelUrl: "/models/desk.glb",
          metadata: { furnitureType: "desk", material: "furniture_wood" },
        }),
        baseComponent({
          id: "desk-office-3",
          type: "furniture",
          position: { x: 3, y: 0.7, z: 0 },
          scale: { x: 1.5, y: 0.7, z: 0.7 },
          modelUrl: "/models/desk.glb",
          metadata: { furnitureType: "desk", material: "furniture_wood" },
        }),
        baseComponent({
          id: "chair-office-1",
          type: "furniture",
          position: { x: -3, y: 0.5, z: 1 },
          scale: { x: 0.5, y: 0.8, z: 0.5 },
          modelUrl: "/models/chair.glb",
          metadata: { furnitureType: "chair", material: "furniture_fabric" },
        }),
        baseComponent({
          id: "chair-office-2",
          type: "furniture",
          position: { x: 0, y: 0.5, z: 1 },
          scale: { x: 0.5, y: 0.8, z: 0.5 },
          modelUrl: "/models/chair.glb",
          metadata: { furnitureType: "chair", material: "furniture_fabric" },
        }),
        baseComponent({
          id: "chair-office-3",
          type: "furniture",
          position: { x: 3, y: 0.5, z: 1 },
          scale: { x: 0.5, y: 0.8, z: 0.5 },
          modelUrl: "/models/chair.glb",
          metadata: { furnitureType: "chair", material: "furniture_fabric" },
        }),
        baseComponent({
          id: "stairs-office",
          type: "stairs",
          position: { x: -4.5, y: 0, z: -5 },
          scale: { x: 1, y: 1, z: 2 },
          modelUrl: "/models/stairs-straight.glb",
          metadata: { stairsType: "straight", steps: 16 },
        }),
      ],
      defaultExteriorComponents: [
        baseComponent({
          id: "sign-office-led",
          type: "sign",
          position: { x: 0, y: 6, z: -6 },
          scale: { x: 3, y: 1.2, z: 0.1 },
          modelUrl: "/models/sign-led.glb",
          metadata: { signType: "led", text: "Office Complex", color: "#0000ff", glowIntensity: 1.2 },
        }),
        baseComponent({
          id: "window-office-1",
          type: "window",
          position: { x: -4, y: 1.5, z: -6 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
        baseComponent({
          id: "window-office-2",
          type: "window",
          position: { x: 0, y: 1.5, z: -6 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
        baseComponent({
          id: "window-office-3",
          type: "window",
          position: { x: 4, y: 1.5, z: -6 },
          scale: { x: 1, y: 1, z: 0.1 },
          modelUrl: "/models/window-double.glb",
          metadata: { windowType: "double", material: "glass_clear" },
        }),
      ],
      price: 20000,
      currency: "TROO_COIN",
      tags: ["commercial", "office", "corporate", "advanced"],
    },
  ],
  [
    "commercial_warehouse",
    {
      id: "commercial_warehouse",
      name: "Warehouse",
      description: "Large industrial warehouse with minimal interior",
      category: "commercial",
      type: "warehouse",
      width: 20,
      depth: 30,
      floorHeight: 4,
      numberOfFloors: 1,
      defaultComponents: [
        baseComponent({
          id: "shelf-warehouse-1",
          type: "furniture",
          position: { x: -8, y: 1, z: -10 },
          scale: { x: 2, y: 2, z: 0.5 },
          modelUrl: "/models/shelf.glb",
          metadata: { furnitureType: "shelf", material: "furniture_metal" },
        }),
        baseComponent({
          id: "shelf-warehouse-2",
          type: "furniture",
          position: { x: -8, y: 1, z: 0 },
          scale: { x: 2, y: 2, z: 0.5 },
          modelUrl: "/models/shelf.glb",
          metadata: { furnitureType: "shelf", material: "furniture_metal" },
        }),
        baseComponent({
          id: "shelf-warehouse-3",
          type: "furniture",
          position: { x: -8, y: 1, z: 10 },
          scale: { x: 2, y: 2, z: 0.5 },
          modelUrl: "/models/shelf.glb",
          metadata: { furnitureType: "shelf", material: "furniture_metal" },
        }),
      ],
      defaultExteriorComponents: [
        baseComponent({
          id: "sign-warehouse",
          type: "sign",
          position: { x: 0, y: 3, z: 15.2 },
          scale: { x: 3, y: 1, z: 0.1 },
          modelUrl: "/models/sign-traditional.glb",
          metadata: { signType: "traditional", text: "Warehouse", color: "#333333", glowIntensity: 0 },
        }),
        baseComponent({
          id: "door-warehouse",
          type: "door",
          position: { x: 0, y: 0, z: 15 },
          scale: { x: 2, y: 3, z: 0.1 },
          modelUrl: "/models/door-metal.glb",
          metadata: { doorType: "metal", material: "door_metal" },
        }),
      ],
      price: 15000,
      currency: "TROO_COIN",
      tags: ["commercial", "warehouse", "industrial", "advanced"],
    },
  ],
]);

// ============================================================================
// Component Presets
// ============================================================================

const COMPONENT_PRESETS: Map<string, ComponentPreset> = new Map([
  [
    "window_single",
    {
      id: "window_single",
      name: "Single Window",
      type: "window",
      category: "windows",
      scale: { x: 1, y: 1, z: 0.1 },
      material: "glass_clear",
      properties: { windowType: "single" },
      price: 100,
      currency: "TROO_POO",
    },
  ],
  [
    "window_double",
    {
      id: "window_double",
      name: "Double Window",
      type: "window",
      category: "windows",
      scale: { x: 1.5, y: 1, z: 0.1 },
      material: "glass_clear",
      properties: { windowType: "double" },
      price: 150,
      currency: "TROO_POO",
    },
  ],
  [
    "window_arched",
    {
      id: "window_arched",
      name: "Arched Window",
      type: "window",
      category: "windows",
      scale: { x: 1, y: 1.3, z: 0.1 },
      material: "glass_clear",
      properties: { windowType: "arched" },
      price: 200,
      currency: "TROO_POO",
    },
  ],
  [
    "door_single",
    {
      id: "door_single",
      name: "Single Door",
      type: "door",
      category: "doors",
      scale: { x: 1, y: 2, z: 0.1 },
      material: "door_wood",
      properties: { doorType: "single" },
      price: 200,
      currency: "TROO_POO",
    },
  ],
  [
    "door_double",
    {
      id: "door_double",
      name: "Double Door",
      type: "door",
      category: "doors",
      scale: { x: 2, y: 2, z: 0.1 },
      material: "door_wood",
      properties: { doorType: "double" },
      price: 300,
      currency: "TROO_POO",
    },
  ],
  [
    "door_glass",
    {
      id: "door_glass",
      name: "Glass Door",
      type: "door",
      category: "doors",
      scale: { x: 1, y: 2.2, z: 0.1 },
      material: "door_glass",
      properties: { doorType: "glass" },
      price: 250,
      currency: "TROO_POO",
    },
  ],
  [
    "sign_neon_small",
    {
      id: "sign_neon_small",
      name: "Neon Sign (Small)",
      type: "sign",
      category: "signs",
      scale: { x: 1, y: 0.5, z: 0.1 },
      material: "sign_neon",
      properties: { signType: "neon", glowIntensity: 1.5 },
      price: 200,
      currency: "TROO_POO",
    },
  ],
  [
    "sign_neon_large",
    {
      id: "sign_neon_large",
      name: "Neon Sign (Large)",
      type: "sign",
      category: "signs",
      scale: { x: 2, y: 1, z: 0.1 },
      material: "sign_neon",
      properties: { signType: "neon", glowIntensity: 1.5 },
      price: 400,
      currency: "TROO_POO",
    },
  ],
  [
    "sign_led",
    {
      id: "sign_led",
      name: "LED Sign",
      type: "sign",
      category: "signs",
      scale: { x: 1.5, y: 0.8, z: 0.1 },
      material: "sign_led",
      properties: { signType: "led", glowIntensity: 1.2 },
      price: 300,
      currency: "TROO_POO",
    },
  ],
  [
    "sign_traditional",
    {
      id: "sign_traditional",
      name: "Traditional Sign",
      type: "sign",
      category: "signs",
      scale: { x: 1.5, y: 0.6, z: 0.1 },
      material: "wall_wood",
      properties: { signType: "traditional", glowIntensity: 0 },
      price: 100,
      currency: "TROO_POO",
    },
  ],
  [
    "billboard",
    {
      id: "billboard",
      name: "Billboard",
      type: "sign",
      category: "signs",
      scale: { x: 3, y: 2, z: 0.1 },
      material: "sign_led",
      properties: { signType: "billboard", glowIntensity: 0.8 },
      price: 1000,
      currency: "TROO_COIN",
    },
  ],
  [
    "awning_fabric_red",
    {
      id: "awning_fabric_red",
      name: "Fabric Awning (Red)",
      type: "awning",
      category: "awnings",
      scale: { x: 2, y: 0.3, z: 1 },
      material: "wall_concrete",
      properties: { awningType: "fabric", color: "red" },
      price: 150,
      currency: "TROO_POO",
    },
  ],
  [
    "awning_fabric_blue",
    {
      id: "awning_fabric_blue",
      name: "Fabric Awning (Blue)",
      type: "awning",
      category: "awnings",
      scale: { x: 2, y: 0.3, z: 1 },
      material: "wall_concrete",
      properties: { awningType: "fabric", color: "blue" },
      price: 150,
      currency: "TROO_POO",
    },
  ],
  [
    "awning_metal",
    {
      id: "awning_metal",
      name: "Metal Awning",
      type: "awning",
      category: "awnings",
      scale: { x: 2.5, y: 0.3, z: 1 },
      material: "furniture_metal",
      properties: { awningType: "metal" },
      price: 200,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_chair",
    {
      id: "furniture_chair",
      name: "Chair",
      type: "furniture",
      category: "furniture",
      scale: { x: 0.5, y: 0.8, z: 0.5 },
      material: "furniture_fabric",
      properties: { furnitureType: "chair" },
      price: 50,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_table",
    {
      id: "furniture_table",
      name: "Table",
      type: "furniture",
      category: "furniture",
      scale: { x: 1, y: 0.7, z: 1 },
      material: "furniture_wood",
      properties: { furnitureType: "table" },
      price: 100,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_sofa",
    {
      id: "furniture_sofa",
      name: "Sofa",
      type: "furniture",
      category: "furniture",
      scale: { x: 2, y: 0.8, z: 1 },
      material: "furniture_fabric",
      properties: { furnitureType: "sofa" },
      price: 200,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_bed",
    {
      id: "furniture_bed",
      name: "Bed",
      type: "furniture",
      category: "furniture",
      scale: { x: 1.5, y: 0.5, z: 2 },
      material: "furniture_fabric",
      properties: { furnitureType: "bed" },
      price: 150,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_desk",
    {
      id: "furniture_desk",
      name: "Desk",
      type: "furniture",
      category: "furniture",
      scale: { x: 1.5, y: 0.7, z: 0.7 },
      material: "furniture_wood",
      properties: { furnitureType: "desk" },
      price: 120,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_counter",
    {
      id: "furniture_counter",
      name: "Counter",
      type: "furniture",
      category: "furniture",
      scale: { x: 2, y: 1, z: 0.6 },
      material: "furniture_wood",
      properties: { furnitureType: "counter" },
      price: 250,
      currency: "TROO_POO",
    },
  ],
  [
    "furniture_shelf",
    {
      id: "furniture_shelf",
      name: "Shelf",
      type: "furniture",
      category: "furniture",
      scale: { x: 1, y: 1.5, z: 0.3 },
      material: "furniture_wood",
      properties: { furnitureType: "shelf" },
      price: 80,
      currency: "TROO_POO",
    },
  ],
  [
    "stairs_straight",
    {
      id: "stairs_straight",
      name: "Straight Stairs",
      type: "stairs",
      category: "stairs",
      scale: { x: 1, y: 1, z: 2 },
      material: "furniture_wood",
      properties: { stairsType: "straight", steps: 12 },
      price: 300,
      currency: "TROO_POO",
    },
  ],
  [
    "stairs_spiral",
    {
      id: "stairs_spiral",
      name: "Spiral Stairs",
      type: "stairs",
      category: "stairs",
      scale: { x: 1, y: 1, z: 1.5 },
      material: "furniture_metal",
      properties: { stairsType: "spiral", steps: 12 },
      price: 400,
      currency: "TROO_POO",
    },
  ],
]);

// ============================================================================
// Building Factory
// ============================================================================

export class BuildingFactory {
  static createFromTemplate(templateId: string, buildingId: string, position: V3): Building | null {
    const template = BUILDING_TEMPLATES.get(templateId);
    if (!template) {
      console.error(`[BuildingFactory] Template not found: ${templateId}`);
      return null;
    }

    try {
      const building = new Building({
        id: buildingId,
        name: template.name,
        type: template.type,
        width: template.width,
        depth: template.depth,
        floorHeight: template.floorHeight,
        numberOfFloors: template.numberOfFloors,
        position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });

      // Apply template default components to all floors (simple default)
      template.defaultComponents.forEach((component) => addComponentToAllFloors(building, component));

      // Exterior components
      template.defaultExteriorComponents.forEach((component) => building.addExteriorComponent(component));

      return building;
    } catch (error) {
      console.error("[BuildingFactory] Failed to create building from template:", error);
      return null;
    }
  }

  static createHouse(buildingId: string, position: V3): Building {
    return this.createFromTemplate("residential_house", buildingId, position)!;
  }
  static createApartment(buildingId: string, position: V3): Building {
    return this.createFromTemplate("residential_apartment", buildingId, position)!;
  }
  static createStorefront(buildingId: string, position: V3): Building {
    return this.createFromTemplate("commercial_storefront", buildingId, position)!;
  }
  static createOffice(buildingId: string, position: V3): Building {
    return this.createFromTemplate("commercial_office", buildingId, position)!;
  }
  static createWarehouse(buildingId: string, position: V3): Building {
    return this.createFromTemplate("commercial_warehouse", buildingId, position)!;
  }

  static createCustom(
    buildingId: string,
    name: string,
    type: BuildingConfig["type"],
    width: number,
    depth: number,
    numberOfFloors: number,
    position: V3
  ): Building {
    return new Building({
      id: buildingId,
      name,
      type,
      width,
      depth,
      floorHeight: 3,
      numberOfFloors,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }

  static getAllTemplates(): BuildingTemplate[] {
    return Array.from(BUILDING_TEMPLATES.values());
  }
  static getTemplatesByCategory(category: BuildingTemplate["category"]): BuildingTemplate[] {
    return Array.from(BUILDING_TEMPLATES.values()).filter((t) => t.category === category);
  }
  static getTemplate(templateId: string): BuildingTemplate | null {
    return BUILDING_TEMPLATES.get(templateId) || null;
  }

  static getComponentPreset(presetId: string): ComponentPreset | null {
    return COMPONENT_PRESETS.get(presetId) || null;
  }
  static getAllComponentPresets(): ComponentPreset[] {
    return Array.from(COMPONENT_PRESETS.values());
  }
  static getComponentPresetsByCategory(category: string): ComponentPreset[] {
    return Array.from(COMPONENT_PRESETS.values()).filter((p) => p.category === category);
  }
  static getComponentPresetsByType(type: BuildingComponent["type"]): ComponentPreset[] {
    return Array.from(COMPONENT_PRESETS.values()).filter((p) => p.type === type);
  }

  static createComponentFromPreset(presetId: string, componentId: string, position: V3): BuildingComponent | null {
    const preset = COMPONENT_PRESETS.get(presetId);
    if (!preset) {
      console.error(`[BuildingFactory] Component preset not found: ${presetId}`);
      return null;
    }

    return baseComponent({
      id: componentId,
      type: preset.type,
      position,
      scale: preset.scale,
      modelUrl: `/models/${preset.id}.glb`,
      metadata: { ...(preset.properties ?? {}), material: preset.material },
    });
  }

  static getAllCategories(): string[] {
    const categories = new Set<string>();
    for (const t of BUILDING_TEMPLATES.values()) categories.add(t.category);
    return Array.from(categories);
  }
  static getTemplatesByTag(tag: string): BuildingTemplate[] {
    return Array.from(BUILDING_TEMPLATES.values()).filter((t) => t.tags.includes(tag));
  }
  static getTemplatesByPriceRange(minPrice: number, maxPrice: number, currency?: "TROO_POO" | "TROO_COIN"): BuildingTemplate[] {
    return Array.from(BUILDING_TEMPLATES.values()).filter((t) => {
      if (currency && t.currency !== currency) return false;
      return t.price >= minPrice && t.price <= maxPrice;
    });
  }

  static getStatistics(): {
    totalTemplates: number;
    totalComponentPresets: number;
    templatesByCategory: Record<string, number>;
    componentsByType: Record<string, number>;
    totalPrice: number;
  } {
    const templates = Array.from(BUILDING_TEMPLATES.values());
    const presets = Array.from(COMPONENT_PRESETS.values());

    const templatesByCategory: Record<string, number> = {};
    templates.forEach((t) => {
      templatesByCategory[t.category] = (templatesByCategory[t.category] || 0) + 1;
    });

    const componentsByType: Record<string, number> = {};
    presets.forEach((p) => {
      componentsByType[p.type] = (componentsByType[p.type] || 0) + 1;
    });

    const totalPrice = templates.reduce((sum, t) => sum + t.price, 0);

    return {
      totalTemplates: templates.length,
      totalComponentPresets: presets.length,
      templatesByCategory,
      componentsByType,
      totalPrice,
    };
  }
}

export default BuildingFactory;




