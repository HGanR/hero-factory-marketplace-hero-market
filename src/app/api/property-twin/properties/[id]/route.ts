import { NextRequest, NextResponse } from "next/server";
import {
  ptCanAccessProperty,
  ptGetProperty,
  ptUpdateProperty,
} from "@/lib/property-twin/queries";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";
import { ptPatchPropertySchema } from "@/lib/property-twin/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const id = Number((await ctx.params).id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const row = await ptGetProperty(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(id, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/properties/id GET]", e);
    return NextResponse.json({ error: "Failed to load property" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const id = Number((await ctx.params).id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const existing = await ptGetProperty(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessProperty(id, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = ptPatchPropertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const patch: Parameters<typeof ptUpdateProperty>[1] = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.ownerWallet !== undefined) patch.ownerWallet = parsed.data.ownerWallet;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const row = await ptUpdateProperty(id, patch);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/properties/id PATCH]", e);
    return NextResponse.json({ error: "Failed to update property" }, { status: 500 });
  }
}
