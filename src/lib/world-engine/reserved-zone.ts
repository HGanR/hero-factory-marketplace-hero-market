/**
 * Reserved zone intersection check.
 * Blocks placement if position is inside any reserved zone.
 */

export interface ZoneBounds {
  centerX?: number;
  centerZ?: number;
  width?: number;
  length?: number;
  heightLimit?: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
}

function parseBounds(bounds: unknown): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (!bounds || typeof bounds !== "object") return null;
  const b = bounds as Record<string, unknown>;

  if (typeof b.minX === "number" && typeof b.maxX === "number" && typeof b.minZ === "number" && typeof b.maxZ === "number") {
    return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
  }

  const cx = typeof b.centerX === "number" ? b.centerX : 0;
  const cz = typeof b.centerZ === "number" ? b.centerZ : 0;
  const w = typeof b.width === "number" ? b.width : 32;
  const l = typeof b.length === "number" ? b.length : 32;
  const halfW = w / 2;
  const halfL = l / 2;

  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minZ: cz - halfL,
    maxZ: cz + halfL,
  };
}

export function isInReservedZone(
  x: number,
  z: number,
  reservedZones: Array<{ boundsJson: unknown }>
): boolean {
  for (const zone of reservedZones) {
    const bounds = parseBounds(zone.boundsJson);
    if (!bounds) continue;
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
      return true;
    }
  }
  return false;
}
