import { NextRequest, NextResponse } from "next/server";
import { ptCanAccessProperty, ptDeleteNode, ptGetNode, ptUpdateNode } from "@/lib/property-twin/queries";
import { ptPatchNodeSchema } from "@/lib/property-twin/schemas";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ nodeId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const nodeId = Number((await ctx.params).nodeId);
    if (!Number.isFinite(nodeId)) {
      return NextResponse.json({ error: "Invalid node id" }, { status: 400 });
    }
    const node = await ptGetNode(nodeId);
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(node.propertyId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const parsed = ptPatchNodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const patch: Parameters<typeof ptUpdateNode>[1] = {};
    if (d.zone !== undefined) patch.zone = d.zone;
    if (d.label !== undefined) patch.label = d.label;
    if (d.nodeType !== undefined) patch.nodeType = d.nodeType;
    if (d.sortOrder !== undefined) patch.sortOrder = d.sortOrder;
    if (d.payload !== undefined) patch.payload = d.payload;
    if (d.anchorX !== undefined) patch.anchorX = d.anchorX;
    if (d.anchorY !== undefined) patch.anchorY = d.anchorY;
    if (d.anchorZ !== undefined) patch.anchorZ = d.anchorZ;
    if (d.estimatedCost !== undefined) patch.estimatedCost = d.estimatedCost;
    if (d.estimatedValueLift !== undefined) patch.estimatedValueLift = d.estimatedValueLift;
    if (d.roiPercent !== undefined) patch.roiPercent = d.roiPercent;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const row = await ptUpdateNode(nodeId, patch);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/nodes/nodeId PATCH]", e);
    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const nodeId = Number((await ctx.params).nodeId);
    if (!Number.isFinite(nodeId)) {
      return NextResponse.json({ error: "Invalid node id" }, { status: 400 });
    }
    const node = await ptGetNode(nodeId);
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(node.propertyId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ptDeleteNode(nodeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[property-twin/nodes/nodeId DELETE]", e);
    return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
