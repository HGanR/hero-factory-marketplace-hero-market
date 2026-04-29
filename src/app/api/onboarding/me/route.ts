import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entityOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const rows = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.userId, decoded.userId))
      .limit(1);

    return NextResponse.json({ onboarding: rows[0] || null });
  } catch (error) {
    console.error("Onboarding me error:", error);
    return NextResponse.json({ error: "Failed to load onboarding" }, { status: 500 });
  }
}


