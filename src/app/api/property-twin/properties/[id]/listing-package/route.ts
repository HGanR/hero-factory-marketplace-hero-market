import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ptGetProperty,
  ptListAssets,
  ptListJobs,
  ptListNodes,
  ptCanAccessProperty,
} from "@/lib/property-twin/queries";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";
import {
  buildListingPackageMarkdown,
  buildRoiRows,
  readinessTierFromAssetKinds,
} from "@/lib/property-twin/deal-scenarios";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    siteNotes: z.string().max(20_000).optional(),
    vendorNote: z.string().max(4_000).optional(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const propertyId = Number((await ctx.params).id);
    if (!Number.isFinite(propertyId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const prop = await ptGetProperty(propertyId);
    if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(propertyId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [assets, nodes, jobs] = await Promise.all([
      ptListAssets(propertyId),
      ptListNodes(propertyId),
      ptListJobs(propertyId),
    ]);

    const kinds = new Set(assets.map((a) => a.kind));
    const tier = readinessTierFromAssetKinds(kinds);
    const siteNotes =
      parsed.data.siteNotes ?? prop.description ?? "";
    const roiRows = buildRoiRows(
      kinds,
      nodes.map((n) => n.label),
      tier,
      siteNotes
    );
    const anchored = nodes.filter(
      (n) => n.anchorX != null && n.anchorY != null && n.anchorZ != null
    ).length;

    const xfHost = req.headers.get("x-forwarded-host");
    const host = xfHost?.split(",")[0]?.trim() ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
    const origin = host ? `${proto}://${host}` : new URL(req.url).origin;

    const markdown = buildListingPackageMarkdown({
      propertyName: prop.name,
      propertyId: prop.id,
      siteNotes,
      readinessTier: tier,
      assetKinds: Array.from(kinds),
      nodeCount: nodes.length,
      anchoredNodeCount: anchored,
      twinPath: `${origin}/property-twin`,
      roiRows,
      vendorNote: parsed.data.vendorNote,
    });

    return NextResponse.json({
      format: "markdown" as const,
      markdown,
      propertyId: prop.id,
    });
  } catch (e) {
    console.error("[property-twin/listing-package POST]", e);
    return NextResponse.json({ error: "Failed to build listing package" }, { status: 500 });
  }
}
