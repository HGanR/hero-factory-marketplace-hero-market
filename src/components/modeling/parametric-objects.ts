/**
 * Parametric 3D Object System
 * Defines object types + geometry builders for the Modeling tool.
 */

import * as THREE from "three";

export type PolyLevel = "low" | "mid" | "high";
export type ObjectType =
  | "building"
  | "bridge"
  | "lake"
  | "river"
  | "pond"
  | "chair"
  | "table"
  | "street"
  | "sidewalk"
  | "lightpost"
  | "tree"
  | "bush"
  | "custom";

export interface MaterialConfig {
  color: string;
  metalness: number;
  roughness: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export interface InteriorConfig {
  enabled: boolean;
  rooms: Room[];
  doors: Door[];
  windows: Window[];
}

export interface Room {
  id: string;
  name: string;
  position: [number, number, number];
  dimensions: [number, number, number];
  material: MaterialConfig;
}

export interface Door {
  id: string;
  position: [number, number, number];
  width: number;
  height: number;
  type: "single" | "double" | "sliding" | "glass";
  material: MaterialConfig;
}

export interface Window {
  id: string;
  position: [number, number, number];
  width: number;
  height: number;
  type: "single" | "double" | "bay" | "glass";
  material: MaterialConfig;
}

export interface ParametricObject {
  id: string;
  type: ObjectType;
  name: string;
  parameters: Record<string, number | string | boolean>;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material: MaterialConfig;
  polyLevel: PolyLevel;
  interior?: InteriorConfig;
}

export const OBJECT_PRESETS: Record<ObjectType, Partial<ParametricObject>> = {
  building: {
    name: "Building",
    parameters: {
      width: 4,
      height: 6,
      depth: 3,
      stories: 3,
      windowsPerSide: 2,
      hasRoof: true,
      roofType: "pitched",
    },
    material: { color: "#c41e3a", metalness: 0.1, roughness: 0.7 },
  },
  bridge: {
    name: "Bridge",
    parameters: { length: 10, width: 3, height: 1, pillars: 4, material: "concrete" },
    material: { color: "#808080", metalness: 0.3, roughness: 0.6 },
  },
  lake: {
    name: "Lake",
    parameters: { width: 20, depth: 15, waterLevel: 0, hasShore: true },
    material: { color: "#1e90ff", metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.7 },
  },
  river: {
    name: "River",
    parameters: { length: 50, width: 5, curves: 3, waterLevel: 0 },
    material: { color: "#4169e1", metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.6 },
  },
  pond: {
    name: "Pond",
    parameters: { width: 8, depth: 6, waterLevel: 0 },
    material: { color: "#228b22", metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.5 },
  },
  chair: {
    name: "Chair",
    parameters: { width: 0.6, height: 0.9, depth: 0.6, armrests: true, backrest: true, material: "wood" },
    material: { color: "#8b4513", metalness: 0.1, roughness: 0.7 },
  },
  table: {
    name: "Table",
    parameters: { width: 1.2, height: 0.75, depth: 0.8, legs: 4, legThickness: 0.1, material: "wood" },
    material: { color: "#a0522d", metalness: 0.2, roughness: 0.6 },
  },
  street: {
    name: "Street",
    parameters: { length: 30, width: 8, lanes: 2, markings: true, material: "asphalt" },
    material: { color: "#2f4f4f", metalness: 0, roughness: 0.9 },
  },
  sidewalk: {
    name: "Sidewalk",
    parameters: { length: 20, width: 2, material: "concrete" },
    material: { color: "#a9a9a9", metalness: 0, roughness: 0.8 },
  },
  lightpost: {
    name: "Light Post",
    parameters: { height: 5, postThickness: 0.15, lightSize: 0.3, hasLight: true, material: "metal" },
    material: { color: "#333333", metalness: 0.8, roughness: 0.2 },
  },
  tree: {
    name: "Tree",
    parameters: { height: 8, trunkThickness: 0.5, canopyRadius: 3, leafDensity: 0.8, treeType: "oak" },
    material: { color: "#228b22", metalness: 0, roughness: 0.8 },
  },
  bush: {
    name: "Bush",
    parameters: { width: 1.5, height: 1.2, depth: 1.5, density: 0.7, bushType: "shrub" },
    material: { color: "#2d5016", metalness: 0, roughness: 0.9 },
  },
  custom: {
    name: "Custom Object",
    parameters: { width: 1, height: 1, depth: 1 },
    material: { color: "#cccccc", metalness: 0.5, roughness: 0.5 },
  },
};

export const POLY_CONFIGS: Record<PolyLevel, { segments: number; detail: number }> = {
  low: { segments: 4, detail: 1 },
  mid: { segments: 8, detail: 2 },
  high: { segments: 16, detail: 3 },
};

async function mergeMeshes(meshes: THREE.Mesh[]) {
  const { mergeGeometries } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const geoms: THREE.BufferGeometry[] = [];
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const g = (m.geometry as THREE.BufferGeometry).clone();
    g.applyMatrix4(m.matrixWorld);
    geoms.push(g);
  }
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) throw new Error("Failed to merge geometries");
  return merged;
}

export async function createMeshFromObject(obj: ParametricObject): Promise<THREE.Mesh> {
  let geometry: THREE.BufferGeometry;
  const polyConfig = POLY_CONFIGS[obj.polyLevel];

  switch (obj.type) {
    case "building":
      geometry = new THREE.BoxGeometry(
        Number(obj.parameters.width || 4),
        Number(obj.parameters.height || 6),
        Number(obj.parameters.depth || 3),
        polyConfig.segments,
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "bridge":
      geometry = new THREE.BoxGeometry(
        Number(obj.parameters.width || 3),
        Number(obj.parameters.height || 1),
        Number(obj.parameters.length || 10),
        polyConfig.segments,
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "lake":
      geometry = new THREE.PlaneGeometry(
        Number(obj.parameters.width || 20),
        Number(obj.parameters.depth || 15),
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "river":
      geometry = new THREE.PlaneGeometry(
        Number(obj.parameters.width || 5),
        Number(obj.parameters.length || 50),
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "pond":
      geometry = new THREE.PlaneGeometry(
        Number(obj.parameters.width || 8),
        Number(obj.parameters.depth || 6),
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "chair": {
      const group = new THREE.Group();
      const width = Number(obj.parameters.width || 0.6);
      const height = Number(obj.parameters.height || 0.9);
      const depth = Number(obj.parameters.depth || 0.6);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth, polyConfig.segments, 1, polyConfig.segments));
      seat.position.y = height - 0.2;
      group.add(seat);

      if (obj.parameters.backrest) {
        const back = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.5, 0.05, polyConfig.segments, polyConfig.segments, 1));
        back.position.y = height * 0.6;
        back.position.z = -depth / 2;
        group.add(back);
      }

      const legGeom = new THREE.BoxGeometry(0.05, height - 0.2, 0.05, 1, polyConfig.segments, 1);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeom);
        leg.position.x = (i % 2) * width - width / 2 + 0.05;
        leg.position.y = (height - 0.2) / 2;
        leg.position.z = i < 2 ? depth / 2 - 0.05 : -depth / 2 + 0.05;
        group.add(leg);
      }

      geometry = await mergeMeshes(
        group.children.filter((c: THREE.Object3D): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
      );
      break;
    }
    case "table": {
      const group = new THREE.Group();
      const width = Number(obj.parameters.width || 1.2);
      const height = Number(obj.parameters.height || 0.75);
      const depth = Number(obj.parameters.depth || 0.8);
      const legThickness = Number(obj.parameters.legThickness || 0.1);

      const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth, polyConfig.segments, 1, polyConfig.segments));
      top.position.y = height;
      group.add(top);

      const legGeom = new THREE.BoxGeometry(legThickness, height, legThickness, 1, polyConfig.segments, 1);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeom);
        leg.position.x = (i % 2) * width - width / 2 + legThickness / 2;
        leg.position.y = height / 2;
        leg.position.z = i < 2 ? depth / 2 - legThickness / 2 : -depth / 2 + legThickness / 2;
        group.add(leg);
      }

      geometry = await mergeMeshes(
        group.children.filter((c: THREE.Object3D): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
      );
      break;
    }
    case "street":
      geometry = new THREE.PlaneGeometry(
        Number(obj.parameters.width || 8),
        Number(obj.parameters.length || 30),
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "sidewalk":
      geometry = new THREE.PlaneGeometry(
        Number(obj.parameters.width || 2),
        Number(obj.parameters.length || 20),
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    case "lightpost": {
      const group = new THREE.Group();
      const height = Number(obj.parameters.height || 5);
      const postThickness = Number(obj.parameters.postThickness || 0.15);
      const lightSize = Number(obj.parameters.lightSize || 0.3);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(postThickness / 2, postThickness / 2, height, polyConfig.segments));
      post.position.y = height / 2;
      group.add(post);

      if (obj.parameters.hasLight) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(lightSize, polyConfig.segments, polyConfig.segments));
        lamp.position.y = height;
        group.add(lamp);
      }

      geometry = await mergeMeshes(
        group.children.filter((c: THREE.Object3D): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
      );
      break;
    }
    case "tree": {
      const group = new THREE.Group();
      const height = Number(obj.parameters.height || 8);
      const trunkThickness = Number(obj.parameters.trunkThickness || 0.5);
      const canopyRadius = Number(obj.parameters.canopyRadius || 3);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkThickness / 2, trunkThickness / 2, height * 0.3, polyConfig.segments));
      trunk.position.y = height * 0.15;
      group.add(trunk);

      const canopy = new THREE.Mesh(new THREE.SphereGeometry(canopyRadius, polyConfig.segments, polyConfig.segments));
      canopy.position.y = height * 0.7;
      group.add(canopy);

      geometry = await mergeMeshes(
        group.children.filter((c: THREE.Object3D): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
      );
      break;
    }
    case "bush":
      geometry = new THREE.BoxGeometry(
        Number(obj.parameters.width || 1.5),
        Number(obj.parameters.height || 1.2),
        Number(obj.parameters.depth || 1.5),
        polyConfig.segments,
        polyConfig.segments,
        polyConfig.segments
      );
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1, polyConfig.segments, polyConfig.segments, polyConfig.segments);
  }

  const material = new THREE.MeshStandardMaterial({
    color: obj.material.color,
    metalness: obj.material.metalness,
    roughness: obj.material.roughness,
    emissive: obj.material.emissive ? new THREE.Color(obj.material.emissive) : undefined,
    emissiveIntensity: obj.material.emissiveIntensity || 0,
    transparent: obj.material.transparent || false,
    opacity: obj.material.opacity !== undefined ? obj.material.opacity : 1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...obj.position);
  mesh.rotation.set(...obj.rotation);
  mesh.scale.set(...obj.scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}


