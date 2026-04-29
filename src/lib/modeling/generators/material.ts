import * as THREE from "three";

const WALL_COLOR_MODERN = 0xeeeeee;
const WALL_COLOR_CLASSIC = 0xd4c4a8;
const FLOOR_COLOR = 0x8b7355;
const TABLE_COLOR = 0x4a3728;
const PODIUM_COLOR = 0x2c1810;

/** Shared materials (reuse across meshes to reduce draw calls) */
const _matCache: Record<string, THREE.Material> = {};

function getOrCreate(key: string, fn: () => THREE.Material): THREE.Material {
  if (!_matCache[key]) _matCache[key] = fn();
  return _matCache[key]!;
}

export function wallMaterial(style: "modern" | "classic" | "minimal"): THREE.Material {
  const color = style === "modern" || style === "minimal" ? WALL_COLOR_MODERN : WALL_COLOR_CLASSIC;
  return getOrCreate(`wall_${style}`, () => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
  }));
}

export function floorMaterial(): THREE.Material {
  return getOrCreate("floor", () => new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR,
    roughness: 0.8,
    metalness: 0.0,
  }));
}

export function tableMaterial(): THREE.Material {
  return getOrCreate("table", () => new THREE.MeshStandardMaterial({
    color: TABLE_COLOR,
    roughness: 0.7,
    metalness: 0.0,
  }));
}

export function podiumMaterial(style: "modern" | "classic" | "minimal"): THREE.Material {
  return getOrCreate(`podium_${style}`, () => new THREE.MeshStandardMaterial({
    color: style === "modern" ? 0x3d3d3d : PODIUM_COLOR,
    roughness: 0.5,
    metalness: style === "modern" ? 0.3 : 0.0,
  }));
}

export function glassMaterial(): THREE.Material {
  return getOrCreate("glass", () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.0,
    metalness: 0.0,
    transmission: 1.0,
    transparent: true,
    opacity: 0.25,
    thickness: 0.05,
  }));
}
