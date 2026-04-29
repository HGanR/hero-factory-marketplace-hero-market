import type { AtomicBuildPlan, ScenePlan } from "./prompt-schema";

const CONTAINER_KINDS: AtomicBuildPlan["kind"][] = [
  "room",
  "conference_room",
  "vault_room",
  "office_hq",
];

export function isScenePlan(plan: Record<string, unknown> | null): plan is ScenePlan {
  return !!plan && plan.kind === "scene" && Array.isArray((plan as { objects?: unknown[] }).objects);
}

export function defaultObjectLabel(kind: AtomicBuildPlan["kind"]): string {
  if (kind === "office_hq") return "Office HQ";
  if (kind === "conference_room") return "Conference Room";
  if (kind === "vault_room") return "Vault Room";
  if (kind === "podium") return "Podium";
  return "Room";
}

export function getContainerIndex(scene: ScenePlan): number {
  const idx = scene.objects.findIndex((o) => CONTAINER_KINDS.includes(o.plan.kind));
  return idx >= 0 ? idx : 0;
}

export function normalizeScene(scene: ScenePlan): ScenePlan {
  const containerIdx = getContainerIndex(scene);
  return {
    ...scene,
    objects: scene.objects.map((o, i) => ({
      ...o,
      label: o.label ?? defaultObjectLabel(o.plan.kind),
      locked: i === containerIdx ? (o.locked ?? true) : o.locked,
    })),
  };
}

export function renameSceneObject(scene: ScenePlan, id: string, label: string): ScenePlan {
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === id ? { ...o, label } : o)),
  };
}

export function removeSceneObject(scene: ScenePlan, id: string): ScenePlan {
  const target = scene.objects.find((o) => o.id === id);
  if (!target || target.locked) return scene;
  const next = scene.objects.filter((o) => o.id !== id);
  return normalizeScene({ ...scene, objects: next.length > 0 ? next : scene.objects });
}

export function reorderSceneObject(scene: ScenePlan, id: string, dir: -1 | 1): ScenePlan {
  const idx = scene.objects.findIndex((o) => o.id === id);
  if (idx < 0) return scene;
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= scene.objects.length) return scene;
  const arr = [...scene.objects];
  [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
  return normalizeScene({ ...scene, objects: arr });
}

export function duplicateSceneObject(scene: ScenePlan, id: string): ScenePlan {
  const src = scene.objects.find((o) => o.id === id);
  if (!src) return scene;
  const copy = {
    ...src,
    id: `${id}_copy_${Date.now()}`,
    label: `${src.label ?? defaultObjectLabel(src.plan.kind)} Copy`,
    locked: false,
  };
  return normalizeScene({ ...scene, objects: [...scene.objects, copy] });
}

export function clearAddons(scene: ScenePlan): ScenePlan {
  const containerIdx = getContainerIndex(scene);
  const keep = scene.objects[containerIdx] ?? scene.objects[0];
  return normalizeScene({ ...scene, objects: [keep] });
}

