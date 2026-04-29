/**
 * Types for venue interior nodes (World Editor / API).
 */
export type VenueNodeType =
  | "voice_room"
  | "event_stage"
  | "seminar_room"
  | "chat_room"
  | "concert_hall"
  | "custom";

export type VenueNodeAccessType = "public" | "private" | "token_gated" | "owner_only";

export interface VenueInteriorNode {
  id: string;
  worldId: string;
  placementId: string;
  title: string;
  slug: string | null;
  nodeType: VenueNodeType;
  description: string | null;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  isActive: boolean;
  accessType: VenueNodeAccessType;
  roomId: string;
  createdAt: string;
  updatedAt: string;
}
