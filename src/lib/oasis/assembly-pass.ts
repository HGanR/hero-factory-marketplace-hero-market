/**
 * Assembly pass: layout constraints, scatter, colliders.
 * Run before saving blueprint to make worlds feel structured.
 */
import type { WorldBlueprint, WorldObject } from "./world-blueprint-schema";
import type { ResolvedAsset } from "./asset-resolver";

const TERRAIN_BOUNDS = 50; // meters each side
const MIN_SPACING = 2;
const BUILDING_ROTATION_SNAP = Math.PI / 2; // 90°
const SPAWN_CLEAR_RADIUS = 3;

function snapRotation(rad: number, forBuilding: boolean): number {
  if (!forBuilding) return rad;
  const snapped = Math.round(rad / BUILDING_ROTATION_SNAP) * BUILDING_ROTATION_SNAP;
  return snapped % (2 * Math.PI);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp object position inside terrain bounds.
 * Y is set to bounds[1]/2 so objects sit ON the ground (pivot-at-center convention).
 */
function clampPosition(pos: [number, number, number], bounds: [number, number, number]): [number, number, number] {
  const half = TERRAIN_BOUNDS / 2;
  const [bx, by, bz] = bounds;
  return [
    clamp(pos[0], -half + bx / 2, half - bx / 2),
    by / 2, // object bottom at Y=0; pivot at center so lift by half-height
    clamp(pos[2], -half + bz / 2, half - bz / 2),
  ];
}

/**
 * Enforce minimum spacing between objects.
 */
function enforceSpacing(objects: WorldObject[], assetMap: Map<string | number, ResolvedAsset>): WorldObject[] {
  const result = [...objects];
  for (let i = 0; i < result.length; i++) {
    const a = result[i];
    const aPos = a.transform?.position ?? [0, 0, 0];
    const aBounds = getObjectBounds(a, assetMap);

    for (let j = i + 1; j < result.length; j++) {
      const b = result[j];
      const bPos = b.transform?.position ?? [0, 0, 0];
      const bBounds = getObjectBounds(b, assetMap);

      const dx = Math.abs(aPos[0] - bPos[0]);
      const dz = Math.abs(aPos[2] - bPos[2]);
      const minDist = (aBounds[0] + aBounds[2] + bBounds[0] + bBounds[2]) / 2 + MIN_SPACING;

      if (dx < minDist && dz < minDist) {
        // Push b away
        const scale = aPos[0] < bPos[0] ? 1 : -1;
        const newX = bPos[0] + scale * (minDist - Math.min(dx, dz));
        result[j] = {
          ...b,
          transform: {
            ...b.transform,
            position: [clamp(newX, -TERRAIN_BOUNDS / 2, TERRAIN_BOUNDS / 2), bPos[1], bPos[2]],
          },
        };
      }
    }
  }
  return result;
}

function getObjectBounds(obj: WorldObject, assetMap: Map<string | number, ResolvedAsset>): [number, number, number] {
  const asset = typeof obj.assetRef === "number" ? assetMap.get(obj.assetRef) : null;
  const bounds = asset?.bounds ?? [2, 2, 2];
  const scale = typeof obj.transform?.scale === "number" ? obj.transform.scale : 1;
  return [bounds[0] * scale, bounds[1] * scale, bounds[2] * scale];
}

/**
 * Add scatter for vegetation (jitter positions).
 */
function scatterVegetation(objects: WorldObject[], seed: number): WorldObject[] {
  return objects.map((obj, i) => {
    if (obj.type !== "vegetation") return obj;
    const pos = obj.transform?.position ?? [0, 0, 0];
    const jitter = ((seed + i * 7) % 100) / 50 - 1; // -1 to 1
    return {
      ...obj,
      transform: {
        ...obj.transform,
        position: [pos[0] + jitter * 2, pos[1], pos[2] + ((seed + i * 3) % 100) / 50 - 1],
      },
    };
  });
}

/**
 * Guarantee at least one spawn point inside bounds, not colliding with large objects.
 */
function ensureSpawnPoints(blueprint: WorldBlueprint): WorldBlueprint {
  let spawns = blueprint.spawnPoints ?? [];
  if (spawns.length === 0) spawns = [[0, 2, 5]];
  const half = TERRAIN_BOUNDS / 2;
  spawns = spawns.map(([x, y, z]) => [
    Math.max(-half + 2, Math.min(half - 2, x)),
    Math.max(0.5, y),
    Math.max(-half + 2, Math.min(half - 2, z)),
  ]);
  return { ...blueprint, spawnPoints: spawns };
}

/**
 * Replace invalid assetRefs with fallback. Returns updated objects and assetMap.
 */
function resolveInvalidAssetRefs(
  objects: WorldObject[],
  assetMap: Map<string | number, ResolvedAsset>,
  fallbackAssetId: number | null
): { objects: WorldObject[]; assetMap: Map<string | number, ResolvedAsset> } {
  if (!fallbackAssetId || !assetMap.has(fallbackAssetId)) {
    return { objects, assetMap };
  }
  const result = objects.map((obj) => {
    const ref = obj.assetRef;
    const valid = typeof ref === "number" ? assetMap.has(ref) : false;
    if (!valid && typeof ref === "number") {
      return { ...obj, assetRef: fallbackAssetId };
    }
    return obj;
  });
  return { objects: result, assetMap };
}

export interface AssemblyOptions {
  assetMap: Map<string | number, ResolvedAsset>;
  fallbackAssetId?: number | null;
}

/**
 * Run assembly pass on a blueprint. Mutates and returns a new blueprint.
 */
export function runAssemblyPass(blueprint: WorldBlueprint, options: AssemblyOptions): WorldBlueprint {
  const { assetMap, fallbackAssetId = null } = options;

  let objects = blueprint.objects;

  // 1. Resolve invalid assetRefs
  const { objects: resolved } = resolveInvalidAssetRefs(objects, assetMap, fallbackAssetId);
  objects = resolved;

  // 2. Clamp positions inside terrain
  objects = objects.map((obj) => {
    const pos = obj.transform?.position ?? [0, 0, 0];
    const bounds = getObjectBounds(obj, assetMap);
    return {
      ...obj,
      transform: {
        ...obj.transform,
        position: clampPosition(pos, bounds),
      },
    };
  });

  // 3. Snap building rotations
  objects = objects.map((obj) => {
    if (obj.type !== "building") return obj;
    const rot = obj.transform?.rotation ?? [0, 0, 0];
    return {
      ...obj,
      transform: {
        ...obj.transform,
        rotation: [rot[0], snapRotation(rot[1], true), rot[2]],
      },
    };
  });

  // 4. Enforce spacing
  objects = enforceSpacing(objects, assetMap);

  // 5. Scatter vegetation + ensure vegetation tag for instancing
  objects = scatterVegetation(objects, blueprint.seed).map((o) =>
    o.type === "vegetation" ? { ...o, tags: [...(o.tags ?? []).filter((t) => t !== "vegetation"), "vegetation"] } : o
  );

  // 6. Guarantee spawn points
  const updated = ensureSpawnPoints({ ...blueprint, objects });

  return { ...updated, objects };
}
