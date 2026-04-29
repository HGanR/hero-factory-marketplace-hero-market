import type { MeetAvatarNftItem, MeetAvatarNftWarning, MeetAvatarNftWarningCode } from "./types";

function dedupeKey(item: MeetAvatarNftItem): string {
  const ch = item.chainId ?? "x";
  const c = (item.contractAddress ?? "").toLowerCase();
  const t = item.tokenId ?? "";
  return `${ch}:${c}:${t}`;
}

function scoreForDedupeWinner(a: MeetAvatarNftItem, b: MeetAvatarNftItem): MeetAvatarNftItem {
  const imgA = a.image ? 1 : 0;
  const imgB = b.image ? 1 : 0;
  if (imgA !== imgB) return imgA > imgB ? a : b;
  const heroA = a.source === "hero_erc1155" ? 1 : 0;
  const heroB = b.source === "hero_erc1155" ? 1 : 0;
  if (heroA !== heroB) return heroA > heroB ? a : b;
  return a.sortOrder <= b.sortOrder ? a : b;
}

/**
 * Dedupe by chainId+contract+tokenId; prefer valid image; prefer Hero-enriched row for Hero contract.
 */
export function dedupeAvatarItems(items: MeetAvatarNftItem[]): MeetAvatarNftItem[] {
  const map = new Map<string, MeetAvatarNftItem>();
  for (const item of items) {
    const k = dedupeKey(item);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, item);
      continue;
    }
    map.set(k, scoreForDedupeWinner(existing, item));
  }
  return Array.from(map.values());
}

function sortRank(item: MeetAvatarNftItem): number {
  const heroSel = item.isHero && item.selectable ? 0 : item.selectable ? 1 : 2;
  return heroSel * 10000 + item.sortOrder;
}

export function sortAvatarItems(items: MeetAvatarNftItem[]): MeetAvatarNftItem[] {
  return [...items].sort((a, b) => {
    const ra = sortRank(a);
    const rb = sortRank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function applyLimitWithTruncation(
  items: MeetAvatarNftItem[],
  limit: number
): { items: MeetAvatarNftItem[]; truncated: boolean; warning: MeetAvatarNftWarning | null } {
  if (items.length <= limit) {
    return { items, truncated: false, warning: null };
  }
  return {
    items: items.slice(0, limit),
    truncated: true,
    warning: {
      code: "results_truncated" as MeetAvatarNftWarningCode,
      message: `Results truncated to ${limit} items`,
      source: "marketplace",
    },
  };
}

/** Re-assign sortOrder after sort for stable display order. */
export function renumberSortOrder(items: MeetAvatarNftItem[]): MeetAvatarNftItem[] {
  return items.map((it, i) => ({ ...it, sortOrder: i }));
}
