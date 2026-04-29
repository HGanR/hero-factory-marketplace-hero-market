/**
 * Resolve avatar identity for room entry.
 * Returns avatar from profile or fallback.
 */

import type { RoomAvatarIdentity } from "./types";
import { FALLBACK_AVATAR_URL, FALLBACK_THUMBNAIL_URL } from "./avatar-presets";

export function buildRoomAvatarIdentity(opts: {
  userId: number | string;
  displayName: string;
  avatarModelUrl: string;
  thumbnailUrl?: string | null;
  isFallback?: boolean;
}): RoomAvatarIdentity {
  return {
    userId: String(opts.userId),
    displayName: opts.displayName,
    avatarModelUrl: opts.avatarModelUrl,
    thumbnailUrl: opts.thumbnailUrl ?? null,
    isFallback: opts.isFallback ?? false,
  };
}

export function getFallbackAvatarIdentity(userId?: number | string, displayName?: string): RoomAvatarIdentity {
  return buildRoomAvatarIdentity({
    userId: userId ?? "guest",
    displayName: displayName ?? "Guest",
    avatarModelUrl: FALLBACK_AVATAR_URL,
    thumbnailUrl: FALLBACK_THUMBNAIL_URL,
    isFallback: true,
  });
}
