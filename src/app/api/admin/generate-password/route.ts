// src/app/api/admin/generate-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketplaceUsers, adminLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generatePassword, hashPassword } from "@/lib/auth";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";

export async function POST(request: NextRequest) {
  try {
    if (!getAdminApiDecoded(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();

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
    const password = generatePassword(12);
    const passwordHash = hashPassword(password);

    await db
      .update(marketplaceUsers)
      .set({
        passwordHash,
        isApproved: true,
        isActive: true,
      })
      .where(eq(marketplaceUsers.id, userId));

    // Log admin action
    await db.insert(adminLogs).values({
      adminId: 0,
      action: "GENERATE_PASSWORD",
      targetUserId: userId,
      targetEmail: user.email,
      details: `Generated password for ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      password,
      message: `Password generated for ${user.email}`,
    });
  } catch (error) {
    console.error("Generate password error:", error);
    return NextResponse.json(
      { error: "Failed to generate password" },
      { status: 500 }
    );
  }
}

