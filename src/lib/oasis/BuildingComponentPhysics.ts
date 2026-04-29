/**
 * Building Component Physics
 *
 * Physics/validation layer for building components using Cannon (cannon-es).
 *
 * Adaptations/fixes vs the provided file:
 * - `validatePlacement()` now works for components not yet added (no dependency on `bodies.get(component.id)`).
 * - `world.step` call uses the correct cannon-es signature: `step(dt, timeSinceLastCalled?, maxSubSteps?)`.
 * - Collision checks use an AABB derived from component scale/position (and better AABB for existing bodies).
 */

import * as CANNON from "cannon-es";
import * as THREE from "three";
import type { BuildingComponent } from "@/lib/BuildingSystem";

// ============================================================================
// Types
// ============================================================================

interface PhysicsBodyData {
  componentId: string;
  body: CANNON.Body;
  shape: CANNON.Shape;
  originalPosition: CANNON.Vec3;
}

export interface PhysicsConfig {
  gravity?: number;
  timeStep?: number;
  maxSubSteps?: number;
  groundFriction?: number;
  groundRestitution?: number;
  componentFriction?: number;
  componentRestitution?: number;
  enableCollisions?: boolean;
  enableGravity?: boolean;
  groundHeight?: number;
}

export interface PlacementValidation {
  isValid: boolean;
  reason?: string;
  collisions?: string[];
  groundClearance?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function aabbForComponent(component: BuildingComponent): { min: CANNON.Vec3; max: CANNON.Vec3 } {
  const min = new CANNON.Vec3(
    component.position.x - component.scale.x / 2,
    component.position.y - component.scale.y / 2,
    component.position.z - component.scale.z / 2
  );
  const max = new CANNON.Vec3(
    component.position.x + component.scale.x / 2,
    component.position.y + component.scale.y / 2,
    component.position.z + component.scale.z / 2
  );
  return { min, max };
}

function aabbForBody(body: CANNON.Body): { min: CANNON.Vec3; max: CANNON.Vec3 } {
  // Prefer using the first shape (we only create one shape per body here).
  const shape = body.shapes[0];
  if (shape instanceof CANNON.Box) {
    const he = shape.halfExtents;
    const min = new CANNON.Vec3(body.position.x - he.x, body.position.y - he.y, body.position.z - he.z);
    const max = new CANNON.Vec3(body.position.x + he.x, body.position.y + he.y, body.position.z + he.z);
    return { min, max };
  }
  // Fallback: boundingRadius is conservative.
  const r = body.boundingRadius || 0.5;
  const min = new CANNON.Vec3(body.position.x - r, body.position.y - r, body.position.z - r);
  const max = new CANNON.Vec3(body.position.x + r, body.position.y + r, body.position.z + r);
  return { min, max };
}

function aabbIntersects(a: { min: CANNON.Vec3; max: CANNON.Vec3 }, b: { min: CANNON.Vec3; max: CANNON.Vec3 }): boolean {
  return !(
    a.max.x < b.min.x ||
    a.min.x > b.max.x ||
    a.max.y < b.min.y ||
    a.min.y > b.max.y ||
    a.max.z < b.min.z ||
    a.min.z > b.max.z
  );
}

// ============================================================================
// Physics Body Factory
// ============================================================================

class PhysicsBodyFactory {
  static createComponentBody(component: BuildingComponent, config: PhysicsConfig): CANNON.Body {
    const shape = this.createShape(component);

    const body = new CANNON.Body({
      mass: this.calculateMass(component),
      shape,
      linearDamping: 0.3,
      angularDamping: 0.3,
    });

    // Material-like tuning (cannon-es: use ContactMaterials, but these props are still accepted on Body in cannon-es)
    (body as any).friction = config.componentFriction ?? 0.4;
    (body as any).restitution = config.componentRestitution ?? 0.3;

    body.position.set(component.position.x, component.position.y, component.position.z);

    const quat = new CANNON.Quaternion();
    quat.setFromEuler(component.rotation.x, component.rotation.y, component.rotation.z);
    body.quaternion = quat;
    return body;
  }

  static createGroundBody(groundHeight: number = 0): CANNON.Body {
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape,
    });

    groundBody.position.y = groundHeight;

    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    groundBody.quaternion = quat;
    return groundBody;
  }

  private static createShape(component: BuildingComponent): CANNON.Shape {
    const halfExtents = new CANNON.Vec3(component.scale.x / 2, component.scale.y / 2, component.scale.z / 2);
    return new CANNON.Box(halfExtents);
  }

  private static calculateMass(component: BuildingComponent): number {
    const baseMass = 10;
    switch (component.type) {
      case "window":
        return baseMass * 0.5;
      case "door":
        return baseMass * 1.5;
      case "sign":
        return baseMass * 0.8;
      case "awning":
        return baseMass * 2;
      case "furniture":
        return baseMass * 1.2;
      case "stairs":
        return baseMass * 5;
      default:
        return baseMass;
    }
  }
}

// ============================================================================
// Physics World Manager
// ============================================================================

export class BuildingComponentPhysics {
  private world: CANNON.World;
  private config: Required<PhysicsConfig>;
  private bodies: Map<string, PhysicsBodyData> = new Map();
  private groundBody: CANNON.Body;
  private constraints: CANNON.Constraint[] = [];

  // For stepping with correct signature
  private lastStepTimeMs: number | null = null;

  constructor(config: PhysicsConfig = {}) {
    this.config = {
      gravity: config.gravity ?? -9.82,
      timeStep: config.timeStep ?? 1 / 60,
      maxSubSteps: config.maxSubSteps ?? 3,
      groundFriction: config.groundFriction ?? 0.4,
      groundRestitution: config.groundRestitution ?? 0.3,
      componentFriction: config.componentFriction ?? 0.4,
      componentRestitution: config.componentRestitution ?? 0.3,
      enableCollisions: config.enableCollisions ?? true,
      enableGravity: config.enableGravity ?? true,
      groundHeight: config.groundHeight ?? 0,
    };

    this.world = new CANNON.World();
    this.world.gravity.set(0, this.config.enableGravity ? this.config.gravity : 0, 0);

    this.groundBody = PhysicsBodyFactory.createGroundBody(this.config.groundHeight);
    this.world.addBody(this.groundBody);
  }

  addComponent(component: BuildingComponent): void {
    if (this.bodies.has(component.id)) return;

    const body = PhysicsBodyFactory.createComponentBody(component, this.config);
    this.world.addBody(body);

    this.bodies.set(component.id, {
      componentId: component.id,
      body,
      shape: body.shapes[0]!,
      originalPosition: body.position.clone(),
    });
  }

  removeComponent(componentId: string): void {
    const data = this.bodies.get(componentId);
    if (!data) return;
    this.world.removeBody(data.body);
    this.bodies.delete(componentId);
  }

  updateComponentFromPhysics(component: BuildingComponent): void {
    const data = this.bodies.get(component.id);
    if (!data) return;
    const body = data.body;

    component.position = { x: body.position.x, y: body.position.y, z: body.position.z };

    // cannon-es quaternion -> Euler
    const euler = new CANNON.Vec3();
    body.quaternion.toEuler(euler);
    component.rotation = { x: euler.x, y: euler.y, z: euler.z };
  }

  updatePhysicsFromComponent(component: BuildingComponent): void {
    const data = this.bodies.get(component.id);
    if (!data) return;
    const body = data.body;

    body.position.set(component.position.x, component.position.y, component.position.z);
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(component.rotation.x, component.rotation.y, component.rotation.z);
    body.quaternion = quat;

    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
  }

  /**
   * Validate component placement (ground + overlap checks).
   *
   * NOTE: This works whether or not the component has been added to the physics world.
   */
  validatePlacement(component: BuildingComponent): PlacementValidation {
    const groundClearance = component.position.y - this.config.groundHeight;
    if (groundClearance < 0) {
      return { isValid: false, reason: "Component would go below ground plane", groundClearance };
    }

    if (!this.config.enableCollisions) return { isValid: true, groundClearance };

    const collisions: string[] = [];
    const aabb = aabbForComponent(component);

    for (const [otherId, otherData] of this.bodies) {
      if (otherId === component.id) continue;
      const otherAabb = aabbForBody(otherData.body);
      if (aabbIntersects(aabb, otherAabb)) collisions.push(otherId);
    }

    if (collisions.length) {
      return { isValid: false, reason: "Component collides with other components", collisions, groundClearance };
    }

    return { isValid: true, groundClearance };
  }

  /**
   * Step physics simulation.
   */
  step(): void {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const timeSinceLast = this.lastStepTimeMs == null ? 0 : (now - this.lastStepTimeMs) / 1000;
    this.lastStepTimeMs = now;
    this.world.step(this.config.timeStep, timeSinceLast, this.config.maxSubSteps);
  }

  stepAndUpdate(components: BuildingComponent[]): void {
    this.step();
    components.forEach((component) => this.updateComponentFromPhysics(component));
  }

  getWorld(): CANNON.World {
    return this.world;
  }

  getBody(componentId: string): CANNON.Body | undefined {
    return this.bodies.get(componentId)?.body;
  }

  clear(): void {
    for (const [, data] of this.bodies) this.world.removeBody(data.body);
    this.bodies.clear();
    for (const c of this.constraints) this.world.removeConstraint(c);
    this.constraints = [];
  }

  dispose(): void {
    this.clear();
    // Clear references
    (this.world as any) = null;
  }

  getStatistics(): { bodyCount: number; constraintCount: number; gravity: number; timeStep: number } {
    return {
      bodyCount: this.bodies.size,
      constraintCount: this.constraints.length,
      gravity: this.world.gravity.y,
      timeStep: this.config.timeStep,
    };
  }
}

// ============================================================================
// Physics Visualization Helper
// ============================================================================

export class PhysicsDebugRenderer {
  static createDebugMesh(body: CANNON.Body): THREE.Mesh {
    const shape = body.shapes[0];
    let geometry: THREE.BufferGeometry;

    if (shape instanceof CANNON.Box) {
      const box = shape;
      geometry = new THREE.BoxGeometry(box.halfExtents.x * 2, box.halfExtents.y * 2, box.halfExtents.z * 2);
    } else if (shape instanceof CANNON.Sphere) {
      geometry = new THREE.SphereGeometry(shape.radius, 16, 16);
    } else if (shape instanceof CANNON.Cylinder) {
      geometry = new THREE.CylinderGeometry(shape.radiusTop, shape.radiusBottom, shape.height, 16);
    } else {
      geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(body.position as any);
    mesh.quaternion.copy(body.quaternion as any);
    return mesh;
  }

  static updateDebugMesh(mesh: THREE.Mesh, body: CANNON.Body): void {
    mesh.position.copy(body.position as any);
    mesh.quaternion.copy(body.quaternion as any);
  }
}

export default BuildingComponentPhysics;


