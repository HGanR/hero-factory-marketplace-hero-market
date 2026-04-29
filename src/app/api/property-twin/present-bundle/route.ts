import { NextRequest, NextResponse } from "next/server";
import { ptGetProperty, ptListJobs, ptListNodes } from "@/lib/property-twin/queries";
import { propertyTwinResolvePresentationAccess } from "@/lib/property-twin/auth-guard";
import type { PtPropertyRow } from "@/lib/property-twin/schema";

export const runtime = "nodejs";

function sanitizeProperty(p: PtPropertyRow) {
  const { publicShareToken: _t, ...rest } = p;
  return rest;
}

/**
 * GET /api/property-twin/present-bundle?propertyId=1&share=...
 * Single read for client presentation: session owner, or valid share token.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = Number(searchParams.get("propertyId"));
    const share = searchParams.get("share")?.trim() ?? null;
    if (!Number.isFinite(propertyId)) {
      return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
    }

    const resolved = await propertyTwinResolvePresentationAccess(propertyId, share);
    if (resolved instanceof NextResponse) return resolved;

    const [prop, jobs, nodes] = await Promise.all([
      ptGetProperty(propertyId),
      ptListJobs(propertyId),
      ptListNodes(propertyId),
    ]);
    if (!prop) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      property: sanitizeProperty(prop),
      jobs,
      nodes,
    });
  } catch (e) {
    console.error("[property-twin/present-bundle GET]", e);
    return NextResponse.json({ error: "Failed to load presentation" }, { status: 500 });
  }
}
