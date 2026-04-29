/**
 * Building System
 *
 * Modular building system for creating customizable buildings with:
 * - Floors and levels
 * - Windows and doors
 * - Exterior customization (signs, awnings, billboards)
 * - Interior customization (furniture, stairs)
 * - Scaling and resizing
 * - Component placement
 *
 * Architecture:
 * - Building class manages structure
 * - Floor class manages individual floors
 * - Component system for modular parts
 */

// ============================================================================
// Types
// ============================================================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BuildingConfig {
  id: string;
  name: string;
  type: "house" | "apartment" | "storefront" | "warehouse" | "office";
  width: number;
  depth: number;
  floorHeight: number;
  numberOfFloors: number;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface FloorConfig {
  id: string;
  buildingId: string;
  floorNumber: number;
  height: number;
  position: Vector3;
  components: BuildingComponent[];
}

export interface BuildingComponent {
  id: string;
  type: "window" | "door" | "wall" | "furniture" | "stairs" | "sign" | "billboard" | "awning";
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  modelUrl: string;
  metadata?: Record<string, any>;
}

export interface WindowConfig extends BuildingComponent {
  type: "window";
  width: number;
  height: number;
  windowType: "single" | "double" | "triple" | "arched";
  material: "glass" | "frosted" | "tinted";
}

export interface DoorConfig extends BuildingComponent {
  type: "door";
  width: number;
  height: number;
  doorType: "single" | "double" | "sliding" | "revolving";
  material: "wood" | "metal" | "glass";
}

export interface SignConfig extends BuildingComponent {
  type: "sign";
  text: string;
  signType: "neon" | "led" | "traditional" | "billboard";
  color: string;
  glowIntensity: number;
}

export interface AwningConfig extends BuildingComponent {
  type: "awning";
  width: number;
  depth: number;
  color: string;
  material: "fabric" | "metal" | "canvas";
}

export interface FurnitureConfig extends BuildingComponent {
  type: "furniture";
  furnitureType: "chair" | "table" | "sofa" | "bed" | "desk" | "counter" | "shelf";
  material: "wood" | "metal" | "fabric" | "glass";
}

export interface StairsConfig extends BuildingComponent {
  type: "stairs";
  stairType: "straight" | "spiral" | "curved" | "ladder";
  steps: number;
  material: "wood" | "metal" | "concrete";
}

// ============================================================================
// Building Component Class
// ============================================================================

export class BuildingComponentManager {
  private components: Map<string, BuildingComponent> = new Map();

  /**
   * Add a component to the building
   */
  addComponent(component: BuildingComponent): void {
    this.components.set(component.id, component);
    console.log(`[Building] Added component: ${component.type} (${component.id})`);
  }

  /**
   * Remove a component
   */
  removeComponent(componentId: string): boolean {
    const removed = this.components.delete(componentId);
    if (removed) {
      console.log(`[Building] Removed component: ${componentId}`);
    }
    return removed;
  }

  /**
   * Update a component
   */
  updateComponent(componentId: string, updates: Partial<BuildingComponent>): boolean {
    const component = this.components.get(componentId);
    if (!component) return false;

    Object.assign(component, updates);
    console.log(`[Building] Updated component: ${componentId}`);
    return true;
  }

  /**
   * Get a component
   */
  getComponent(componentId: string): BuildingComponent | undefined {
    return this.components.get(componentId);
  }

  /**
   * Get all components of a type
   */
  getComponentsByType(type: BuildingComponent["type"]): BuildingComponent[] {
    return Array.from(this.components.values()).filter((c) => c.type === type);
  }

  /**
   * Get all components
   */
  getAllComponents(): BuildingComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Clear all components
   */
  clear(): void {
    this.components.clear();
    console.log("[Building] Cleared all components");
  }

  /**
   * Get component count
   */
  getComponentCount(): number {
    return this.components.size;
  }
}

// ============================================================================
// Floor Class
// ============================================================================

export class Floor {
  id: string;
  buildingId: string;
  floorNumber: number;
  height: number;
  position: Vector3;
  components: BuildingComponentManager;

  constructor(config: FloorConfig) {
    this.id = config.id;
    this.buildingId = config.buildingId;
    this.floorNumber = config.floorNumber;
    this.height = config.height;
    this.position = config.position;
    this.components = new BuildingComponentManager();

    // Add initial components
    if (config.components) {
      config.components.forEach((comp) => this.components.addComponent(comp));
    }
  }

  /**
   * Add window to floor
   */
  addWindow(window: WindowConfig): void {
    this.components.addComponent(window);
  }

  /**
   * Add door to floor
   */
  addDoor(door: DoorConfig): void {
    this.components.addComponent(door);
  }

  /**
   * Add furniture to floor
   */
  addFurniture(furniture: FurnitureConfig): void {
    this.components.addComponent(furniture);
  }

  /**
   * Add stairs to floor
   */
  addStairs(stairs: StairsConfig): void {
    this.components.addComponent(stairs);
  }

  /**
   * Get all windows on floor
   */
  getWindows(): WindowConfig[] {
    return this.components.getComponentsByType("window") as WindowConfig[];
  }

  /**
   * Get all doors on floor
   */
  getDoors(): DoorConfig[] {
    return this.components.getComponentsByType("door") as DoorConfig[];
  }

  /**
   * Get all furniture on floor
   */
  getFurniture(): FurnitureConfig[] {
    return this.components.getComponentsByType("furniture") as FurnitureConfig[];
  }

  /**
   * Get all stairs on floor
   */
  getStairs(): StairsConfig[] {
    return this.components.getComponentsByType("stairs") as StairsConfig[];
  }

  /**
   * Export floor data
   */
  export(): FloorConfig {
    return {
      id: this.id,
      buildingId: this.buildingId,
      floorNumber: this.floorNumber,
      height: this.height,
      position: this.position,
      components: this.components.getAllComponents(),
    };
  }
}

// ============================================================================
// Building Class
// ============================================================================

export class Building {
  id: string;
  name: string;
  type: BuildingConfig["type"];
  width: number;
  depth: number;
  floorHeight: number;
  numberOfFloors: number;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  floors: Map<number, Floor> = new Map();
  exteriorComponents: BuildingComponentManager;

  constructor(config: BuildingConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.width = config.width;
    this.depth = config.depth;
    this.floorHeight = config.floorHeight;
    this.numberOfFloors = config.numberOfFloors;
    this.position = config.position;
    this.rotation = config.rotation;
    this.scale = config.scale;
    this.exteriorComponents = new BuildingComponentManager();

    // Initialize floors
    this.initializeFloors();
  }

  /**
   * Initialize building floors
   */
  private initializeFloors(): void {
    for (let i = 0; i < this.numberOfFloors; i++) {
      const floorNumber = i + 1;
      const floorHeight = this.position.y + i * this.floorHeight;

      const floor = new Floor({
        id: `${this.id}-floor-${floorNumber}`,
        buildingId: this.id,
        floorNumber,
        height: this.floorHeight,
        position: { x: this.position.x, y: floorHeight, z: this.position.z },
        components: [],
      });

      this.floors.set(floorNumber, floor);
    }

    console.log(`[Building] Initialized ${this.numberOfFloors} floors`);
  }

  /**
   * Get floor by number
   */
  getFloor(floorNumber: number): Floor | undefined {
    return this.floors.get(floorNumber);
  }

  /**
   * Add floor to building
   */
  addFloor(): Floor {
    const newFloorNumber = this.numberOfFloors + 1;
    const floorHeight = this.position.y + (newFloorNumber - 1) * this.floorHeight;

    const floor = new Floor({
      id: `${this.id}-floor-${newFloorNumber}`,
      buildingId: this.id,
      floorNumber: newFloorNumber,
      height: this.floorHeight,
      position: { x: this.position.x, y: floorHeight, z: this.position.z },
      components: [],
    });

    this.floors.set(newFloorNumber, floor);
    this.numberOfFloors++;

    console.log(`[Building] Added floor ${newFloorNumber}`);
    return floor;
  }

  /**
   * Remove floor from building
   */
  removeFloor(floorNumber: number): boolean {
    if (floorNumber === 1 || this.numberOfFloors <= 1) {
      console.warn("[Building] Cannot remove ground floor or last floor");
      return false;
    }

    const removed = this.floors.delete(floorNumber);
    if (removed) {
      this.numberOfFloors--;
      console.log(`[Building] Removed floor ${floorNumber}`);
    }
    return removed;
  }

  /**
   * Add exterior component (sign, billboard, awning)
   */
  addExteriorComponent(component: BuildingComponent): void {
    this.exteriorComponents.addComponent(component);
  }

  /**
   * Add sign to building exterior
   */
  addSign(sign: SignConfig): void {
    this.exteriorComponents.addComponent(sign);
  }

  /**
   * Add billboard to building exterior
   */
  addBillboard(billboard: SignConfig): void {
    billboard.signType = "billboard";
    this.exteriorComponents.addComponent(billboard);
  }

  /**
   * Add awning to building exterior
   */
  addAwning(awning: AwningConfig): void {
    this.exteriorComponents.addComponent(awning);
  }

  /**
   * Scale building width
   */
  scaleWidth(factor: number): void {
    this.width *= factor;
    this.scale.x *= factor;
    console.log(`[Building] Scaled width by ${factor}x (new width: ${this.width})`);
  }

  /**
   * Scale building height
   */
  scaleHeight(factor: number): void {
    this.floorHeight *= factor;
    this.scale.y *= factor;
    console.log(`[Building] Scaled height by ${factor}x (new height: ${this.floorHeight})`);
  }

  /**
   * Scale building depth
   */
  scaleDepth(factor: number): void {
    this.depth *= factor;
    this.scale.z *= factor;
    console.log(`[Building] Scaled depth by ${factor}x (new depth: ${this.depth})`);
  }

  /**
   * Get total building height
   */
  getTotalHeight(): number {
    return this.numberOfFloors * this.floorHeight;
  }

  /**
   * Get all exterior components
   */
  getExteriorComponents(): BuildingComponent[] {
    return this.exteriorComponents.getAllComponents();
  }

  /**
   * Get all signs
   */
  getSigns(): SignConfig[] {
    return this.exteriorComponents.getComponentsByType("sign") as SignConfig[];
  }

  /**
   * Get all awnings
   */
  getAwnings(): AwningConfig[] {
    return this.exteriorComponents.getComponentsByType("awning") as AwningConfig[];
  }

  /**
   * Get all floors
   */
  getAllFloors(): Floor[] {
    return Array.from(this.floors.values()).sort((a, b) => a.floorNumber - b.floorNumber);
  }

  /**
   * Get total component count
   */
  getTotalComponentCount(): number {
    let total = this.exteriorComponents.getComponentCount();
    this.floors.forEach((floor) => {
      total += floor.components.getComponentCount();
    });
    return total;
  }

  /**
   * Export building data
   */
  export(): BuildingConfig & { floors: FloorConfig[]; exteriorComponents: BuildingComponent[] } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      width: this.width,
      depth: this.depth,
      floorHeight: this.floorHeight,
      numberOfFloors: this.numberOfFloors,
      position: this.position,
      rotation: this.rotation,
      scale: this.scale,
      floors: this.getAllFloors().map((f) => f.export()),
      exteriorComponents: this.getExteriorComponents(),
    };
  }

  /**
   * Import building data
   */
  static import(data: BuildingConfig & { floors: FloorConfig[]; exteriorComponents: BuildingComponent[] }): Building {
    const building = new Building(data);

    // Import exterior components
    data.exteriorComponents.forEach((comp) => {
      building.addExteriorComponent(comp);
    });

    // Import floors
    data.floors.forEach((floorData) => {
      const floor = building.getFloor(floorData.floorNumber);
      if (floor) {
        floorData.components.forEach((comp) => {
          floor.components.addComponent(comp);
        });
      }
    });

    return building;
  }
}

// ============================================================================
// Building Factory
// ============================================================================

export class BuildingFactory {
  /**
   * Create a simple house
   */
  static createSimpleHouse(id: string, position: Vector3): Building {
    return new Building({
      id,
      name: "Simple House",
      type: "house",
      width: 4,
      depth: 6,
      floorHeight: 3,
      numberOfFloors: 1,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }

  /**
   * Create an apartment building
   */
  static createApartmentBuilding(id: string, position: Vector3, floors: number = 3): Building {
    return new Building({
      id,
      name: "Apartment Building",
      type: "apartment",
      width: 6,
      depth: 8,
      floorHeight: 3,
      numberOfFloors: floors,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }

  /**
   * Create a storefront
   */
  static createStorefront(id: string, position: Vector3): Building {
    const building = new Building({
      id,
      name: "Store Front",
      type: "storefront",
      width: 5,
      depth: 4,
      floorHeight: 4,
      numberOfFloors: 1,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });

    // Add storefront features
    const frontFloor = building.getFloor(1);
    if (frontFloor) {
      // Add large windows
      frontFloor.addWindow({
        id: `${id}-window-1`,
        type: "window",
        position: { x: -1, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1.5, z: 0.1 },
        modelUrl: "/models/components/window-large.glb",
        width: 1.5,
        height: 2,
        windowType: "double",
        material: "glass",
      });

      // Add door
      frontFloor.addDoor({
        id: `${id}-door-1`,
        type: "door",
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 0.1 },
        modelUrl: "/models/components/door-glass.glb",
        width: 1,
        height: 2.5,
        // Note: Keeping config fields as provided (even if modelUrl doesn't exist yet).
        doorType: "single",
        material: "glass",
      });
    }

    return building;
  }

  /**
   * Create a warehouse
   */
  static createWarehouse(id: string, position: Vector3): Building {
    return new Building({
      id,
      name: "Warehouse",
      type: "warehouse",
      width: 10,
      depth: 15,
      floorHeight: 5,
      numberOfFloors: 1,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }

  /**
   * Create an office building
   */
  static createOfficeBuilding(id: string, position: Vector3, floors: number = 5): Building {
    return new Building({
      id,
      name: "Office Building",
      type: "office",
      width: 5,
      depth: 5,
      floorHeight: 3,
      numberOfFloors: floors,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }
}

// ============================================================================
// Building Manager
// ============================================================================

export class BuildingManager {
  private buildings: Map<string, Building> = new Map();

  /**
   * Add building to manager
   */
  addBuilding(building: Building): void {
    this.buildings.set(building.id, building);
    console.log(`[BuildingManager] Added building: ${building.name}`);
  }

  /**
   * Remove building
   */
  removeBuilding(buildingId: string): boolean {
    const removed = this.buildings.delete(buildingId);
    if (removed) {
      console.log(`[BuildingManager] Removed building: ${buildingId}`);
    }
    return removed;
  }

  /**
   * Get building
   */
  getBuilding(buildingId: string): Building | undefined {
    return this.buildings.get(buildingId);
  }

  /**
   * Get all buildings
   */
  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  /**
   * Get buildings by type
   */
  getBuildingsByType(type: BuildingConfig["type"]): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.type === type);
  }

  /**
   * Get building count
   */
  getBuildingCount(): number {
    return this.buildings.size;
  }

  /**
   * Export all buildings
   */
  exportAll(): Array<BuildingConfig & { floors: FloorConfig[]; exteriorComponents: BuildingComponent[] }> {
    return Array.from(this.buildings.values()).map((b) => b.export());
  }

  /**
   * Import buildings
   */
  importAll(data: Array<BuildingConfig & { floors: FloorConfig[]; exteriorComponents: BuildingComponent[] }>): void {
    data.forEach((buildingData) => {
      const building = Building.import(buildingData);
      this.addBuilding(building);
    });
  }

  /**
   * Clear all buildings
   */
  clear(): void {
    this.buildings.clear();
    console.log("[BuildingManager] Cleared all buildings");
  }
}




