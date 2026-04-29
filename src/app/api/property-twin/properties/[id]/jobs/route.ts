import { NextRequest, NextResponse } from "next/server";
import { ptCreateJob, ptGetProperty, ptListJobs, ptCanAccessProperty } from "@/lib/property-twin/queries";
import { ptCreateJobSchema } from "@/lib/property-twin/schemas";
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
    const rows = await ptListJobs(propertyId);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[property-twin/jobs GET]", e);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
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
    const parsed = ptCreateJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { mode, status, inputAssetIds } = parsed.data;

    const row = await ptCreateJob({
      propertyId,
      mode,
      status,
      inputAssetIds,
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/jobs POST]", e);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
