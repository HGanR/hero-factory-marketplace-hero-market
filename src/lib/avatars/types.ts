/**
 * Avatar types for Phase 2.
 */

export type AvatarSourceType = "preset" | "uploaded" | "generated";
export type AvatarStatus = "draft" | "ready";

export interface AvatarProfile {
  id: string;
  userId: number;
  displayName: string | null;
  avatarModelUrl: string;
  thumbnailUrl: string | null;
  configJson: Record<string, unknown> | null;
  sourceType: AvatarSourceType;
  version: number;
  isDefault: boolean;
  status: AvatarStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomAvatarIdentity {
  userId: string;
  displayName: string;
  avatarModelUrl: string;
  thumbnailUrl?: string | null;
  isFallback: boolean;
}
