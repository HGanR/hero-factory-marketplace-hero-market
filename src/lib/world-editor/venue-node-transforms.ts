/**
 * Venue node transform utilities.
 * Converts between node-relative coordinates (posX, posY, posZ) and world-space coordinates
 * using the parent placement's transform.
 *
 * Convention: Placement has position [x,y,z], rotation [rx,ry,rz] in radians (Euler),
 * scale [sx,sy,sz]. Node stores posX, posY, posZ relative to placement origin.
 *
 * Future: For true interior editing, these could be extended to support GLB-local space
 * when the renderer supports interior mesh raycasting and local coordinate systems.
 */

import type { Placement } from "@/lib/world-engine/chunk-utils";

export interface PlacementTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/**
 * Convert node-relative coordinates to world-space position.
 * Applies: scale → rotate Y → translate.
 */
export function nodeToWorld(
  posX: number,
  posY: number,
  posZ: number,
  placement: Placement | PlacementTransform
): [number, number, number] {
  const [px, py, pz] = placement.position;
  const [rx, ry, rz] = placement.rotation;
  const [sx, sy, sz] = placement.scale;

  // Scale in local space
  const lx = posX * (sx ?? 1);
  const ly = posY * (sy ?? 1);
  const lz = posZ * (sz ?? 1);

  // Rotate around Y (yaw) - most common for buildings
  const cy = Math.cos(ry ?? 0);
  const sy_ = Math.sin(ry ?? 0);
  const wx = lx * cy - lz * sy_;
  const wz = lx * sy_ + lz * cy;
  const wy = ly;

  return [px + wx, py + wy, pz + wz];
}

/**
 * Convert world-space position to node-relative coordinates.
 * Inverse of nodeToWorld.
 */
export function worldToNode(
  worldX: number,
  worldY: number,
  worldZ: number,
  placement: Placement | PlacementTransform
): { posX: number; posY: number; posZ: number } {
  const [px, py, pz] = placement.position;
  const [rx, ry, rz] = placement.rotation;
  const [sx, sy, sz] = placement.scale;

  const sxf = sx ?? 1;
  const syf = sy ?? 1;
  const szf = sz ?? 1;

  // Translate to placement-local origin
  let lx = worldX - px;
  let ly = worldY - py;
  let lz = worldZ - pz;

  // Inverse rotate Y
  const cy = Math.cos(-(ry ?? 0));
  const sy_ = Math.sin(-(ry ?? 0));
  const lx2 = lx * cy - lz * sy_;
  const lz2 = lx * sy_ + lz * cy;
  lx = lx2;
  lz = lz2;

  // Inverse scale
  const posX = lx / sxf;
  const posY = ly / syf;
  const posZ = lz / szf;

  return { posX, posY, posZ };
}
