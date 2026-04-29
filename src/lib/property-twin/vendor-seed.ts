/**
 * Seed catalog for vendor discovery. Replace with DB or external index later.
 * Ranking rules are returned alongside results for transparency.
 */

export type VendorRecord = {
  id: string;
  name: string;
  category: string;
  region: string;
  rating: number;
  verified: boolean;
  tags: string[];
};

export const VENDOR_SEED: VendorRecord[] = [
  {
    id: "scan-coastal",
    name: "Coastal LiDAR & Scan Co.",
    category: "3D capture",
    region: "US-CA",
    rating: 4.7,
    verified: true,
    tags: ["photogrammetry", "drone", "as-built"],
  },
  {
    id: "gaussian-labs",
    name: "Gaussian Labs",
    category: "reconstruction",
    region: "US-TX",
    rating: 4.5,
    verified: true,
    tags: ["gaussian splat", "neural", "interior"],
  },
  {
    id: "title-tech",
    name: "TitleTech Partners",
    category: "title & records",
    region: "US-FL",
    rating: 4.2,
    verified: false,
    tags: ["title search", "lien", "recording"],
  },
  {
    id: "struct-eng",
    name: "Structura Engineering",
    category: "structural",
    region: "US-NY",
    rating: 4.8,
    verified: true,
    tags: ["seismic", "retrofit", "commercial"],
  },
  {
    id: "green-site",
    name: "GreenSite Surveyors",
    category: "landscape",
    region: "US-WA",
    rating: 4.4,
    verified: true,
    tags: ["topo", "environmental", "permits"],
  },
];

export type ScoreBreakdown = { rule: string; points: number };

export type RankedVendor = VendorRecord & {
  score: number;
  breakdown: ScoreBreakdown[];
};

/** Transparent ranking: documented additive rules (not ML). */
export function rankVendors(
  q: string,
  opts?: { region?: string; category?: string }
): RankedVendor[] {
  const query = q.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);

  const scored = VENDOR_SEED.map((v) => {
    const breakdown: ScoreBreakdown[] = [];
    let score = 0;

    if (opts?.region && v.region.toLowerCase() === opts.region.toLowerCase()) {
      const pts = 2;
      score += pts;
      breakdown.push({ rule: "region_match", points: pts });
    }

    if (v.verified) {
      const pts = 1;
      score += pts;
      breakdown.push({ rule: "verified_vendor", points: pts });
    }

    const ratingPts = v.rating * 0.5;
    score += ratingPts;
    breakdown.push({ rule: "rating_x_0.5", points: Math.round(ratingPts * 100) / 100 });

    const hay = `${v.name} ${v.category} ${v.tags.join(" ")}`.toLowerCase();
    for (const w of words) {
      if (w.length >= 2 && hay.includes(w)) {
        const pts = 1.5;
        score += pts;
        breakdown.push({ rule: `keyword:"${w}"`, points: pts });
      }
    }

    if (opts?.category && v.category.toLowerCase().includes(opts.category.toLowerCase())) {
      const pts = 1.2;
      score += pts;
      breakdown.push({ rule: "category_match", points: pts });
    }

    return { ...v, score, breakdown };
  });

  return scored.sort((a, b) => b.score - a.score);
}
