export type NPCRole = "secretary" | "avatar" | "guide" | "voice_agent" | "executive_admin";
export type Mood = "neutral" | "happy" | "busy" | "concerned" | "excited" | "formal";
export type ResponseSource = "rule" | "knowledge" | "llm";
export type Sentiment = "positive" | "neutral" | "negative";

export interface PersonalityTraits {
  friendliness: number;
  formality: number;
  verbosity: number;
  humor: number;
  patience: number;
  expertise: number;
}

export interface KnowledgeEntry {
  topic: string;
  keywords: string[];
  content: string;
  priority: number;
  category: "world" | "business" | "product" | "navigation" | "general";
}

export interface NPCProfile {
  id: string;
  /** Same as `id` — public stable key (`npcId` column). Present for clients that only read `npcId`. */
  npcId?: string;
  name: string;
  role: NPCRole;
  title?: string | null;
  avatarEmoji: string;
  voiceStyle?: "professional" | "friendly" | "authoritative" | "warm" | null;
  language?: string | null;
  greeting?: string | null;
  farewell?: string | null;
  worldId?: string | null;
  buildingId?: string | null;
  floor?: number | null;
  personality: PersonalityTraits;
  mood: Mood;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface NPCResponse {
  text: string;
  mood: Mood;
  source: ResponseSource;
  intent: string;
  suggestions: string[];
}
