/**
 * localStorage-based Knowledge Base for Meridian Tower avatars.
 */

export interface KBEntry {
  id: string;
  title: string;
  content: string;
  tag: "note" | "document" | "task" | "link";
  createdAt: string;
  updatedAt: string;
}

const PREFIX = "troo_meridian_kb_";

export function loadAvatarKB(avatarId: string): KBEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + avatarId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAvatarKB(avatarId: string, entries: KBEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + avatarId, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export function generateKBId(): string {
  return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
