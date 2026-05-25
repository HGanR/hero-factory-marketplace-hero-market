// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consultantProfiles, marketplaceUsers } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { mysqlTruthy } from "@/lib/mysqlTruthy";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";

type ProfileRow = {
  userId: number;
  specialty: string | null;
  note: string | null;
  isActive: boolean | null;
  avatarUrl: string | null;
};

async function loadConsultantProfiles(db: Awaited<ReturnType<typeof getDb>>): Promise<{
  byUserId: Map<number, ProfileRow>;
  warning: string | null;
}> {
  try {
    const rows = await db
      .select({
        userId: consultantProfiles.userId,
        specialty: consultantProfiles.specialty,
        note: consultantProfiles.note,
        isActive: consultantProfiles.isActive,
        avatarUrl: consultantProfiles.avatarUrl,
      })
      .from(consultantProfiles);

    const byUserId = new Map<number, ProfileRow>();
    for (const r of rows) {
      byUserId.set(r.userId, {
        userId: r.userId,
        specialty: r.specialty ?? null,
        note: r.note ?? null,
        isActive: r.isActive ?? null,
        avatarUrl: r.avatarUrl ?? null,
      });
    }
    return { byUserId, warning: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    const missingTable =
      lower.includes("consultant_profiles") &&
      (lower.includes("doesn't exist") ||
        lower.includes("does not exist") ||
        lower.includes("unknown table") ||
        lower.includes("no such table") ||
        lower.includes("1146"));

    if (missingTable) {
      return {
        byUserId: new Map(),
        warning:
          "consultant_profiles table is missing. Run migrations or db:push to restore consultant assignments.",
      };
    }

    const missingAvatarColumn =
      lower.includes("unknown column") &&
      (lower.includes("avatar") || lower.includes("`avatarurl`") || lower.includes("'avatarurl'"));

    if (missingAvatarColumn) {
      try {
        const rows = await db
          .select({
            userId: consultantProfiles.userId,
            specialty: consultantProfiles.specialty,
            note: consultantProfiles.note,
            isActive: consultantProfiles.isActive,
          })
          .from(consultantProfiles);

        const byUserId = new Map<number, ProfileRow>();
        for (const r of rows) {
          byUserId.set(r.userId, {
            userId: r.userId,
            specialty: r.specialty ?? null,
            note: r.note ?? null,
            isActive: r.isActive ?? null,
            avatarUrl: null,
          });
        }
        return {
          byUserId,
          warning:
            "consultant_profiles.avatarUrl column is missing; avatars are omitted until you run the avatar migration (add_consultant_profile_avatar_url / alter to longtext).",
        };
      } catch (inner) {
        console.error("Consultant profiles fallback select error:", inner);
        return {
          byUserId: new Map(),
          warning:
            "Could not load consultant_profiles. Check DB migrations and server logs.",
        };
      }
    }

    console.error("Consultant profiles load error:", msg);
    return {
      byUserId: new Map(),
      warning:
        "Consultant data could not be loaded (see server logs). Accounts are still listed without consultant fields.",
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!getAdminApiDecoded(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();

    const baseUsers = await db
      .select()
      .from(marketplaceUsers)
      .orderBy(desc(marketplaceUsers.createdAt));

    const { byUserId, warning } = await loadConsultantProfiles(db);
    const consultantProfileRowCount = byUserId.size;

    const users = baseUsers.map((u) => {
      const p = byUserId.get(u.id);
      // Admin UI: any existing profile row is an assigned consultant. isActive only affects
      // public /consultations listing (see GET /api/consultants); hiding inactive rows here
      // made profiles look "missing" when isActive was 0/false from MySQL/tinyint quirks.
      const isConsultant = !!p;
      return {
        id: u.id,
        email: u.email,
        username: u.username,
        isActive: u.isActive,
        isApproved: mysqlTruthy(u.isApproved),
        createdAt:
          u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
        walletAddress: u.walletAddress ?? null,
        isConsultant,
        /** False means hidden from public consultant picker until re-enabled (same row, no duplicate). */
        consultantListingActive: p ? mysqlTruthy(p.isActive) : null,
        consultantSpecialty: p?.specialty ?? null,
        consultantNote: p?.note ?? null,
        consultantAvatarUrl: p?.avatarUrl ?? null,
      };
    });

    const payload = { users, consultantProfileRowCount };
    if (warning) {
      return NextResponse.json({ ...payload, warning });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Get users error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to get users",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
