import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { maaniaSharedDemos } from "@/lib/db/schema.maania-shared-demos";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const rows = await db.select().from(maaniaSharedDemos).where(eq(maaniaSharedDemos.slug, slug)).limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let payload: unknown;
    let schema: unknown;
    try {
      payload = JSON.parse(row.payloadJson);
    } catch {
      payload = {};
    }
    try {
      schema = JSON.parse(row.schemaJson);
    } catch {
      schema = {};
    }

    return NextResponse.json({
      ok: true,
      kind: row.kind,
      title: row.title,
      payload,
      schema,
      createdAt: row.createdAt,
    });
  } catch (e) {
    console.error("[api/demo/share/slug]", e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}
