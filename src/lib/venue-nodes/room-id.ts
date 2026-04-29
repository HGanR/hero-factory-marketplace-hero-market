/**
 * Venue interior node roomId helpers.
 * Format: {worldId}:{placementId}:{nodeId}
 * Example: abc-world-123:pl_1234567890_xyz:node-uuid-456
 */

export function buildVenueRoomId(worldId: string, placementId: string, nodeId: string): string {
  return `${worldId}:${placementId}:${nodeId}`;
}

export type ParsedVenueRoomId =
  | { ok: true; worldId: string; placementId: string; nodeId: string }
  | { ok: false; error: string };

export function parseVenueRoomId(roomId: string): ParsedVenueRoomId {
  if (!roomId || typeof roomId !== "string") {
    return { ok: false, error: "Invalid room" };
  }
  const parts = roomId.split(":");
  if (parts.length !== 3) {
    return { ok: false, error: "Venue roomId must be worldId:placementId:nodeId" };
  }
  const [worldId, placementId, nodeId] = parts;
  if (!worldId?.trim() || !placementId?.trim() || !nodeId?.trim()) {
    return { ok: false, error: "Invalid room format" };
  }
  return { ok: true, worldId: worldId.trim(), placementId: placementId.trim(), nodeId: nodeId.trim() };
}

/** Returns true if roomId looks like a venue format (3 parts) */
export function isVenueRoomId(roomId: string): boolean {
  return roomId?.split(":").length === 3;
}
