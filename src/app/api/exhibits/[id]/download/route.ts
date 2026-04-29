import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exhibits } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import fs from "fs/promises";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const db = await getDb();
    const rows = await db.select().from(exhibits).where(eq(exhibits.id, id)).limit(1);
    const exhibit = rows[0];
    if (!exhibit) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Exhibit not found" } }, { status: 404 });
    }

    const bytes = await fs.readFile(String(exhibit.storagePath));
    return new NextResponse(bytes, {
      headers: {
        "content-type": exhibit.fileType || "application/octet-stream",
        "content-disposition": `attachment; filename="${exhibit.fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Download exhibit error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to download exhibit" } },
      { status: 500 }
    );
  }
}
