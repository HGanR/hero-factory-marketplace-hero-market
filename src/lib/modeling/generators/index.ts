import * as THREE from "three";
import type { AtomicBuildPlan, BuildPlan, ScenePlan } from "../prompt-schema";
import { genRoom } from "./room";
import { genOfficeHQ } from "./office_hq";
import { genConferenceRoom } from "./conference_room";
import { genPodium } from "./podium";
import { genVaultRoom } from "./vault_room";
import { resolveAutoPlacement } from "../placement";

/**
 * Generate a THREE.Group from a validated BuildPlan.
 * Deterministic: same plan → same geometry.
 */
function generateAtomic(plan: AtomicBuildPlan): THREE.Group {
  switch (plan.kind) {
    case "room":
      return genRoom(plan);
    case "office_hq":
      return genOfficeHQ(plan);
    case "conference_room":
      return genConferenceRoom(plan);
    case "podium":
      return genPodium(plan);
    case "vault_room":
      return genVaultRoom(plan);
    default: {
      const _: never = plan;
      throw new Error(`Unknown plan kind: ${(plan as AtomicBuildPlan).kind}`);
    }
  }
}

function generateScene(plan: ScenePlan): THREE.Group {
  const root = new THREE.Group();
  root.name = `Scene_${plan.objects.length}`;
  root.userData = {
    planKind: plan.kind,
    planVersion: plan.version,
    seed: plan.seed,
    objectCount: plan.objects.length,
  };

  const generated = plan.objects.map((entry) => {
    const g = generateAtomic(entry.plan);
    g.name = entry.label ?? entry.id;
    g.userData = {
      ...(g.userData ?? {}),
      sceneObjectId: entry.id,
      sceneLabel: entry.label ?? null,
      sceneLocked: entry.locked ?? false,
    };
    if (entry.transform?.scale) g.scale.setScalar(entry.transform.scale);
    if (entry.transform?.rotationY !== undefined) g.rotation.y = entry.transform.rotationY;
    if (entry.transform?.position) g.position.set(...entry.transform.position);
    return { entry, group: g };
  });

  // First room-like object acts as spatial container for auto placements
  const container =
    generated.find((x) =>
      x.entry.plan.kind === "room" ||
      x.entry.plan.kind === "conference_room" ||
      x.entry.plan.kind === "vault_room" ||
      x.entry.plan.kind === "office_hq"
    )?.group ?? generated[0]?.group;

  for (const { entry, group } of generated) {
    if (entry.placement?.mode === "auto" && container && group !== container) {
      const pos = resolveAutoPlacement({
        container,
        object: group,
        anchor: entry.placement.anchor,
        seed: plan.seed,
        objectId: entry.id,
      });
      group.position.copy(pos);
    }
    root.add(group);
  }

  return root;
}

export function generateFromPlan(plan: BuildPlan): THREE.Group {
  if (plan.kind === "scene") return generateScene(plan);
  return generateAtomic(plan);
}

export { genRoom, genOfficeHQ, genConferenceRoom, genPodium, genVaultRoom, generateAtomic };
