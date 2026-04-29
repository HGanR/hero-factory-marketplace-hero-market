// src/app/api/marketplace/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { email, username } = await request.json();

    if (!email || !username) {
      return NextResponse.json(
        { error: "Email and username are required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if email exists
    const existingEmail = await db
      .select()
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Check if username exists
    const existingUsername = await db
      .select()
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Create user
    await db.insert(marketplaceUsers).values({
      email,
      username,
      passwordHash: null,
      isActive: false,
      isApproved: false,
      walletAddress: null,
      hasTokenAccess: false,
      lastLogin: null,
    });

    return NextResponse.json({
      success: true,
      message: "Registration successful! Wait for admin approval.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check if it's a database connection error
    if (errorMessage.includes("DATABASE_URL") || errorMessage.includes("connect")) {
      return NextResponse.json(
        { 
          error: "Database connection failed. Please check environment variables in Vercel Dashboard.",
          details: errorMessage
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Registration failed",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

