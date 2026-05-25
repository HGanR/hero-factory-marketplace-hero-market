import { NextRequest, NextResponse } from "next/server";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    if (!getAdminApiDecoded(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const db = await getDb();
    await db.delete(marketplaceUsers).where(eq(marketplaceUsers.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete user", details: process.env.NODE_ENV === "development" ? errorMessage : undefined },
      { status: 500 }
    );
  }
}










