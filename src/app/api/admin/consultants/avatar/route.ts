import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { consultantProfiles } from "@/lib/db/schema";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";
import { MAX_BUSINESS_LOGO_DATA_URL_CHARS } from "@/lib/clients/clients-create-payload";

/**
 * Same storage model as Micro Terminal / client logo: admin sends a browser `data:image/...;base64,...`
 * string; we persist it on `consultant_profiles.avatarUrl` (no Pinata/IPFS).
 */
const JsonBodySchema = z.union([
  z.object({
    userId: z.number().int().positive(),
    clear: z.literal(true),
  }),
  z.object({
    userId: z.number().int().positive(),
    consultant_avatar_data_url: z
      .string()
      .min(32)
      .max(MAX_BUSINESS_LOGO_DATA_URL_CHARS)
      .refine((s) => s.trim().startsWith("data:image/"), {
        message: "consultant_avatar_data_url must be a data:image/... URL (use FileReader.readAsDataURL)",
      }),
  }),
]);

function avatarDbErrorResponse(err: unknown): NextResponse | null {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  const missingAvatarColumn =
    lower.includes("unknown column") &&
    (lower.includes("avatar") || lower.includes("`avatarurl`") || lower.includes("'avatarurl'"));

  if (missingAvatarColumn) {
    return NextResponse.json(
      {
        error:
          "consultant_profiles.avatarUrl column is missing. Run drizzle migration 0134_consultant_profile_avatar_url (or migrations/add_consultant_profile_avatar_url.sql), then retry.",
      },
      { status: 503 },
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!getAdminApiDecoded(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = JsonBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join("; ") || "Invalid body" },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const db = await getDb();

  try {
    const existing = await db
      .select({ userId: consultantProfiles.userId })
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, body.userId))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        {
          error:
            "No consultant profile for this user yet. Set Consultant + Specialty and click Save first, then upload a photo.",
        },
        { status: 404 },
      );
    }

    if ("clear" in body) {
      await db
        .update(consultantProfiles)
        .set({ avatarUrl: null })
        .where(eq(consultantProfiles.userId, body.userId));
      return NextResponse.json({ success: true, avatarUrl: null });
    }

    const avatarUrl = body.consultant_avatar_data_url.trim();
    await db.update(consultantProfiles).set({ avatarUrl }).where(eq(consultantProfiles.userId, body.userId));
    return NextResponse.json({ success: true, avatarUrl });
  } catch (err) {
    const known = avatarDbErrorResponse(err);
    if (known) return known;
    console.error("Consultant avatar upload error:", err);
    return NextResponse.json({ error: "Failed to save consultant photo" }, { status: 500 });
  }
}
