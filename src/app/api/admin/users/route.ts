// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consultantProfiles, marketplaceUsers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("admin-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    // NOTE: Production DB might not yet have the new consultations tables.
    // We "fail open" so admin can still see Pending/Approved accounts even if
    // consultant tables are missing (migration not yet applied).
    try {
      const rows = await db
        .select({
          id: marketplaceUsers.id,
          email: marketplaceUsers.email,
          username: marketplaceUsers.username,
          isActive: marketplaceUsers.isActive,
          isApproved: marketplaceUsers.isApproved,
          createdAt: marketplaceUsers.createdAt,
          walletAddress: marketplaceUsers.walletAddress,
          consultantUserId: consultantProfiles.userId,
          consultantSpecialty: consultantProfiles.specialty,
          consultantNote: consultantProfiles.note,
          consultantIsActive: consultantProfiles.isActive,
        })
        .from(marketplaceUsers)
        .leftJoin(consultantProfiles, eq(consultantProfiles.userId, marketplaceUsers.id))
        .orderBy(desc(marketplaceUsers.createdAt));

      const users = rows.map((r) => ({
        id: r.id,
        email: r.email,
        username: r.username,
        isActive: r.isActive,
        isApproved: r.isApproved,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        walletAddress: r.walletAddress ?? null,
        isConsultant: !!r.consultantUserId && r.consultantIsActive !== false,
        consultantSpecialty: r.consultantSpecialty ?? null,
        consultantNote: r.consultantNote ?? null,
      }));

      return NextResponse.json({ users });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const looksLikeMissingConsultantTable =
        msg.toLowerCase().includes("consultant_profiles");

      // Fail-open if consultant_profiles is missing or any join error; still return base users
      if (!looksLikeMissingConsultantTable) {
        console.error("Get users error:", msg);
      }

      const baseUsers = await db
        .select()
        .from(marketplaceUsers)
        .orderBy(desc(marketplaceUsers.createdAt));

      return NextResponse.json({
        users: baseUsers.map((u) => ({
          id: u.id,
          email: u.email,
          username: u.username,
          isActive: u.isActive,
          isApproved: u.isApproved,
          createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
          walletAddress: u.walletAddress ?? null,
          isConsultant: false,
          consultantSpecialty: null,
          consultantNote: null,
        })),
        warning:
          "Consultant data unavailable (table missing or join failed). Run migrations/db:push if consultant profiles are needed.",
      });
    }
  } catch (error) {
    console.error("Get users error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { 
        error: "Failed to get users",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

