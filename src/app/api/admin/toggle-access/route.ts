// src/app/api/admin/toggle-access/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketplaceUsers, adminLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("admin-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, isActive } = await request.json();

    const db = await getDb();

    const users = await db
      .select()
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.id, userId))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = users[0];

    await db
      .update(marketplaceUsers)
      .set({ isActive })
      .where(eq(marketplaceUsers.id, userId));

    // Log admin action
    await db.insert(adminLogs).values({
      adminId: 0,
      action: isActive ? "RESTORE_ACCESS" : "REVOKE_ACCESS",
      targetUserId: userId,
      targetEmail: user.email,
      details: `${isActive ? "Restored" : "Revoked"} access for ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      message: `Access ${isActive ? "restored" : "revoked"} for ${user.email}`,
    });
  } catch (error) {
    console.error("Toggle access error:", error);
    return NextResponse.json(
      { error: "Failed to toggle access" },
      { status: 500 }
    );
  }
}

