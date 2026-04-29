import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { trustAssets, trusts } from "@/lib/db/schema";

/** POST: Save QR code config to workspace (trust) */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : null;
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const db = await getDb();

    const trustRows = await db
      .select({ id: trusts.id, userId: trusts.userId })
      .from(trusts)
      .where(eq(trusts.id, workspaceId))
      .limit(1);

    if (!trustRows.length) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (trustRows[0]!.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "QR Code";
    const config = body?.config ?? {};
    const description = JSON.stringify({
      type: "qr_code",
      url: config.url ?? body?.url ?? "",
      token: config.token ?? body?.token ?? null,
      uniqueMode: config.uniqueMode ?? body?.uniqueMode ?? true,
      createdAt: new Date().toISOString(),
    });

    const id = crypto.randomUUID();

    await db.insert(trustAssets).values({
      id,
      trustId: workspaceId,
      assetType: "qr_code",
      description,
    });

    return NextResponse.json({ id, workspaceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("qr-save POST error:", err);
    return NextResponse.json({ error: "Failed to save QR" }, { status: 500 });
  }
}
