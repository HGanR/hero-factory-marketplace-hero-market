// src/app/api/marketplace/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { verifyPassword, createToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email/username and password are required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const users = await db
      .select()
      .from(marketplaceUsers)
      .where(
        or(
          eq(marketplaceUsers.email, identifier),
          eq(marketplaceUsers.username, identifier)
        )
      )
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = users[0];

    if (!user.isApproved) {
      return NextResponse.json(
        { error: "Account not yet approved" },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account has been deactivated" },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Password not set. Wait for admin." },
        { status: 403 }
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .update(marketplaceUsers)
      .set({ lastLogin: new Date() })
      .where(eq(marketplaceUsers.id, user.id));

    const token = createToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        hasTokenAccess: user.hasTokenAccess,
        walletAddress: user.walletAddress,
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

