import { NextRequest, NextResponse } from "next/server";
import { ptCreateProperty, ptListPropertiesForUser } from "@/lib/property-twin/queries";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";
import { ptCreatePropertySchema } from "@/lib/property-twin/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;
    const rows = await ptListPropertiesForUser(auth.userId);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[property-twin/properties GET]", e);
    return NextResponse.json({ error: "Failed to list properties" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const parsed = ptCreatePropertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const row = await ptCreateProperty({
      name: parsed.data.name.trim(),
      slug: parsed.data.slug ?? null,
      description: parsed.data.description ?? null,
      ownerWallet: parsed.data.ownerWallet ?? null,
      ownerUserId: auth.userId,
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/properties POST]", e);
    return NextResponse.json({ error: "Failed to create property" }, { status: 500 });
  }
}
