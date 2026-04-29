/**
 * Reusable guest identity for lower-thirds and prep (no binary uploads in this phase).
 */

import { isAllowedOverlayUrl } from "./broadcast-overlays";
import type { BroadcastLowerThird } from "./broadcast-overlays";

export type BroadcastGuestCard = {
  id: string;
  displayName: string;
  title?: string | null;
  company?: string | null;
  shortBio?: string | null;
  accentHex?: string | null;
  avatarUrl?: string | null;
  socialHandle?: string | null;
  websiteUrl?: string | null;
};

const NAME_MAX = 120;
const TITLE_MAX = 160;
const COMPANY_MAX = 160;
const BIO_MAX = 400;
const HANDLE_MAX = 120;
const URL_MAX = 2048;

function trim(v: unknown, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function isHex(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^#?[0-9A-Fa-f]{6}$/.test(s);
}

function normHex(s: string): string {
  return s.startsWith("#") ? s : `#${s}`;
}

export type BroadcastGuestCardPackJson = {
  cards: BroadcastGuestCard[];
};

export function validateBroadcastGuestCard(input: unknown, idFallback: string): { ok: true; card: BroadcastGuestCard } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input == null || typeof input !== "object") return { ok: false, errors: ["card must be an object"] };
  const o = input as Record<string, unknown>;
  const displayName = trim(o.displayName, NAME_MAX);
  if (!displayName) errors.push("displayName required");
  const idRaw = trim(o.id, 64);
  const id = idRaw || idFallback;
  const title = trim(o.title, TITLE_MAX);
  const company = trim(o.company, COMPANY_MAX);
  const shortBio = trim(o.shortBio, BIO_MAX);
  const socialHandle = trim(o.socialHandle, HANDLE_MAX);
  let accentHex: string | null = null;
  if (o.accentHex != null && o.accentHex !== "") {
    if (!isHex(o.accentHex)) errors.push("invalid accentHex");
    else accentHex = normHex((o.accentHex as string).trim());
  }
  let avatarUrl: string | null = null;
  const av = trim(o.avatarUrl, URL_MAX);
  if (av && !isAllowedOverlayUrl(av)) errors.push("invalid avatarUrl");
  else avatarUrl = av;
  let websiteUrl: string | null = null;
  const wu = trim(o.websiteUrl, URL_MAX);
  if (wu && !isAllowedOverlayUrl(wu)) errors.push("invalid websiteUrl");
  else websiteUrl = wu;
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    card: {
      id,
      displayName: displayName!,
      title,
      company,
      shortBio,
      accentHex,
      avatarUrl,
      socialHandle,
      websiteUrl,
    },
  };
}

export function validateBroadcastGuestCardPackJson(input: unknown): { ok: true; data: BroadcastGuestCardPackJson } | { ok: false; errors: string[] } {
  if (input == null || typeof input !== "object") return { ok: false, errors: ["body must be object"] };
  const o = input as Record<string, unknown>;
  const raw = o.cards;
  if (!Array.isArray(raw)) return { ok: false, errors: ["cards must be an array"] };
  if (raw.length > 50) return { ok: false, errors: ["max 50 cards per pack"] };
  const cards: BroadcastGuestCard[] = [];
  let i = 0;
  for (const c of raw) {
    const r = validateBroadcastGuestCard(c, `card_${i}`);
    if (!r.ok) return { ok: false, errors: r.errors.map((e) => `[${i}] ${e}`) };
    cards.push(r.card);
    i += 1;
  }
  return { ok: true, data: { cards } };
}

/** Map guest card → lower-third fields (explicit operator apply). */
export function buildLowerThirdFromGuestCard(
  card: BroadcastGuestCard,
  base: Pick<BroadcastLowerThird, "visible" | "position">
): BroadcastLowerThird {
  const subParts = [card.title, card.company].filter(Boolean) as string[];
  const sub = subParts.join(" · ") || card.shortBio?.slice(0, 180) || undefined;
  return {
    ...base,
    visible: true,
    headline: card.displayName.slice(0, 120),
    subheadline: sub?.slice(0, 180),
    accentHex: card.accentHex ?? base.accentHex,
  };
}

export function summarizeGuestCard(card: BroadcastGuestCard): string {
  return [card.displayName, card.title].filter(Boolean).join(" — ");
}
