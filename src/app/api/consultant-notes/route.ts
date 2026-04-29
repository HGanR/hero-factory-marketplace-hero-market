import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consultantNotes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";

// GET /api/consultant-notes?symbol=BTC&timeframe=24h - Get notes for specific symbol/timeframe
// POST /api/consultant-notes - Create/update notes
// DELETE /api/consultant-notes?symbol=BTC&timeframe=24h - Delete notes

export async function GET(request: NextRequest) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const consultantIdStr = consultantId.toString();

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");

    const db = await getDb();

    if (symbol && timeframe) {
      // Get specific notes
      const notes = await db
        .select()
        .from(consultantNotes)
        .where(and(
          eq(consultantNotes.consultantId, consultantIdStr),
          eq(consultantNotes.symbol, symbol),
          eq(consultantNotes.timeframe, timeframe)
        ))
        .limit(1);

      return NextResponse.json({
        success: true,
        notes: notes[0] || null
      });
    } else {
      // Get all notes for consultant
      const allNotes = await db
        .select()
        .from(consultantNotes)
        .where(eq(consultantNotes.consultantId, consultantIdStr))
        .orderBy(consultantNotes.updatedAt);

      return NextResponse.json({
        success: true,
        notes: allNotes
      });
    }
  } catch (error) {
    console.error("Error fetching consultant notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
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

    const consultantIdStr = consultantId.toString();

    const { symbol, timeframe, notes: notesText } = await request.json();

    if (!symbol || !timeframe || !notesText) {
      return NextResponse.json(
        { error: "Symbol, timeframe, and notes are required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if notes already exist
    const existingNotes = await db
      .select()
      .from(consultantNotes)
      .where(and(
        eq(consultantNotes.consultantId, consultantIdStr),
        eq(consultantNotes.symbol, symbol),
        eq(consultantNotes.timeframe, timeframe)
      ))
      .limit(1);

    if (existingNotes.length > 0) {
      // Update existing notes
      await db
        .update(consultantNotes)
        .set({
          notes: notesText,
          updatedAt: new Date()
        })
        .where(eq(consultantNotes.id, existingNotes[0].id));

      return NextResponse.json({
        success: true,
        action: "updated"
      });
    } else {
      // Create new notes
      await db
        .insert(consultantNotes)
        .values({
          consultantId: consultantIdStr,
          symbol,
          timeframe,
          notes: notesText
        });

      return NextResponse.json({
        success: true,
        action: "created"
      });
    }
  } catch (error) {
    console.error("Error saving consultant notes:", error);
    return NextResponse.json(
      { error: "Failed to save notes" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const consultantId = await getAuthedUserId();
    if (!consultantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const consultantIdStr = consultantId.toString();

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: "Symbol and timeframe are required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    await db
      .delete(consultantNotes)
      .where(and(
        eq(consultantNotes.consultantId, consultantIdStr),
        eq(consultantNotes.symbol, symbol),
        eq(consultantNotes.timeframe, timeframe)
      ));

    return NextResponse.json({
      success: true,
      deleted: true
    });
  } catch (error) {
    console.error("Error deleting consultant notes:", error);
    return NextResponse.json(
      { error: "Failed to delete notes" },
      { status: 500 }
    );
  }
}