import * as THREE from "three";
import { subtractMeshes } from "./boolean-operations";

export type ObjectType = "wall" | "window" | "door" | "building";

export interface MaterialConfig {
  color: string;
  metalness: number;
  roughness: number;
  transparent?: boolean;
  opacity?: number;
  transmission?: number; // For glass
}

export interface ParametricObject {
  id: string;
  type: ObjectType;
  name: string;
  parameters: Record<string, any>;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material: MaterialConfig;
}

export const OBJECT_PRESETS: Record<ObjectType, { name: string; parameters: any; material: MaterialConfig }> = {
  wall: {
    name: "Wall",
    parameters: {
      width: 4,
      height: 3,
      thickness: 0.2,
      material: "brick"
    },
    material: { color: "#8B7355", metalness: 0.0, roughness: 0.9 }
  },
  window: {
    name: "Window",
    parameters: {
      width: 1.2,
      height: 1.5,
      frameThickness: 0.05,
      glassThickness: 0.02,
      hasFrame: true
    },
    material: { color: "#2C3E50", metalness: 0.8, roughness: 0.2 }
  },
  door: {
    name: "Door",
    parameters: {
      width: 0.9,
      height: 2.1,
      thickness: 0.05,
      doorStyle: "panel",
      hingeSide: "left"
    },
    material: { color: "#8B4513", metalness: 0.0, roughness: 0.7 }
  },
  building: {
    name: "Building",
    parameters: {
      width: 10,
      height: 6,
      depth: 10,
      wallThickness: 0.2
    },
    material: { color: "#F5F5DC", metalness: 0.0, roughness: 0.8 }
  }
};

function createMaterial(config: MaterialConfig): THREE.Material {
  if (config.transmission && config.transmission > 0) {
    // Glass material
    return new THREE.MeshPhysicalMaterial({
      color: config.color,
      metalness: config.metalness ?? 0,
      roughness: config.roughness ?? 0.5,
      transparent: config.transparent ?? true,
      opacity: config.opacity ?? 0.3,
      transmission: config.transmission,
      ior: 1.5,
      thickness: 0.05,
      side: THREE.FrontSide,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: config.color,
    metalness: config.metalness ?? 0,
    roughness: config.roughness ?? 0.5,
    transparent: config.transparent ?? false,
    opacity: config.opacity ?? 1,
    side: THREE.FrontSide,
  });
}

export async function createMeshFromObject(obj: ParametricObject): Promise<THREE.Object3D> {
  const group = new THREE.Group();
  group.name = obj.name;

  switch (obj.type) {
    case "wall": {
      const width = obj.parameters.width || 4;
      const height = obj.parameters.height || 3;
      const thickness = obj.parameters.thickness || 0.2;

      const geometry = new THREE.BoxGeometry(width, height, thickness);
      const material = createMaterial(obj.material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case "window": {
      const width = obj.parameters.width || 1.2;
      const height = obj.parameters.height || 1.5;
      const frameThickness = obj.parameters.frameThickness || 0.05;
      const glassThickness = obj.parameters.glassThickness || 0.02;
      const hasFrame = obj.parameters.hasFrame !== false;

      if (hasFrame) {
        // Create frame (4 sides)
        const frameMaterial = createMaterial(obj.material);

        // Top frame
        const topGeometry = new THREE.BoxGeometry(width, frameThickness, frameThickness);
        const topFrame = new THREE.Mesh(topGeometry, frameMaterial);
        topFrame.position.set(0, height/2 - frameThickness/2, 0);
        group.add(topFrame);

        // Bottom frame
        const bottomFrame = new THREE.Mesh(topGeometry, frameMaterial);
        bottomFrame.position.set(0, -height/2 + frameThickness/2, 0);
        group.add(bottomFrame);

        // Left frame
        const sideGeometry = new THREE.BoxGeometry(frameThickness, height, frameThickness);
        const leftFrame = new THREE.Mesh(sideGeometry, frameMaterial);
        leftFrame.position.set(-width/2 + frameThickness/2, 0, 0);
        group.add(leftFrame);

        // Right frame
        const rightFrame = new THREE.Mesh(sideGeometry, frameMaterial);
        rightFrame.position.set(width/2 - frameThickness/2, 0, 0);
        group.add(rightFrame);
      }

      // Glass pane
      const glassGeometry = new THREE.PlaneGeometry(
        width - (hasFrame ? frameThickness * 2 : 0),
        height - (hasFrame ? frameThickness * 2 : 0)
      );
      const glassMaterial = createMaterial({
        ...obj.material,
        transmission: 1.0,
        transparent: true,
        opacity: 0.2
      });
      const glass = new THREE.Mesh(glassGeometry, glassMaterial);
      glass.position.set(0, 0, frameThickness/2 + 0.01); // Slightly in front of frame
      group.add(glass);

      break;
    }

    case "door": {
      const width = obj.parameters.width || 0.9;
      const height = obj.parameters.height || 2.1;
      const thickness = obj.parameters.thickness || 0.05;

      const geometry = new THREE.BoxGeometry(width, height, thickness);
      const material = createMaterial(obj.material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Add door handle (simple cylinder)
      const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.1);
      const handleMaterial = new THREE.MeshStandardMaterial({ color: "#FFD700", metalness: 1.0, roughness: 0.1 });
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.position.set(width/2 - 0.1, 0, thickness/2 + 0.01);
      handle.rotation.z = Math.PI / 2;
      group.add(handle);

      break;
    }

    case "building": {
      // Use the building template
      const { createEnterableBuildingRoot } = await import("./buildingTemplate");
      const building = createEnterableBuildingRoot();
      group.add(building);
      break;
    }
  }

  // Apply transform
  group.position.set(...obj.position);
  group.rotation.set(...obj.rotation);
  group.scale.set(...obj.scale);

  return group;
}

export function createWallWithCutouts(
  wallParams: { width: number; height: number; thickness: number },
  cutouts: Array<{ x: number; y: number; width: number; height: number; type: 'window' | 'door' }>
): THREE.Mesh {
  // Create base wall
  const wallGeometry = new THREE.BoxGeometry(wallParams.width, wallParams.height, wallParams.thickness);
  let wallMesh = new THREE.Mesh(wallGeometry, new THREE.MeshStandardMaterial({ color: "#8B7355" }));

  // Apply cutouts
  for (const cutout of cutouts) {
    const cutterGeometry = new THREE.BoxGeometry(cutout.width, cutout.height, wallParams.thickness * 2);
    const cutter = new THREE.Mesh(cutterGeometry);
    cutter.position.set(cutout.x, cutout.y, 0);

    // Perform boolean subtraction
    wallMesh = subtractMeshes(wallMesh, cutter);
  }

  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;

  return wallMesh;
}