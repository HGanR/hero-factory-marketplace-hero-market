import { NextRequest, NextResponse } from "next/server";
import {
  ptCanAccessProperty,
  ptGetProperty,
  ptGeneratePublicShareToken,
  ptUpdateProperty,
} from "@/lib/property-twin/queries";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/property-twin/properties/[id]/presentation-link
 * Body: { rotate?: boolean } — rotate=true issues a new token (invalidates old links).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const id = Number((await ctx.params).id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await ptGetProperty(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const ok = await ptCanAccessProperty(id, auth.userId);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rotate = body.rotate === true;

    let token = existing.publicShareToken ?? null;
    if (rotate || !token) {
      token = ptGeneratePublicShareToken();
      await ptUpdateProperty(id, { publicShareToken: token });
    }

    const xfHost = req.headers.get("x-forwarded-host");
    const host = xfHost?.split(",")[0]?.trim() ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
    const origin = host ? `${proto}://${host}` : new URL(req.url).origin;
    const shareUrl = `${origin}/property-twin/present?propertyId=${id}&share=${encodeURIComponent(token)}`;

    return NextResponse.json({ shareToken: token, shareUrl });
  } catch (e) {
    console.error("[property-twin/presentation-link POST]", e);
    return NextResponse.json({ error: "Failed to create presentation link" }, { status: 500 });
  }
}
