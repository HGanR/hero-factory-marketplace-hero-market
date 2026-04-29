import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { streamDestinations } from "@/lib/db/schema";
import { encryptStreamKey, isStreamDestinationEncryptionConfigured, streamKeyLast4 } from "@/lib/streaming/crypto";
import {
  normalizeStreamPlatform,
  STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED,
  toPublicDestination,
  validateDestinationInput,
} from "@/lib/streaming/destinations";
import { resolveRtmpDestination } from "@/lib/streaming/rtmp";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isStreamDestinationEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server encryption is not configured. Set STREAM_DESTINATION_ENCRYPTION_KEY (32-byte secret, base64 or hex) on the server, then restart. Credentials cannot be updated until then.",
        code: STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED,
      },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    const existing = await db
      .select()
      .from(streamDestinations)
      .where(and(eq(streamDestinations.id, id), eq(streamDestinations.userId, userId)))
      .limit(1);
    const row = existing[0];
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextPlatformRaw = body.platform != null ? String(body.platform) : row.platform;
    const nextServerUrl = body.serverUrl != null ? String(body.serverUrl).trim() : row.serverUrl;
    const nextLabel = body.label != null ? String(body.label).trim().slice(0, 120) : row.label;
    const nextOrientation =
      body.orientationPreference != null
        ? String(body.orientationPreference).toLowerCase().slice(0, 16)
        : row.orientationPreference;
    const nextActive = body.isActive != null ? Boolean(body.isActive) : Boolean(row.isActive);
    const streamKeyUpdate = body.streamKey != null ? String(body.streamKey).trim() : null;

    const platformNorm = normalizeStreamPlatform(nextPlatformRaw);
    if (!platformNorm) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    if (streamKeyUpdate !== null) {
      const v = validateDestinationInput({
        platform: nextPlatformRaw,
        label: nextLabel,
        serverUrl: nextServerUrl,
        streamKey: streamKeyUpdate,
        orientationPreference: nextOrientation,
        isActive: nextActive,
      });
      if (!v.ok) {
        return NextResponse.json({ error: v.errors.join("; ") }, { status: 400 });
      }
    } else {
      if (nextLabel.length > 120) {
        return NextResponse.json({ error: "Label too long" }, { status: 400 });
      }
      if (nextServerUrl.length > 1024) {
        return NextResponse.json({ error: "Server URL too long" }, { status: 400 });
      }
      const orientOk = ["auto", "portrait", "landscape"].includes(nextOrientation);
      if (!orientOk) {
        return NextResponse.json({ error: "Invalid orientationPreference" }, { status: 400 });
      }
      if (platformNorm === "custom" && !nextServerUrl.trim()) {
        return NextResponse.json({ error: "Custom platform requires server URL" }, { status: 400 });
      }
    }

    const resolved =
      streamKeyUpdate !== null
        ? resolveRtmpDestination({
            platform: platformNorm,
            serverUrl: nextServerUrl,
            streamKey: streamKeyUpdate,
          })
        : { warnings: [] as string[], requiresManualGoLive: Boolean(row.requiresManualGoLive) };
    const requiresManual =
      body.requiresManualGoLive != null
        ? Boolean(body.requiresManualGoLive)
        : "requiresManualGoLive" in resolved
          ? resolved.requiresManualGoLive
          : Boolean(row.requiresManualGoLive);

    const patch: Partial<typeof streamDestinations.$inferInsert> = {
      platform: platformNorm,
      label: nextLabel,
      serverUrl: nextServerUrl.slice(0, 1024),
      orientationPreference: nextOrientation,
      isActive: nextActive,
      requiresManualGoLive: requiresManual,
    };

    if (streamKeyUpdate !== null) {
      patch.streamKeyEncrypted = encryptStreamKey(streamKeyUpdate);
      patch.streamKeyLast4 = streamKeyLast4(streamKeyUpdate);
    }

    await db.update(streamDestinations).set(patch).where(eq(streamDestinations.id, id));

    const updated = await db
      .select()
      .from(streamDestinations)
      .where(and(eq(streamDestinations.id, id), eq(streamDestinations.userId, userId)))
      .limit(1);
    const out = updated[0];
    if (!out) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      destination: toPublicDestination(out),
      warnings: "warnings" in resolved ? resolved.warnings : [],
    });
  } catch (e) {
    console.error("[stream-destinations PATCH]", e);
    return NextResponse.json({ error: "Failed to update destination" }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const hit = await db
      .select({ id: streamDestinations.id })
      .from(streamDestinations)
      .where(and(eq(streamDestinations.id, id), eq(streamDestinations.userId, userId)))
      .limit(1);
    if (!hit[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.delete(streamDestinations).where(eq(streamDestinations.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stream-destinations DELETE]", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 503 });
  }
}
