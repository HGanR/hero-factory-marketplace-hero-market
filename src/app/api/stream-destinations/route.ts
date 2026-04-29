import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { streamDestinations } from "@/lib/db/schema";
import { encryptStreamKey, isStreamDestinationEncryptionConfigured, streamKeyLast4 } from "@/lib/streaming/crypto";
import {
  STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED,
  toPublicDestination,
  validateDestinationInput,
} from "@/lib/streaming/destinations";
import { resolveRtmpDestination } from "@/lib/streaming/rtmp";

export async function GET() {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(streamDestinations)
      .where(eq(streamDestinations.userId, userId))
      .orderBy(desc(streamDestinations.id));
    return NextResponse.json({
      destinations: rows.map(toPublicDestination),
      encryptionConfigured: isStreamDestinationEncryptionConfigured(),
    });
  } catch (e) {
    console.error("[stream-destinations GET]", e);
    return NextResponse.json({ error: "Failed to load destinations" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = validateDestinationInput({
    platform: String(body.platform ?? ""),
    label: body.label != null ? String(body.label) : undefined,
    serverUrl: body.serverUrl != null ? String(body.serverUrl) : undefined,
    streamKey: String(body.streamKey ?? ""),
    orientationPreference:
      body.orientationPreference != null ? String(body.orientationPreference) : undefined,
    isActive: body.isActive != null ? Boolean(body.isActive) : undefined,
  });
  if (!v.ok || !v.platform) {
    return NextResponse.json({ error: v.errors.join("; ") }, { status: 400 });
  }

  if (!isStreamDestinationEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server encryption is not configured. Set STREAM_DESTINATION_ENCRYPTION_KEY (32-byte secret, base64 or hex) on the server, then restart. Stream keys cannot be saved until then.",
        code: STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED,
      },
      { status: 503 }
    );
  }

  const resolved = resolveRtmpDestination({
    platform: v.platform,
    serverUrl: String(body.serverUrl ?? "").trim(),
    streamKey: String(body.streamKey ?? "").trim(),
  });

  const requiresManual =
    body.requiresManualGoLive != null
      ? Boolean(body.requiresManualGoLive)
      : resolved.requiresManualGoLive;

  try {
    const enc = encryptStreamKey(String(body.streamKey ?? "").trim());
    const last4 = streamKeyLast4(String(body.streamKey ?? ""));
    const db = await getDb();
    await db.insert(streamDestinations).values({
      userId,
      platform: v.platform,
      label: (body.label != null ? String(body.label) : "").trim().slice(0, 120),
      serverUrl: String(body.serverUrl ?? "").trim().slice(0, 1024),
      streamKeyEncrypted: enc,
      streamKeyLast4: last4,
      orientationPreference: (body.orientationPreference != null ? String(body.orientationPreference) : "auto")
        .toLowerCase()
        .slice(0, 16),
      isActive: body.isActive != null ? Boolean(body.isActive) : true,
      requiresManualGoLive: requiresManual,
    });
    const rows = await db
      .select()
      .from(streamDestinations)
      .where(eq(streamDestinations.userId, userId))
      .orderBy(desc(streamDestinations.id))
      .limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    return NextResponse.json({
      destination: toPublicDestination(row),
      warnings: resolved.warnings,
    });
  } catch (e) {
    console.error("[stream-destinations POST]", e);
    return NextResponse.json({ error: "Failed to save destination" }, { status: 503 });
  }
}
