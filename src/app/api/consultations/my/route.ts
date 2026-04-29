import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, asc, desc, eq, gte, or } from "drizzle-orm";

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

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  const consultantRow = await db
    .select({ userId: consultantProfiles.userId, isActive: consultantProfiles.isActive })
    .from(consultantProfiles)
    .where(eq(consultantProfiles.userId, userId))
    .limit(1);

  const isConsultant = !!consultantRow[0] && consultantRow[0].isActive !== false;

  // Client view: my bookings (any status)
  const clientRows = await db
    .select({
      id: consultationBookings.id,
      consultantUserId: consultationBookings.consultantUserId,
      scheduledAt: consultationBookings.scheduledAt,
      status: consultationBookings.status,
      clientNote: consultationBookings.clientNote,
      consultantUsername: marketplaceUsers.username,
    })
    .from(consultationBookings)
    .innerJoin(marketplaceUsers, eq(marketplaceUsers.id, consultationBookings.consultantUserId))
    .where(eq(consultationBookings.clientUserId, userId))
    .orderBy(desc(consultationBookings.scheduledAt))
    .limit(200);

  // Consultant notifications: upcoming scheduled calls
  const now = new Date();
  const consultantRows = isConsultant
    ? await db
        .select({
          id: consultationBookings.id,
          clientUserId: consultationBookings.clientUserId,
          scheduledAt: consultationBookings.scheduledAt,
          status: consultationBookings.status,
          clientNote: consultationBookings.clientNote,
          clientUsername: marketplaceUsers.username,
        })
        .from(consultationBookings)
        .innerJoin(marketplaceUsers, eq(marketplaceUsers.id, consultationBookings.clientUserId))
        .where(
          and(
            eq(consultationBookings.consultantUserId, userId),
            eq(consultationBookings.status, "scheduled"),
            gte(consultationBookings.scheduledAt, now)
          )
        )
        .orderBy(asc(consultationBookings.scheduledAt))
        .limit(50)
    : [];

  // Additionally: a lightweight combined list for future use
  const allMine = await db
    .select({
      id: consultationBookings.id,
      clientUserId: consultationBookings.clientUserId,
      consultantUserId: consultationBookings.consultantUserId,
      scheduledAt: consultationBookings.scheduledAt,
      status: consultationBookings.status,
    })
    .from(consultationBookings)
    .where(
      or(
        eq(consultationBookings.clientUserId, userId),
        eq(consultationBookings.consultantUserId, userId)
      )
    )
    .orderBy(desc(consultationBookings.scheduledAt))
    .limit(200);

  return NextResponse.json({
    meUserId: userId,
    isConsultant,
    asClient: clientRows.map((r) => ({
      id: r.id,
      consultantUserId: r.consultantUserId,
      consultantUsername: r.consultantUsername,
      scheduledAtMs: r.scheduledAt instanceof Date ? r.scheduledAt.getTime() : Date.now(),
      status: r.status,
      clientNote: r.clientNote ?? undefined,
    })),
    asConsultantUpcoming: consultantRows.map((r) => ({
      id: r.id,
      clientUserId: r.clientUserId,
      clientUsername: r.clientUsername,
      scheduledAtMs: r.scheduledAt instanceof Date ? r.scheduledAt.getTime() : Date.now(),
      status: r.status,
      clientNote: r.clientNote ?? undefined,
    })),
    allMine: allMine.map((r) => ({
      id: r.id,
      clientUserId: r.clientUserId,
      consultantUserId: r.consultantUserId,
      scheduledAtMs: r.scheduledAt instanceof Date ? r.scheduledAt.getTime() : Date.now(),
      status: r.status,
    })),
  });
}













