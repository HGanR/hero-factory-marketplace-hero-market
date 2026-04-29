import {
  dedupeAvatarItems,
  sortAvatarItems,
  renumberSortOrder,
  applyLimitWithTruncation,
} from "./merge";
import type { MeetAvatarNftItem } from "./types";
import { HERO_1155_CONTRACT, HERO_1155_CHAIN_ID } from "./constants";

const heroC = HERO_1155_CONTRACT.toLowerCase();

function item(p: Partial<MeetAvatarNftItem> & Pick<MeetAvatarNftItem, "id" | "source" | "name">): MeetAvatarNftItem {
  return {
    chainId: HERO_1155_CHAIN_ID,
    walletAddress: "0x1",
    walletType: "evm",
    contractAddress: heroC,
    tokenId: "0",
    collectionName: null,
    image: null,
    animationUrl: null,
    externalUrl: null,
    description: null,
    balance: "1",
    isHero: false,
    heroSlot: null,
    selectable: false,
    selectableReason: null,
    sortOrder: 0,
    ...p,
  } as MeetAvatarNftItem;
}

describe("dedupeAvatarItems", () => {
  it("prefers Hero-enriched row for same chain+contract+tokenId", () => {
    const marketplace = item({
      id: "m",
      source: "marketplace",
      name: "M",
      image: "https://a.png",
      isHero: false,
      selectable: true,
      tokenId: "0",
      sortOrder: 1,
    });
    const hero = item({
      id: "h",
      source: "hero_erc1155",
      name: "Hero #0",
      image: "https://b.png",
      isHero: true,
      selectable: true,
      tokenId: "0",
      sortOrder: 2,
    });
    const out = dedupeAvatarItems([marketplace, hero]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("hero_erc1155");
  });

  it("prefers row with image when duplicate keys", () => {
    const a = item({
      id: "a",
      source: "marketplace",
      name: "A",
      image: null,
      tokenId: "1",
      contractAddress: "0xdead",
      selectable: false,
      sortOrder: 0,
    });
    const b = item({
      id: "b",
      source: "marketplace",
      name: "B",
      image: "https://x.png",
      tokenId: "1",
      contractAddress: "0xdead",
      selectable: true,
      sortOrder: 1,
    });
    const out = dedupeAvatarItems([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].image).toBe("https://x.png");
  });
});

describe("sortAvatarItems + applyLimitWithTruncation", () => {
  it("sorts selectable Hero first, then selectable other, then non-selectable", () => {
    const items: MeetAvatarNftItem[] = [
      item({
        id: "x",
        source: "marketplace",
        name: "X",
        image: "https://x.png",
        isHero: false,
        selectable: true,
        tokenId: "9",
        contractAddress: "0x9",
        sortOrder: 5,
      }),
      item({
        id: "h",
        source: "hero_erc1155",
        name: "H",
        image: "https://h.png",
        isHero: true,
        selectable: true,
        tokenId: "0",
        sortOrder: 9,
      }),
      item({
        id: "bad",
        source: "marketplace",
        name: "Bad",
        image: null,
        isHero: false,
        selectable: false,
        tokenId: "8",
        contractAddress: "0x8",
        sortOrder: 1,
      }),
    ];
    const sorted = sortAvatarItems(items);
    expect(sorted[0].isHero).toBe(true);
    expect(sorted[1].selectable).toBe(true);
    expect(sorted[2].selectable).toBe(false);
  });

  it("truncates and emits warning", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      item({
        id: `i${i}`,
        source: "marketplace",
        name: `N${i}`,
        image: "https://x.png",
        selectable: true,
        tokenId: `${i}`,
        contractAddress: `0x${i}`,
        sortOrder: i,
      })
    );
    const { items: lim, truncated, warning } = applyLimitWithTruncation(items, 2);
    expect(lim).toHaveLength(2);
    expect(truncated).toBe(true);
    expect(warning?.code).toBe("results_truncated");
  });
});

describe("renumberSortOrder", () => {
  it("assigns contiguous sortOrder", () => {
    const items = [
      item({ id: "a", source: "marketplace", name: "a", sortOrder: 99 }),
      item({ id: "b", source: "marketplace", name: "b", sortOrder: 1 }),
    ];
    const out = renumberSortOrder(items);
    expect(out.map((x) => x.sortOrder)).toEqual([0, 1]);
  });
});
