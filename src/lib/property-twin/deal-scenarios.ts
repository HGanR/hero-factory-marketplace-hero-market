/**
 * Client-side deal intelligence — deterministic heuristics until comps / MLS APIs exist.
 * Tune multipliers and catalog values as you calibrate with agents.
 */

export type ReadinessTier = "minimal" | "good" | "strong";

export type ImprovementPreset = "staged" | "modern" | "luxury";

export type UpgradeRoiRow = {
  id: string;
  label: string;
  estimatedCost: number;
  estimatedValueLift: number;
  roiPercent: number;
  timing: "before_listing" | "after_purchase";
  recommended: "before_listing" | "after_purchase" | "either";
};

type BaseUpgradeDef = Pick<UpgradeRoiRow, "id" | "label" | "timing" | "recommended"> & {
  costMid: number;
  liftMid: number;
};

const BASE_UPGRADES: BaseUpgradeDef[] = [
  {
    id: "kitchen",
    label: "Kitchen refresh (counters + fixtures)",
    costMid: 8_000,
    liftMid: 18_000,
    timing: "before_listing",
    recommended: "before_listing",
  },
  {
    id: "landscape",
    label: "Curb appeal & landscaping",
    costMid: 4_500,
    liftMid: 9_000,
    timing: "before_listing",
    recommended: "before_listing",
  },
  {
    id: "staging",
    label: "Professional staging",
    costMid: 3_200,
    liftMid: 8_500,
    timing: "before_listing",
    recommended: "before_listing",
  },
  {
    id: "bath",
    label: "Primary bath update",
    costMid: 12_000,
    liftMid: 22_000,
    timing: "before_listing",
    recommended: "either",
  },
  {
    id: "flooring",
    label: "Flooring refresh (main living)",
    costMid: 9_500,
    liftMid: 14_000,
    timing: "before_listing",
    recommended: "before_listing",
  },
  {
    id: "smart",
    label: "Smart home / efficiency bundle",
    costMid: 2_800,
    liftMid: 5_000,
    timing: "after_purchase",
    recommended: "after_purchase",
  },
];

function tierMultiplier(tier: ReadinessTier): number {
  if (tier === "strong") return 1.08;
  if (tier === "good") return 1.0;
  return 0.92;
}

function keywordBoosts(nodeLabels: string[], text: string): number {
  const t = `${nodeLabels.join(" ")} ${text}`.toLowerCase();
  let m = 1;
  if (/(kitchen|galley|cabinet)/i.test(t)) m += 0.06;
  if (/(bath|primary|master)/i.test(t)) m += 0.04;
  if (/(yard|lawn|landscape|curb)/i.test(t)) m += 0.05;
  if (/(floor|hardwood|tile)/i.test(t)) m += 0.04;
  return Math.min(m, 1.2);
}

export function readinessTierFromAssetKinds(kinds: Set<string>): ReadinessTier {
  const essentialCount = ["exterior", "interior", "floor_plan"].filter((k) => kinds.has(k)).length;
  const bonusCount = ["landscape", "video"].filter((k) => kinds.has(k)).length;
  if (essentialCount >= 2 && bonusCount >= 1) return "strong";
  if (essentialCount >= 2) return "good";
  return "minimal";
}

export function buildRoiRows(
  assetKinds: Set<string>,
  nodeLabels: string[],
  readinessTier: ReadinessTier,
  siteNotes: string
): UpgradeRoiRow[] {
  const mult = tierMultiplier(readinessTier) * keywordBoosts(nodeLabels, siteNotes);
  const rows: UpgradeRoiRow[] = [];

  for (const u of BASE_UPGRADES) {
    let include = true;
    if (u.id === "landscape" && !assetKinds.has("landscape") && !assetKinds.has("exterior")) {
      include = false;
    }
    if (u.id === "kitchen" && assetKinds.has("interior")) {
      /* still show — interior photos often include kitchen */
    }
    if (!include) continue;

    const estimatedCost = Math.round(u.costMid * mult);
    const estimatedValueLift = Math.round(u.liftMid * mult);
    const roiPercent = Math.round(
      ((estimatedValueLift - estimatedCost) / Math.max(estimatedCost, 1)) * 100
    );
    rows.push({
      id: u.id,
      label: u.label,
      estimatedCost,
      estimatedValueLift,
      roiPercent,
      timing: u.timing,
      recommended: u.recommended,
    });
  }

  return rows.sort((a, b) => b.roiPercent - a.roiPercent);
}

export function aggregateRoi(rows: UpgradeRoiRow[]): {
  totalCost: number;
  totalLift: number;
  blendedRoiPercent: number;
} {
  const totalCost = rows.reduce((s, r) => s + r.estimatedCost, 0);
  const totalLift = rows.reduce((s, r) => s + r.estimatedValueLift, 0);
  const blendedRoiPercent =
    totalCost > 0 ? Math.round(((totalLift - totalCost) / totalCost) * 100) : 0;
  return { totalCost, totalLift, blendedRoiPercent };
}

export function describeBuyerScenario(
  listPrice: number,
  offerPrice: number,
  repairCredit: number,
  upgradeBudget: number
): string {
  const effective = offerPrice - repairCredit;
  const allIn = effective + upgradeBudget;
  const vsList = listPrice > 0 ? Math.round(((offerPrice - listPrice) / listPrice) * 1000) / 10 : 0;
  return [
    `Versus list ($${listPrice.toLocaleString()}): offer is ${vsList >= 0 ? "+" : ""}${vsList}% (${offerPrice.toLocaleString()}).`,
    `After repair credit ($${repairCredit.toLocaleString()}): effective ${effective.toLocaleString()}.`,
    `If buyer funds ~$${upgradeBudget.toLocaleString()} in upgrades post-close, all-in ~$${allIn.toLocaleString()} (excluding financing & closing).`,
  ].join("\n");
}

export function buildListingPackageMarkdown(input: {
  propertyName: string;
  propertyId: number;
  siteNotes: string;
  readinessTier: ReadinessTier;
  assetKinds: string[];
  nodeCount: number;
  anchoredNodeCount?: number;
  twinPath: string;
  roiRows: UpgradeRoiRow[];
  vendorNote?: string;
}): string {
  const { totalCost, totalLift, blendedRoiPercent } = aggregateRoi(input.roiRows);
  const lines = [
    `# Listing package — ${input.propertyName}`,
    ``,
    `**Property ID:** ${input.propertyId}`,
    `**3D twin:** ${input.twinPath}`,
    ``,
    `## Summary`,
    input.siteNotes.trim() || "_No site notes yet._",
    ``,
    `## Coverage`,
    `- Asset types on file: ${input.assetKinds.length ? input.assetKinds.join(", ") : "none yet"}`,
    `- Planning nodes: ${input.nodeCount}`,
    ...(input.anchoredNodeCount != null && input.anchoredNodeCount > 0
      ? [`- Scene-anchored nodes: **${input.anchoredNodeCount}**`]
      : []),
    `- Readiness tier: **${input.readinessTier}**`,
    ``,
    `## ROI snapshot (illustrative)`,
    `- Combined selected scenarios ~$${totalCost.toLocaleString()} invest → ~$${totalLift.toLocaleString()} perceived lift (blended ROI ~${blendedRoiPercent}%).`,
    ``,
    input.roiRows
      .slice(0, 6)
      .map(
        (r) =>
          `- **${r.label}** — ~$${r.estimatedCost.toLocaleString()} cost → ~$${r.estimatedValueLift.toLocaleString()} lift (${r.roiPercent}% ROI), ${r.recommended.replace(/_/g, " ")}`
      )
      .join("\n"),
    ``,
    `## Vendors`,
    input.vendorNote ?? "_Run vendor search in Property Twin and attach preferred pros._",
    ``,
    `_Generated by Hero Market Property Twin — numbers are directional until tied to comps._`,
  ];
  return lines.join("\n");
}

export function propertyDnaScore(input: {
  readinessTier: ReadinessTier;
  assetKinds: Set<string>;
  nodeCount: number;
  hasTwinOutput: boolean;
}): { score: number; highlights: string[] } {
  let score = 52;
  const h: string[] = [];
  if (input.readinessTier === "strong") {
    score += 14;
    h.push("Strong media coverage for listing.");
  } else if (input.readinessTier === "good") {
    score += 8;
    h.push("Good baseline coverage.");
  }
  if (input.assetKinds.has("floor_plan")) {
    score += 6;
    h.push("Floor plan aids buyer confidence.");
  }
  if (input.assetKinds.has("video")) {
    score += 5;
    h.push("Walkthrough/video supports remote buyers.");
  }
  if (input.nodeCount >= 3) {
    score += 5;
    h.push("Planning graph shows upgrade intent.");
  }
  if (input.hasTwinOutput) {
    score += 10;
    h.push("3D twin output available — differentiated showings.");
  }
  score = Math.min(100, Math.max(35, score));
  return { score, highlights: h };
}
