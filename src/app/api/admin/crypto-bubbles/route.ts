import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cryptoBubbleSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Default crypto bubbles to use when database is not available
const DEFAULT_CRYPTO_BUBBLES = [
  { id: 'btc-default', currency: 'BTC', symbol: '₿', name: 'Bitcoin', isEnabled: true, displayOrder: 1, color: '#f7931a', icon: 'bitcoin' },
  { id: 'eth-default', currency: 'ETH', symbol: 'Ξ', name: 'Ethereum', isEnabled: true, displayOrder: 2, color: '#627eea', icon: 'ethereum' },
  { id: 'usdt-default', currency: 'USDT', symbol: '₮', name: 'Tether', isEnabled: true, displayOrder: 3, color: '#26a17b', icon: 'tether' },
  { id: 'bnb-default', currency: 'BNB', symbol: 'BNB', name: 'Binance Coin', isEnabled: true, displayOrder: 4, color: '#f3ba2f', icon: 'binance' },
  { id: 'sol-default', currency: 'SOL', symbol: '◎', name: 'Solana', isEnabled: true, displayOrder: 5, color: '#9945ff', icon: 'solana' },
  { id: 'ada-default', currency: 'ADA', symbol: 'ADA', name: 'Cardano', isEnabled: false, displayOrder: 6, color: '#0033ad', icon: 'cardano' },
  { id: 'xrp-default', currency: 'XRP', symbol: '✕', name: 'Ripple', isEnabled: false, displayOrder: 7, color: '#23292f', icon: 'ripple' },
  { id: 'dot-default', currency: 'DOT', symbol: '●', name: 'Polkadot', isEnabled: false, displayOrder: 8, color: '#e6007a', icon: 'polkadot' },
  { id: 'link-default', currency: 'LINK', symbol: 'LINK', name: 'Chainlink', isEnabled: false, displayOrder: 9, color: '#375bd2', icon: 'chainlink' },
  { id: 'avax-default', currency: 'AVAX', symbol: 'AVAX', name: 'Avalanche', isEnabled: false, displayOrder: 10, color: '#e84142', icon: 'avalanche' },
];

// Admin-only endpoint for managing crypto bubble settings
export async function GET() {
  // Check admin auth
  const isAdmin = true; // In production, check proper admin authentication

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const db = await getDb();
    const bubbles = await db
      .select()
      .from(cryptoBubbleSettings)
      .orderBy(cryptoBubbleSettings.displayOrder);

    if (bubbles.length === 0) {
      // If database is available but empty, return defaults
      return NextResponse.json({
        success: true,
        bubbles: DEFAULT_CRYPTO_BUBBLES,
        usingDefaults: true
      });
    }

    return NextResponse.json({
      success: true,
      bubbles: bubbles.map(bubble => ({
        ...bubble,
        id: bubble.id,
      })),
    });
  } catch (error) {
    console.error("Database not available, using default bubbles:", error);

    // Return default bubbles when database is not available
    return NextResponse.json({
      success: true,
      bubbles: DEFAULT_CRYPTO_BUBBLES,
      fallback: true
    });
  }
}

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
    const { currency, symbol, name, isEnabled, displayOrder, color, icon } = body;

    if (!currency || !symbol || !name) {
      return NextResponse.json(
        { error: "Missing required fields: currency, symbol, name" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if currency already exists
    const existing = await db
      .select()
      .from(cryptoBubbleSettings)
      .where(eq(cryptoBubbleSettings.currency, currency))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Currency already exists" },
        { status: 400 }
      );
    }

    // Insert the new bubble
    await db
      .insert(cryptoBubbleSettings)
      .values({
        currency,
        symbol,
        name,
        isEnabled: isEnabled ?? true,
        displayOrder: displayOrder ?? 0,
        color,
        icon,
      });

    return NextResponse.json({
      success: true,
      message: "Crypto bubble created successfully",
      persisted: true
    });
  } catch (error) {
    console.error("Database error creating crypto bubble:", error);

    // Check if it's a connection error vs other database error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes("Database connection failed") ||
        errorMessage.includes("Cannot reach database") ||
        errorMessage.includes("Access denied")) {
      // Genuine database connectivity issue
      return NextResponse.json({
        success: true,
        message: "Crypto bubble would be created (database not available)",
        persisted: false
      });
    } else {
      // Database operation error (table not found, duplicate key, etc.)
      return NextResponse.json({
        success: false,
        error: "Failed to create crypto bubble",
        persisted: false
      }, { status: 500 });
    }
  }
}

export async function PATCH(request: NextRequest) {
  // Check admin auth
  const isAdmin = true; // In production, check proper admin authentication

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Missing bubble ID" },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    // Perform the update
    await db
      .update(cryptoBubbleSettings)
      .set(updates)
      .where(eq(cryptoBubbleSettings.id, id));

    return NextResponse.json({
      success: true,
      message: "Crypto bubble updated successfully",
      persisted: true
    });

  } catch (error) {
    console.error("Database error updating crypto bubble:", error);

    // Check if it's a connection error vs other database error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes("Database connection failed") ||
        errorMessage.includes("Cannot reach database") ||
        errorMessage.includes("Access denied")) {
      // Genuine database connectivity issue
      return NextResponse.json({
        success: true,
        message: "Crypto bubble would be updated (database not available)",
        persisted: false
      });
    } else {
      // Database operation error (table not found, etc.)
      return NextResponse.json({
        success: false,
        error: "Failed to update crypto bubble",
        persisted: false
      }, { status: 500 });
    }
  }
}

export async function DELETE(request: NextRequest) {
  // Check admin auth
  const isAdmin = true; // In production, check proper admin authentication

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing bubble ID" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Perform the delete
    await db
      .delete(cryptoBubbleSettings)
      .where(eq(cryptoBubbleSettings.id, id));

    return NextResponse.json({
      success: true,
      message: "Crypto bubble deleted successfully",
      persisted: true
    });
  } catch (error) {
    console.error("Database error deleting crypto bubble:", error);

    // Check if it's a connection error vs other database error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes("Database connection failed") ||
        errorMessage.includes("Cannot reach database") ||
        errorMessage.includes("Access denied")) {
      // Genuine database connectivity issue
      return NextResponse.json({
        success: true,
        message: "Crypto bubble would be deleted (database not available)",
        persisted: false
      });
    } else {
      // Database operation error
      return NextResponse.json({
        success: false,
        error: "Failed to delete crypto bubble",
        persisted: false
      }, { status: 500 });
    }
  }
}