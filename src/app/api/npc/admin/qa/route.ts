import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs, oasisNpcQA } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

// GET - List all Q&A for an NPC
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const npcId = searchParams.get("npcId");

    if (!npcId) {
      return NextResponse.json({ error: "npcId is required" }, { status: 400 });
    }

    // Get the NPC's internal ID
    const npc = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npcId))
      .limit(1);

    if (!npc.length) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    const questions = await db
      .select()
      .from(oasisNpcQA)
      .where(eq(oasisNpcQA.npcId, npc[0].id))
      .orderBy(asc(oasisNpcQA.orderIndex));

    // Parse correctAnswers JSON for each question
    const parsedQuestions = questions.map((q) => ({
      ...q,
      correctAnswers: JSON.parse(q.correctAnswers || "[]"),
    }));

    return NextResponse.json({ questions: parsedQuestions });
  } catch (error: any) {
    console.error("Error fetching NPC Q&A:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Q&A" },
      { status: 500 }
    );
  }
}

// POST - Create a new Q&A entry
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { npcId, question, correctAnswers, wrongAnswerResponse, successResponse, orderIndex } = body;

    if (!npcId || !question || !correctAnswers || !wrongAnswerResponse) {
      return NextResponse.json(
        { error: "npcId, question, correctAnswers, and wrongAnswerResponse are required" },
        { status: 400 }
      );
    }

    // Get the NPC's internal ID
    const npc = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npcId))
      .limit(1);

    if (!npc.length) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    // Get the highest order index if not provided
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const maxOrder = await db
        .select({ orderIndex: oasisNpcQA.orderIndex })
        .from(oasisNpcQA)
        .where(eq(oasisNpcQA.npcId, npc[0].id))
        .orderBy(asc(oasisNpcQA.orderIndex));
      
      finalOrderIndex = maxOrder.length > 0 
        ? Math.max(...maxOrder.map(q => q.orderIndex)) + 1 
        : 0;
    }

    const result = await db.insert(oasisNpcQA).values({
      npcId: npc[0].id,
      question,
      correctAnswers: JSON.stringify(
        Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers]
      ),
      wrongAnswerResponse,
      successResponse: successResponse || null,
      orderIndex: finalOrderIndex,
    });

    const insertId = Array.isArray(result) ? (result[0] as { insertId?: number })?.insertId : (result as { insertId?: number })?.insertId;

    return NextResponse.json({
      success: true,
      id: insertId ?? null,
      message: "Q&A created successfully",
    });
  } catch (error: any) {
    console.error("Error creating NPC Q&A:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create Q&A" },
      { status: 500 }
    );
  }
}

// PATCH - Update a Q&A entry
export async function PATCH(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { id, question, correctAnswers, wrongAnswerResponse, successResponse, orderIndex, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (question !== undefined) updateData.question = question;
    if (correctAnswers !== undefined) {
      updateData.correctAnswers = JSON.stringify(
        Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers]
      );
    }
    if (wrongAnswerResponse !== undefined) updateData.wrongAnswerResponse = wrongAnswerResponse;
    if (successResponse !== undefined) updateData.successResponse = successResponse;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .update(oasisNpcQA)
      .set(updateData)
      .where(eq(oasisNpcQA.id, id));

    return NextResponse.json({ success: true, message: "Q&A updated successfully" });
  } catch (error: any) {
    console.error("Error updating NPC Q&A:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update Q&A" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a Q&A entry
export async function DELETE(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(oasisNpcQA).where(eq(oasisNpcQA.id, id));

    return NextResponse.json({ success: true, message: "Q&A deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting NPC Q&A:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete Q&A" },
      { status: 500 }
    );
  }
}
