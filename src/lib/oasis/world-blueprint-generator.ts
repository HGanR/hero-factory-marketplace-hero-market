import crypto from "crypto";
import type { WorldBlueprint, WorldObject } from "./world-blueprint-schema";
import type { OasisWorldElement } from "@/lib/db/schema";

/** Deterministic seed: base from worldId+prompt, regen varies by index. */
function deriveSeed(worldId: string, prompt: string, regenIndex: number): number {
  const base = `${worldId}:${prompt.trim()}`;
  const hash = crypto.createHash("sha256").update(base).digest("hex");
  const baseSeed = parseInt(hash.slice(0, 12), 16) % 1e9;
  if (regenIndex <= 0) return baseSeed;
  const regenHash = crypto.createHash("sha256").update(`${hash}:${regenIndex}`).digest("hex");
  return (parseInt(regenHash.slice(0, 12), 16) % 1e9) + baseSeed;
}

/** Generate a WorldBlueprint from prompt + asset library (kit-based, no mesh gen). */
export function generateBlueprintFromPrompt(
  worldId: string,
  prompt: string,
  elements: Pick<OasisWorldElement, "id" | "name" | "assetUri" | "tags">[],
  options?: { seed?: number; regenIndex?: number; lockedObjectIds?: string[] }
): WorldBlueprint {
  const regenIndex = options?.regenIndex ?? 0;
  const seed =
    typeof options?.seed === "number"
      ? options.seed
      : deriveSeed(worldId, prompt, regenIndex);
  const lockedIds = new Set(options?.lockedObjectIds ?? []);
  const lower = prompt.toLowerCase().trim();

  // Map keywords to asset names/categories
  const treeNames = ["tree", "pine", "oak", "birch", "maple", "willow"];
  const hasTrees = treeNames.some((t) => lower.includes(t)) || /forest|vegetation|greenery/i.test(lower);
  const hasBuildings = /building|house|structure|tower|market|village|urban/i.test(lower);
  const hasWater = /water|river|lake|pond|coast|dock/i.test(lower);
  const wantsWindows = /window|windows|proper|architecture|facade/i.test(lower);

  const objects: WorldObject[] = [];
  let idx = 0;

  // Pick trees from catalog (each tree gets a unique position derived from seed + index)
  if (hasTrees) {
    const trees = elements.filter(
      (e) =>
        e.assetUri &&
        (e.name?.toLowerCase().includes("tree") || e.tags?.toLowerCase?.().includes("tree"))
    );
    const treePool = trees.length > 0 ? trees : elements.filter((e) => e.assetUri);
    const count = Math.min(3 + (seed % 4), treePool.length || 3);
    for (let i = 0; i < count && treePool.length > 0; i++) {
      const el = treePool[(seed + i) % treePool.length];
      if (el?.assetUri) {
        const s = seed + i * 7919; // per-tree offset
        objects.push({
          id: `obj_${idx++}`,
          type: "vegetation",
          assetRef: el.id,
          transform: {
            position: [(s % 20) - 10, 0, ((s >> 4) % 17) - 8],
            scale: 0.8 + ((s >> 8) % 3) * 0.2,
          },
          tags: ["walkable", "vegetation"],
        });
      }
    }
  }

  // Pick buildings — prefer elements with "window" in name/tags when prompt implies architecture
  if (hasBuildings) {
    const buildingCandidates = elements.filter(
      (e) =>
        e.assetUri &&
        (e.name?.toLowerCase().includes("building") ||
          e.name?.toLowerCase().includes("house") ||
          e.tags?.toLowerCase?.().includes("building"))
    );
    const withWindows = buildingCandidates.filter(
      (e) =>
        e.name?.toLowerCase().includes("window") ||
        e.tags?.toLowerCase?.().includes("window") ||
        e.tags?.toLowerCase?.().includes("facade")
    );
    const pool = wantsWindows && withWindows.length > 0 ? withWindows : buildingCandidates.length > 0 ? buildingCandidates : elements.filter((e) => e.assetUri);
    const el = pool[seed % Math.max(1, pool.length)];
    if (el?.assetUri) {
      objects.push({
        id: `obj_${idx++}`,
        type: "building",
        assetRef: el.id,
        transform: { position: [((seed % 15) - 7) * 2, 0, ((seed % 11) - 5) * 2], scale: 1 },
        tags: ["interactive"],
      });
    }
  }

  // Rocks/props for desert/barren-style prompts
  const hasRocks = /rock|stone|boulder|desert|barren|arid/i.test(lower);
  if (hasRocks) {
    const rockPool = elements.filter(
      (e) =>
        e.assetUri &&
        (e.name?.toLowerCase().includes("rock") || e.tags?.toLowerCase?.().includes("rock") || e.tags?.toLowerCase?.().includes("prop"))
    );
    const pool = rockPool.length > 0 ? rockPool : elements.filter((e) => e.assetUri);
    const count = Math.min(2 + (seed % 3), pool.length || 2);
    for (let i = 0; i < count && pool.length > 0; i++) {
      const el = pool[(seed + i * 31) % pool.length];
      if (el?.assetUri) {
        const s = seed + i * 7919;
        objects.push({
          id: `obj_${idx++}`,
          type: "prop",
          assetRef: el.id,
          transform: {
            position: [((s % 18) - 9) * 1.5, 0, (((s >> 4) % 14) - 7) * 1.5],
            scale: 0.6 + ((s >> 8) % 4) * 0.2,
          },
          tags: ["walkable"],
        });
      }
    }
  }

  // Fallback: use seed to vary selection and placement when prompt didn't match keywords
  if (objects.length === 0 && elements.length > 0) {
    const available = elements.filter((e) => e.assetUri);
    const take = Math.min(3, available.length);
    for (let i = 0; i < take; i++) {
      const el = available[(seed + i * 17) % Math.max(1, available.length)];
      if (el?.assetUri) {
        const s = seed + i * 7919;
        objects.push({
          id: `obj_${idx++}`,
          type: "prop",
          assetRef: el.id,
          transform: {
            position: [((s % 12) - 6) * 2, 0, (((s >> 4) % 10) - 5) * 2],
            scale: 0.8 + ((s >> 8) % 3) * 0.15,
          },
        });
      }
    }
  }

  const biome = hasWater ? "water" : hasTrees ? "forest" : hasRocks ? "desert" : "grassland";
  return {
    worldId,
    seed,
    biome,
    stylePreset: "modern",
    objects: objects.map((o) => ({ ...o, locked: lockedIds.has(o.id) })),
    terrain: { biome },
    lighting: { ambient: 0.6 },
    spawnPoints: [[0, 0, 5]],
  };
}
