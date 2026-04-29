import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { consultantWatchlists, watchlistSymbols } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/consultant-watchlists - Get all watchlists for consultant
// POST /api/consultant-watchlists - Create new watchlist
// PATCH /api/consultant-watchlists/[id] - Update watchlist
// DELETE /api/consultant-watchlists/[id] - Delete watchlist

export async function GET(request: NextRequest) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const consultantIdStr = consultantId.toString();

    const watchlists = await db
      .select()
      .from(consultantWatchlists)
      .where(eq(consultantWatchlists.consultantId, consultantIdStr))
      .orderBy(consultantWatchlists.updatedAt);

    // Get symbols for each watchlist
    const watchlistsWithSymbols = await Promise.all(
      watchlists.map(async (watchlist) => {
        const symbols = await db
          .select()
          .from(watchlistSymbols)
          .where(eq(watchlistSymbols.watchlistId, watchlist.id));

        return {
          ...watchlist,
          symbols: symbols.map(s => s.symbol)
        };
      })
    );

    return NextResponse.json({
      success: true,
      watchlists: watchlistsWithSymbols
    });
  } catch (error) {
    console.error("Error fetching watchlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlists" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, symbols } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const consultantIdStr = consultantId.toString();

    // Create watchlist
    await db
      .insert(consultantWatchlists)
      .values({
        consultantId: consultantIdStr,
        name,
        description: description || "",
        isDefault: false
      });

    // Get the created watchlist
    const createdWatchlists = await db
      .select()
      .from(consultantWatchlists)
      .where(and(
        eq(consultantWatchlists.consultantId, consultantIdStr),
        eq(consultantWatchlists.name, name)
      ))
      .orderBy(consultantWatchlists.createdAt)
      .limit(1);

    const watchlist = createdWatchlists[0];

    // Add symbols if provided
    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      const symbolInserts = symbols.map(symbol => ({
        watchlistId: watchlist.id,
        symbol: symbol.toUpperCase()
      }));

      await db.insert(watchlistSymbols).values(symbolInserts);
    }

    return NextResponse.json({
      success: true,
      watchlist: {
        ...watchlist,
        symbols: symbols || []
      }
    });
  } catch (error) {
    console.error("Error creating watchlist:", error);
    return NextResponse.json(
      { error: "Failed to create watchlist" },
      { status: 500 }
    );
  }
}