import { NextRequest, NextResponse } from "next/server";
import { ptCreateNode, ptGetProperty, ptListNodes, ptCanAccessProperty } from "@/lib/property-twin/queries";
import { ptCreateNodeSchema } from "@/lib/property-twin/schemas";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const propertyId = Number((await ctx.params).id);
    if (!Number.isFinite(propertyId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const prop = await ptGetProperty(propertyId);
    if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(propertyId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await ptListNodes(propertyId);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[property-twin/nodes GET]", e);
    return NextResponse.json({ error: "Failed to list nodes" }, { status: 500 });
  }
}

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
    const parsed = ptCreateNodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const row = await ptCreateNode({
      propertyId,
      zone: d.zone,
      label: d.label,
      nodeType: d.nodeType,
      sortOrder: d.sortOrder,
      payload: d.payload,
      anchorX: d.anchorX,
      anchorY: d.anchorY,
      anchorZ: d.anchorZ,
      estimatedCost: d.estimatedCost,
      estimatedValueLift: d.estimatedValueLift,
      roiPercent: d.roiPercent,
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/nodes POST]", e);
    return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
  }
}
