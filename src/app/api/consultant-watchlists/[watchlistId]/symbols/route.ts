import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { consultantWatchlists, watchlistSymbols } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/consultant-watchlists/[watchlistId]/symbols - Get symbols for watchlist
// POST /api/consultant-watchlists/[watchlistId]/symbols - Add symbols to watchlist
// DELETE /api/consultant-watchlists/[watchlistId]/symbols?symbol=BTC - Remove symbol from watchlist

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ watchlistId: string }> }
) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { watchlistId } = await params;
    const db = await getDb();
    const consultantIdStr = consultantId.toString();

    // Verify ownership
    const watchlist = await db
      .select()
      .from(consultantWatchlists)
      .where(and(
        eq(consultantWatchlists.id, watchlistId),
        eq(consultantWatchlists.consultantId, consultantIdStr)
      ))
      .limit(1);

    if (watchlist.length === 0) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    const symbols = await db
      .select()
      .from(watchlistSymbols)
      .where(eq(watchlistSymbols.watchlistId, watchlistId));

    return NextResponse.json({
      success: true,
      symbols: symbols.map(s => s.symbol)
    });
  } catch (error) {
    console.error("Error fetching watchlist symbols:", error);
    return NextResponse.json(
      { error: "Failed to fetch symbols" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ watchlistId: string }> }
) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { watchlistId } = await params;
    const { symbols } = await request.json();

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { error: "Symbols array is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const consultantIdStr = consultantId.toString();

    // Verify ownership
    const watchlist = await db
      .select()
      .from(consultantWatchlists)
      .where(and(
        eq(consultantWatchlists.id, watchlistId),
        eq(consultantWatchlists.consultantId, consultantIdStr)
      ))
      .limit(1);

    if (watchlist.length === 0) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    // Add symbols (ignore duplicates)
    const symbolInserts = symbols.map(symbol => ({
      watchlistId,
      symbol: symbol.toUpperCase()
    }));

    await db.insert(watchlistSymbols).values(symbolInserts);

    return NextResponse.json({
      success: true,
      added: symbols.length
    });
  } catch (error) {
    console.error("Error adding symbols to watchlist:", error);
    return NextResponse.json(
      { error: "Failed to add symbols" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ watchlistId: string }> }
) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { watchlistId } = await params;
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const consultantIdStr = consultantId.toString();

    // Verify ownership
    const watchlist = await db
      .select()
      .from(consultantWatchlists)
      .where(and(
        eq(consultantWatchlists.id, watchlistId),
        eq(consultantWatchlists.consultantId, consultantIdStr)
      ))
      .limit(1);

    if (watchlist.length === 0) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    await db
      .delete(watchlistSymbols)
      .where(and(
        eq(watchlistSymbols.watchlistId, watchlistId),
        eq(watchlistSymbols.symbol, symbol.toUpperCase())
      ));

    return NextResponse.json({
      success: true,
      removed: true
    });
  } catch (error) {
    console.error("Error removing symbol from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove symbol" },
      { status: 500 }
    );
  }
}