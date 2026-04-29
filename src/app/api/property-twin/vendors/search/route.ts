import { NextRequest, NextResponse } from "next/server";
import { rankVendors } from "@/lib/property-twin/vendor-seed";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";

/**
 * GET /api/property-twin/vendors/search?q=...&region=US-CA&category=...
 * Returns ranked vendors with transparent score breakdown (rules documented in vendor-seed).
 */
export async function GET(req: NextRequest) {
  const auth = await propertyTwinRequireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const region = searchParams.get("region") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const ranked = rankVendors(q, { region, category });

  return NextResponse.json({
    query: { q, region: region ?? null, category: category ?? null },
    rankingRules: [
      { id: "region_match", description: "+2 when vendor.region equals query region", points: 2 },
      { id: "verified_vendor", description: "+1 when vendor.verified", points: 1 },
      { id: "rating_x_0.5", description: "+ rating * 0.5", points: "variable" },
      { id: "keyword", description: "+1.5 per query word (len≥2) found in name/category/tags", points: 1.5 },
      { id: "category_match", description: "+1.2 when vendor.category contains query category", points: 1.2 },
    ],
    results: ranked,
  });
}
