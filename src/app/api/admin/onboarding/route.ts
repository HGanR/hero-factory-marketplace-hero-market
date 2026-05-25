import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entityOnboardings, marketplaceUsers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";

export async function GET(request: NextRequest) {
  try {
    if (!getAdminApiDecoded(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const rows = await db
      .select({
        onboarding: entityOnboardings,
        user: {
          id: marketplaceUsers.id,
          email: marketplaceUsers.email,
          username: marketplaceUsers.username,
        },
      })
      .from(entityOnboardings)
      .leftJoin(marketplaceUsers, eq(entityOnboardings.userId, marketplaceUsers.id))
      .orderBy(desc(entityOnboardings.createdAt));

    return NextResponse.json({ onboardings: rows });
  } catch (error) {
    console.error("Admin onboardings error:", error);
    return NextResponse.json({ error: "Failed to load onboardings" }, { status: 500 });
  }
}


