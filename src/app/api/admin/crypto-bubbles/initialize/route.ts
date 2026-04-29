import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cryptoBubbleSettings } from "@/lib/db/schema";

// Admin-only endpoint for initializing default crypto bubble settings
export async function POST(request: NextRequest) {
  // Check admin auth
  const isAdmin = true; // In production, check proper admin authentication

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { bubbles } = body;

    if (!bubbles || !Array.isArray(bubbles)) {
      return NextResponse.json(
        { error: "Missing or invalid bubbles array" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Clear existing bubbles
    await db.delete(cryptoBubbleSettings);

    // Insert new bubbles
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      await db
        .insert(cryptoBubbleSettings)
        .values({
          ...bubble,
          displayOrder: bubble.displayOrder ?? i + 1,
        });
    }

    return NextResponse.json({
      success: true,
      message: `Initialized ${bubbles.length} crypto bubbles`,
    });
  } catch (error) {
    console.error("Error initializing crypto bubbles:", error);
    return NextResponse.json(
      { error: "Failed to initialize crypto bubbles" },
      { status: 500 }
    );
  }
}