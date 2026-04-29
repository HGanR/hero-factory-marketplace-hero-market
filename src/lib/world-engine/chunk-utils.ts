/**
 * Chunk key and placement utilities for world editor.
 * Chunk size: 64m. Key format: "cx_cz" where cx = floor(x/64), cz = floor(z/64).
 */

export const CHUNK_SIZE = 64;

export interface Placement {
  id: string;
  assetId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  ownerLayer?: string;
}

export function positionToChunkKey(x: number, z: number): string {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  return `${cx}_${cz}`;
}

export function placementsToChunks(placements: Placement[]): Array<{ chunkKey: string; placementsJson: Placement[] }> {
  const byChunk = new Map<string, Placement[]>();
  for (const p of placements) {
    const [x, , z] = p.position;
    const key = positionToChunkKey(x, z);
    if (!byChunk.has(key)) byChunk.set(key, []);
    byChunk.get(key)!.push(p);
  }
  return Array.from(byChunk.entries()).map(([chunkKey, placementsJson]) => ({
    chunkKey,
    placementsJson,
  }));
}

export function chunksToPlacements(
  chunks: Array<{ chunkKey: string; placementsJson: unknown }>
): Placement[] {
  const placements: Placement[] = [];
  for (const chunk of chunks) {
    const raw = chunk.placementsJson;
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (p && typeof p === "object" && Array.isArray((p as Placement).position)) {
          placements.push({
            id: (p as Placement).id ?? `obj-${chunk.chunkKey}-${placements.length}`,
            assetId: (p as Placement).assetId ?? "unknown",
            position: (p as Placement).position,
            rotation: (p as Placement).rotation ?? [0, 0, 0],
            scale: (p as Placement).scale ?? [1, 1, 1],
            ownerLayer: (p as Placement).ownerLayer ?? "user",
          });
        }
      }
    }
  }
  return placements;
}
