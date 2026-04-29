/**
 * Preset avatar models for Phase 2 MVP.
 * Uses local assets or placeholders. Swap URLs when final avatar art is ready.
 */

export interface AvatarPreset {
  id: string;
  label: string;
  avatarModelUrl: string;
  thumbnailUrl?: string;
  category: "business" | "creator" | "casual";
}

/** Fallback guest avatar when user has no profile */
export const FALLBACK_AVATAR_URL = "/models/avatars/guest/default-avatar.glb";

/** Fallback thumbnail - use placeholder if no GLB preview */
export const FALLBACK_THUMBNAIL_URL = "https://via.placeholder.com/128/334155/94a3b8?text=Avatar";

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "business-male-01",
    label: "Business Professional",
    avatarModelUrl: "/models/avatars/business/avatar-01.glb",
    thumbnailUrl: "https://via.placeholder.com/128/1e3a5f/60a5fa?text=BP",
    category: "business",
  },
  {
    id: "business-female-01",
    label: "Business Professional (F)",
    avatarModelUrl: "/models/avatars/business/avatar-02.glb",
    thumbnailUrl: "https://via.placeholder.com/128/1e3a5f/a78bfa?text=BP",
    category: "business",
  },
  {
    id: "creator-01",
    label: "Creator Casual",
    avatarModelUrl: "/models/avatars/creator/avatar-01.glb",
    thumbnailUrl: "https://via.placeholder.com/128/14532d/4ade80?text=CC",
    category: "creator",
  },
  {
    id: "creator-02",
    label: "Creator Casual (F)",
    avatarModelUrl: "/models/avatars/creator/avatar-02.glb",
    thumbnailUrl: "https://via.placeholder.com/128/14532d/86efac?text=CC",
    category: "creator",
  },
  {
    id: "casual-01",
    label: "Casual",
    avatarModelUrl: "/models/avatars/casual/avatar-01.glb",
    thumbnailUrl: "https://via.placeholder.com/128/422006/facc15?text=CS",
    category: "casual",
  },
  {
    id: "casual-02",
    label: "Casual (F)",
    avatarModelUrl: "/models/avatars/casual/avatar-02.glb",
    thumbnailUrl: "https://via.placeholder.com/128/422006/fde047?text=CS",
    category: "casual",
  },
];
