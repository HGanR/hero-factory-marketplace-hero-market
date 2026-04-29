import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { consultationBookings, consultantProfiles, marketplaceUsers } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const BodySchema = z.object({
  consultantUserId: z.number().int().positive(),
  scheduledAtMs: z.number().int().positive(),
  clientNote: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 }
    );
  }

  const scheduledAt = new Date(body.scheduledAtMs);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAtMs" }, { status: 400 });
  }
  if (scheduledAt.getTime() < Date.now() + 5 * 60 * 1000) {
    return NextResponse.json(
      { error: "Scheduled time must be at least 5 minutes in the future" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Ensure consultant exists + active + user is approved/active
  const consultant = await db
    .select({
      userId: consultantProfiles.userId,
      specialty: consultantProfiles.specialty,
      username: marketplaceUsers.username,
    })
    .from(consultantProfiles)
    .innerJoin(marketplaceUsers, eq(marketplaceUsers.id, consultantProfiles.userId))
    .where(
      and(
        eq(consultantProfiles.userId, body.consultantUserId),
        eq(consultantProfiles.isActive, true),
        eq(marketplaceUsers.isApproved, true),
        eq(marketplaceUsers.isActive, true)
      )
    )
    .limit(1);

  if (!consultant[0]) {
    return NextResponse.json({ error: "Consultant not found" }, { status: 404 });
  }

  await db.insert(consultationBookings).values({
    clientUserId: userId,
    consultantUserId: body.consultantUserId,
    scheduledAt,
    status: "scheduled",
    clientNote: body.clientNote ?? null,
  } as any);

  return NextResponse.json({
    success: true,
    booking: {
      consultantUserId: body.consultantUserId,
      consultantUsername: consultant[0].username,
      consultantSpecialty: consultant[0].specialty,
      scheduledAtMs: scheduledAt.getTime(),
    },
  });
}













