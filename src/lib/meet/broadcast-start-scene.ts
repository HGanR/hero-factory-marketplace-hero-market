import {
  getDefaultSceneConfig,
  legacyMeetingLayoutToSceneLayout,
  mapBroadcastSceneToLiveKitLayout,
  validateSceneConfig,
  type BroadcastSceneConfig,
  type BroadcastSceneSnapshot,
} from "@/lib/meet/broadcast-scene";
import { getScenePresetForUser } from "@/lib/meet/broadcast-scene-presets";

export type ResolveBroadcastStartSceneInput = {
  userId: number;
  scenePresetId?: number | null;
  sceneConfig?: unknown;
  legacyLayoutMode?: string | null;
};

export type ResolveBroadcastStartSceneResult = {
  liveKitLayout: "grid" | "speaker" | "single-speaker";
  snapshot: BroadcastSceneSnapshot;
  resolveWarnings: string[];
};

export async function resolveBroadcastStartScene(
  input: ResolveBroadcastStartSceneInput
): Promise<ResolveBroadcastStartSceneResult> {
  const resolveWarnings: string[] = [];
  let config: BroadcastSceneConfig = getDefaultSceneConfig();
  let appliedPresetId: number | null = null;
  let appliedPresetName: string | null = null;

  if (input.scenePresetId != null && Number.isFinite(Number(input.scenePresetId))) {
    const preset = await getScenePresetForUser(input.userId, Math.floor(Number(input.scenePresetId)));
    if (preset) {
      const parsed = validateSceneConfig(preset.configJson);
      if (parsed.ok) {
        config = parsed.config;
        appliedPresetId = preset.id;
        appliedPresetName = preset.name;
      } else {
        resolveWarnings.push(`Scene preset ${input.scenePresetId} has invalid configJson`);
      }
    } else {
      resolveWarnings.push(`Scene preset ${input.scenePresetId} not found`);
    }
  }

  if (input.sceneConfig != null) {
    const parsed = validateSceneConfig(input.sceneConfig);
    if (parsed.ok) {
      config = parsed.config;
    } else {
      const err = new Error(parsed.errors.join("; "));
      (err as Error & { code?: string }).code = "broadcast_scene_invalid";
      throw err;
    }
  }

  if (appliedPresetId == null && input.sceneConfig == null && input.legacyLayoutMode) {
    config = {
      ...config,
      layoutMode: legacyMeetingLayoutToSceneLayout(String(input.legacyLayoutMode)),
    };
  }

  const lk = mapBroadcastSceneToLiveKitLayout(config.layoutMode);
  resolveWarnings.push(...lk.egressMappingWarnings);

  const snapshot: BroadcastSceneSnapshot = {
    ...config,
    appliedPresetId,
    appliedPresetName,
  };

  return { liveKitLayout: lk.liveKitLayout, snapshot, resolveWarnings };
}
