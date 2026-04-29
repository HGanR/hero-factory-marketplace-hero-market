import "server-only";

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { consultantProfiles, marketplaceUsers } from "@/lib/db/schema";

export async function GET() {
  try {
    const db = await getDb();

    const rows = await db
      .select({
        userId: consultantProfiles.userId,
        specialty: consultantProfiles.specialty,
        note: consultantProfiles.note,
        username: marketplaceUsers.username,
      })
      .from(consultantProfiles)
      .innerJoin(marketplaceUsers, eq(marketplaceUsers.id, consultantProfiles.userId))
      .where(
        and(
          eq(consultantProfiles.isActive, true),
          eq(marketplaceUsers.isApproved, true),
          eq(marketplaceUsers.isActive, true)
        )
      )
      .orderBy(asc(consultantProfiles.specialty), asc(marketplaceUsers.username))
      .limit(500);

    return NextResponse.json({
      consultants: rows.map((r) => {
        const displayName = r.specialty || r.username || "Consultant";
        return {
          userId: r.userId,
          displayName,
          specialty: r.specialty,
          note: r.note ?? undefined,
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load consultants";
    const m = msg.toLowerCase();

    // If the new table hasn't been created in the DB yet, don't break the public page.
    // Return an empty list and an actionable warning.
    const looksLikeMissingTable =
      m.includes("consultant_profiles") &&
      (m.includes("doesn't exist") ||
        m.includes("does not exist") ||
        m.includes("no such table") ||
        m.includes("er_no_such_table") ||
        // Some drizzle/mysql2 error messages wrap the SQL without including the MySQL error text
        m.includes("failed query:"));

    if (looksLikeMissingTable) {
      return NextResponse.json({
        consultants: [],
        warning:
          "Consultations database tables are not yet created. Ask an admin to run the database migration (drizzle db:push) to create consultant_profiles and consultation_bookings.",
      });
    }

    return NextResponse.json(
      {
        error: msg,
        hint:
          "Check DATABASE_URL and ensure the consultations tables are migrated (consultant_profiles).",
      },
      { status: 500 }
    );
  }
}


