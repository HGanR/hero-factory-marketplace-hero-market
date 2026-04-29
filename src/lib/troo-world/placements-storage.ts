/**
 * localStorage fallback for Troo World placements.
 * When the database/API is unavailable, placements are saved to and loaded from the browser.
 * Both the modeling page and troo-world page use this so saved layouts persist across sessions.
 */
import type { Placement } from "@/components/troo-world/TrooWorldUnifiedViewer";

const STORAGE_KEY_PREFIX = "troo-world-placements-";

export function getPlacementsFromStorage(worldId: string): Placement[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + worldId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (p): p is Placement =>
          p &&
          typeof p.elementKey === "string" &&
          typeof p.glbUrl === "string" &&
          typeof p.posX === "number" &&
          typeof p.posY === "number" &&
          typeof p.posZ === "number"
      )
      .map((p) => ({
        ...p,
        scale: typeof p.scale === "number" ? p.scale : 1,
        rotY: typeof p.rotY === "number" ? p.rotY : 0,
      }));
  } catch {
    return null;
  }
}

export function savePlacementsToStorage(worldId: string, placements: Placement[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + worldId, JSON.stringify(placements));
  } catch {
    // Storage full or disabled
  }
}
