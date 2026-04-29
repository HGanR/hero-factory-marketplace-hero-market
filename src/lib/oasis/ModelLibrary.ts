/**
 * 3D Model Library
 *
 * Model management system with:
 * - Sketchfab API integration (optional)
 * - Model caching
 * - Procedural fallbacks
 * - GLTF/GLB + OBJ support
 *
 * NOTE: In this repo, we primarily use this as a fallback geometry provider until
 * actual `/public/models/...` assets are added.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

// ============================================================================
// Types
// ============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  category: string;
  modelUrl?: string;
  sketchfabId?: string;
  format?: "gltf" | "glb" | "obj" | "mtl";
  scale?: number;
  rotation?: { x: number; y: number; z: number };
  offset?: { x: number; y: number; z: number };
  fallbackGeometry?: "box" | "sphere" | "cylinder" | "cone" | "custom";
  fallbackColor?: number;
  tags?: string[];
}

export interface LoadedModel {
  config: ModelConfig;
  scene: THREE.Group;
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material;
  animations?: THREE.AnimationClip[];
  boundingBox?: THREE.Box3;
}

interface ModelCache {
  [key: string]: LoadedModel;
}

// ============================================================================
// Library
// ============================================================================

const MODEL_LIBRARY: ModelConfig[] = [
  { id: "tree-oak", name: "Oak Tree", category: "trees", sketchfabId: "a1b2c3d4e5f6g7h8", scale: 1, fallbackGeometry: "cone", fallbackColor: 0x228b22, tags: ["nature", "tree", "oak"] },
  { id: "tree-pine", name: "Pine Tree", category: "trees", sketchfabId: "b2c3d4e5f6g7h8i9", scale: 1.2, fallbackGeometry: "cone", fallbackColor: 0x1a6b1a, tags: ["nature", "tree", "pine"] },
  { id: "tree-palm", name: "Palm Tree", category: "trees", sketchfabId: "c3d4e5f6g7h8i9j0", scale: 1.5, fallbackGeometry: "cylinder", fallbackColor: 0x8b7355, tags: ["nature", "tree", "palm", "tropical"] },

  { id: "lake-small", name: "Small Lake", category: "water", sketchfabId: "d4e5f6g7h8i9j0k1", scale: 2, fallbackGeometry: "custom", fallbackColor: 0x1e90ff, tags: ["water", "lake", "nature"] },
  { id: "lake-large", name: "Large Lake", category: "water", sketchfabId: "e5f6g7h8i9j0k1l2", scale: 3, fallbackGeometry: "custom", fallbackColor: 0x1873cc, tags: ["water", "lake", "nature"] },
  { id: "pond", name: "Pond", category: "water", sketchfabId: "f6g7h8i9j0k1l2m3", scale: 1, fallbackGeometry: "custom", fallbackColor: 0x4169e1, tags: ["water", "pond", "nature"] },
  { id: "river", name: "River", category: "water", sketchfabId: "g7h8i9j0k1l2m3n4", scale: 1, fallbackGeometry: "custom", fallbackColor: 0x00bfff, tags: ["water", "river", "nature"] },

  { id: "street-straight", name: "Straight Street", category: "streets", sketchfabId: "h8i9j0k1l2m3n4o5", scale: 1, fallbackGeometry: "box", fallbackColor: 0x444444, tags: ["street", "road", "asphalt"] },
  { id: "street-corner", name: "Street Corner", category: "streets", sketchfabId: "i9j0k1l2m3n4o5p6", scale: 1, fallbackGeometry: "box", fallbackColor: 0x555555, tags: ["street", "road", "corner"] },

  { id: "sidewalk-concrete", name: "Concrete Sidewalk", category: "sidewalks", sketchfabId: "j0k1l2m3n4o5p6q7", scale: 1, fallbackGeometry: "box", fallbackColor: 0xaaaaaa, tags: ["sidewalk", "concrete", "pavement"] },
  { id: "sidewalk-brick", name: "Brick Sidewalk", category: "sidewalks", sketchfabId: "k1l2m3n4o5p6q7r8", scale: 1, fallbackGeometry: "box", fallbackColor: 0xcd853f, tags: ["sidewalk", "brick", "pavement"] },

  { id: "light-post-street", name: "Street Light Post", category: "lights", sketchfabId: "l2m3n4o5p6q7r8s9", scale: 0.5, fallbackGeometry: "cylinder", fallbackColor: 0x333333, tags: ["light", "street", "post"] },
  { id: "light-post-decorative", name: "Decorative Light Post", category: "lights", sketchfabId: "m3n4o5p6q7r8s9t0", scale: 0.6, fallbackGeometry: "cylinder", fallbackColor: 0x2f4f4f, tags: ["light", "decorative", "post"] },

  { id: "hydrant-red", name: "Red Fire Hydrant", category: "utilities", sketchfabId: "n4o5p6q7r8s9t0u1", scale: 0.3, fallbackGeometry: "cylinder", fallbackColor: 0xff0000, tags: ["hydrant", "fire", "utility"] },
  { id: "hydrant-yellow", name: "Yellow Fire Hydrant", category: "utilities", sketchfabId: "o5p6q7r8s9t0u1v2", scale: 0.3, fallbackGeometry: "cylinder", fallbackColor: 0xffff00, tags: ["hydrant", "fire", "utility"] },

  { id: "bridge-wooden", name: "Wooden Bridge", category: "bridges", sketchfabId: "p6q7r8s9t0u1v2w3", scale: 1, fallbackGeometry: "box", fallbackColor: 0x8b4513, tags: ["bridge", "wooden", "crossing"] },
  { id: "bridge-stone", name: "Stone Bridge", category: "bridges", sketchfabId: "q7r8s9t0u1v2w3x4", scale: 1, fallbackGeometry: "box", fallbackColor: 0x808080, tags: ["bridge", "stone", "crossing"] },
  { id: "bridge-metal", name: "Metal Bridge", category: "bridges", sketchfabId: "r8s9t0u1v2w3x4y5", scale: 1, fallbackGeometry: "box", fallbackColor: 0x696969, tags: ["bridge", "metal", "crossing"] },

  { id: "building-house", name: "House", category: "buildings", sketchfabId: "s9t0u1v2w3x4y5z6", scale: 1, fallbackGeometry: "box", fallbackColor: 0xd2691e, tags: ["building", "house", "residential"] },
  { id: "building-apartment", name: "Apartment Building", category: "buildings", sketchfabId: "t0u1v2w3x4y5z6a7", scale: 1.5, fallbackGeometry: "box", fallbackColor: 0xa0522d, tags: ["building", "apartment", "residential"] },
  { id: "building-storefront", name: "Storefront", category: "buildings", sketchfabId: "u1v2w3x4y5z6a7b8", scale: 1, fallbackGeometry: "box", fallbackColor: 0x8b0000, tags: ["building", "storefront", "commercial"] },
  { id: "building-office", name: "Office Building", category: "buildings", sketchfabId: "v2w3x4y5z6a7b8c9", scale: 2, fallbackGeometry: "box", fallbackColor: 0x696969, tags: ["building", "office", "commercial"] },
  { id: "building-warehouse", name: "Warehouse", category: "buildings", sketchfabId: "w3x4y5z6a7b8c9d0", scale: 2.5, fallbackGeometry: "box", fallbackColor: 0x505050, tags: ["building", "warehouse", "industrial"] },
];

// ============================================================================
// Model Loader
// ============================================================================

export class ModelLibrary {
  private cache: ModelCache = {};
  private gltfLoader = new GLTFLoader();
  private objLoader = new OBJLoader();
  private mtlLoader = new MTLLoader();
  private textureLoader = new THREE.TextureLoader();
  private loadingPromises: Map<string, Promise<LoadedModel>> = new Map();

  async getModel(modelId: string): Promise<LoadedModel> {
    if (this.cache[modelId]) return this.cache[modelId];
    if (this.loadingPromises.has(modelId)) return this.loadingPromises.get(modelId)!;

    const loadPromise = this.loadModel(modelId);
    this.loadingPromises.set(modelId, loadPromise);
    try {
      const model = await loadPromise;
      this.cache[modelId] = model;
      return model;
    } finally {
      this.loadingPromises.delete(modelId);
    }
  }

  private async loadModel(modelId: string): Promise<LoadedModel> {
    const config = MODEL_LIBRARY.find((m) => m.id === modelId);
    if (!config) throw new Error(`Model ${modelId} not found in library`);

    try {
      if (config.sketchfabId) return await this.loadFromSketchfab(config);
      if (config.modelUrl) return await this.loadFromUrl(config);
      return this.createFallbackModel(config);
    } catch (error) {
      console.warn(`Failed to load model ${modelId}, using fallback:`, error);
      return this.createFallbackModel(config);
    }
  }

  private async loadFromSketchfab(config: ModelConfig): Promise<LoadedModel> {
    const apiUrl = `https://api.sketchfab.com/v3/models/${config.sketchfabId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const gltfUrl = data.gltf?.url || data.downloadUrl;
    if (!gltfUrl) throw new Error("No glTF URL available");

    const gltf = await new Promise<any>((resolve, reject) => {
      this.gltfLoader.load(gltfUrl, resolve, undefined, reject);
    });

    const scene: THREE.Group = gltf.scene;
    this.applyConfig(scene, config);

    const boundingBox = new THREE.Box3().setFromObject(scene);
    return { config, scene, animations: gltf.animations, boundingBox };
  }

  private async loadFromUrl(config: ModelConfig): Promise<LoadedModel> {
    if (!config.modelUrl) throw new Error("No model URL provided");
    const url = config.modelUrl;
    const format = config.format || "glb";

    let scene: THREE.Group;
    if (format === "gltf" || format === "glb") {
      const gltf = await new Promise<any>((resolve, reject) => this.gltfLoader.load(url, resolve, undefined, reject));
      scene = gltf.scene;
    } else if (format === "obj") {
      scene = await new Promise<any>((resolve, reject) => this.objLoader.load(url, resolve, undefined, reject));
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    this.applyConfig(scene, config);
    const boundingBox = new THREE.Box3().setFromObject(scene);
    return { config, scene, boundingBox };
  }

  private applyConfig(scene: THREE.Group, config: ModelConfig) {
    if (config.scale) scene.scale.multiplyScalar(config.scale);
    if (config.rotation) scene.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    if (config.offset) scene.position.set(config.offset.x, config.offset.y, config.offset.z);
  }

  private createFallbackModel(config: ModelConfig): LoadedModel {
    const scene = new THREE.Group();
    let geometry: THREE.BufferGeometry;

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: config.fallbackColor || 0x888888,
      metalness: 0.2,
      roughness: 0.7,
    });

    switch (config.fallbackGeometry) {
      case "box":
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(0.5, 24, 24);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 18);
        break;
      case "cone":
        geometry = new THREE.ConeGeometry(0.5, 1, 18);
        break;
      case "custom": {
        geometry = new THREE.PlaneGeometry(2, 2, 32, 32);
        const waterMaterial = new THREE.MeshStandardMaterial({
          color: config.fallbackColor || 0x1e90ff,
          metalness: 0.1,
          roughness: 0.2,
          transparent: true,
          opacity: 0.85,
        });
        const mesh = new THREE.Mesh(geometry, waterMaterial);
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        const boundingBox = new THREE.Box3().setFromObject(scene);
        return { config, scene, geometry, material: waterMaterial, boundingBox };
      }
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const mesh = new THREE.Mesh(geometry, baseMaterial);
    if (config.scale) mesh.scale.multiplyScalar(config.scale);
    scene.add(mesh);

    const boundingBox = new THREE.Box3().setFromObject(scene);
    return { config, scene, geometry, material: baseMaterial, boundingBox };
  }

  getModelsByCategory(category: string): ModelConfig[] {
    return MODEL_LIBRARY.filter((m) => m.category === category);
  }

  searchByTag(tag: string): ModelConfig[] {
    return MODEL_LIBRARY.filter((m) => m.tags?.includes(tag));
  }

  getAllModels(): ModelConfig[] {
    return MODEL_LIBRARY;
  }

  getConfig(modelId: string): ModelConfig | undefined {
    return MODEL_LIBRARY.find((m) => m.id === modelId);
  }

  clearCache(): void {
    this.cache = {};
  }

  getCacheStats(): { cachedModels: number; loadingModels: number; totalModels: number } {
    return {
      cachedModels: Object.keys(this.cache).length,
      loadingModels: this.loadingPromises.size,
      totalModels: MODEL_LIBRARY.length,
    };
  }

  cloneModel(modelId: string): THREE.Group | null {
    const cached = this.cache[modelId];
    if (!cached) return null;
    return cached.scene.clone();
  }
}

export default ModelLibrary;


