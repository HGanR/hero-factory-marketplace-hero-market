import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { consultantProfiles } from "@/lib/db/schema";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";

const BodySchema = z.object({
  userId: z.number().int().positive(),
  isConsultant: z.boolean(),
  specialty: z.string().trim().max(140).optional(),
  note: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  if (!getAdminApiDecoded(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 }
    );
  }

  const db = await getDb();

  if (!body.isConsultant) {
    await db.delete(consultantProfiles).where(eq(consultantProfiles.userId, body.userId));
    return NextResponse.json({ success: true, isConsultant: false });
  }

  const specialty = (body.specialty ?? "").trim();
  if (!specialty) {
    return NextResponse.json(
      { error: "Specialty is required when assigning a consultant" },
      { status: 400 }
    );
  }

  const isActive = body.isActive ?? true;

  await db
    .insert(consultantProfiles)
    .values({
      userId: body.userId,
      specialty,
      note: body.note ?? null,
      isActive,
    } as any)
    .onDuplicateKeyUpdate({
      set: {
        specialty,
        note: body.note ?? null,
        isActive,
      } as any,
    });

  return NextResponse.json({
    success: true,
    isConsultant: true,
    specialty,
    note: body.note ?? null,
    isActive,
  });
}













