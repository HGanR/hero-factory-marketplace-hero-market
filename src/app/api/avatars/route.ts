/**
 * POST /api/avatars — Create avatar profile
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avatarProfiles } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      displayName,
      avatarModelUrl,
      thumbnailUrl,
      configJson,
      sourceType = "preset",
      isDefault = false,
    } = body as {
      displayName?: string;
      avatarModelUrl: string;
      thumbnailUrl?: string;
      configJson?: Record<string, unknown>;
      sourceType?: "preset" | "uploaded" | "generated";
      isDefault?: boolean;
    };

    if (!avatarModelUrl || typeof avatarModelUrl !== "string" || avatarModelUrl.trim().length === 0) {
      return NextResponse.json({ error: "avatarModelUrl is required" }, { status: 400 });
    }

    const db = await getDb();
    const id = crypto.randomUUID();

    if (isDefault) {
      await db
        .update(avatarProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(avatarProfiles.userId, userId));
    }

    await db.insert(avatarProfiles).values({
      id,
      userId,
      displayName: displayName?.trim().slice(0, 120) ?? null,
      avatarModelUrl: avatarModelUrl.trim().slice(0, 512),
      thumbnailUrl: thumbnailUrl?.trim().slice(0, 512) ?? null,
      configJson: configJson ? JSON.stringify(configJson) : null,
      sourceType: ["preset", "uploaded", "generated"].includes(sourceType) ? sourceType : "preset",
      version: 1,
      isDefault: !!isDefault,
      status: "ready",
    });

    return NextResponse.json({
      success: true,
      id,
      message: "Avatar created",
    });
  } catch (e) {
    console.error("[avatars POST]", e);
    return NextResponse.json({ error: "Failed to create avatar" }, { status: 500 });
  }
}
