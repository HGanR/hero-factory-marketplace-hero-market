import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { streamDestinations } from "@/lib/db/schema";
import { decryptStreamKey, isStreamDestinationEncryptionConfigured } from "@/lib/streaming/crypto";
import { normalizeStreamPlatform } from "@/lib/streaming/destinations";
import { maskRtmpOutputUrl, resolveRtmpDestination } from "@/lib/streaming/rtmp";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Validates resolver output for a saved destination and updates last_tested_at.
 * Does not open a TCP connection to the RTMP endpoint (provider firewalls vary).
 */
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStreamDestinationEncryptionConfigured()) {
    return NextResponse.json(
      { error: "Encryption not configured (STREAM_DESTINATION_ENCRYPTION_KEY). Cannot test saved credentials." },
      { status: 503 }
    );
  }

  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(streamDestinations)
      .where(and(eq(streamDestinations.id, id), eq(streamDestinations.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const platform = normalizeStreamPlatform(row.platform);
    if (!platform) {
      return NextResponse.json({ error: "Invalid platform on record" }, { status: 400 });
    }

    let streamKey: string;
    try {
      streamKey = decryptStreamKey(row.streamKeyEncrypted);
    } catch {
      return NextResponse.json({ error: "Could not decrypt stored key" }, { status: 500 });
    }

    const resolved = resolveRtmpDestination({
      platform,
      serverUrl: row.serverUrl,
      streamKey,
      orientationPreference: row.orientationPreference,
    });

    await db
      .update(streamDestinations)
      .set({ lastTestedAt: new Date() })
      .where(and(eq(streamDestinations.id, id), eq(streamDestinations.userId, userId)));

    return NextResponse.json({
      ok: true,
      maskedUrl: resolved.finalOutputUrl
        ? maskRtmpOutputUrl(resolved.finalOutputUrl, row.streamKeyLast4)
        : null,
      requiresManualGoLive: resolved.requiresManualGoLive,
      warnings: resolved.warnings,
      validUrl: Boolean(resolved.finalOutputUrl),
    });
  } catch (e) {
    console.error("[meet/broadcast/destinations/test]", e);
    return NextResponse.json({ error: "Test failed" }, { status: 503 });
  }
}
