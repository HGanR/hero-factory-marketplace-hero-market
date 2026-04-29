import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs, oasisNpcQA } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

// GET - Get Q&A questions for an NPC (public endpoint for chat)
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
      // Return empty questions if NPC not found (fallback to hardcoded)
      return NextResponse.json({ questions: [] });
    }

    const questions = await db
      .select({
        id: oasisNpcQA.id,
        question: oasisNpcQA.question,
        correctAnswers: oasisNpcQA.correctAnswers,
        wrongAnswerResponse: oasisNpcQA.wrongAnswerResponse,
        successResponse: oasisNpcQA.successResponse,
        orderIndex: oasisNpcQA.orderIndex,
      })
      .from(oasisNpcQA)
      .where(
        and(
          eq(oasisNpcQA.npcId, npc[0].id),
          eq(oasisNpcQA.isActive, true)
        )
      )
      .orderBy(asc(oasisNpcQA.orderIndex));

    // Parse correctAnswers JSON for each question
    const parsedQuestions = questions.map((q) => ({
      id: q.id,
      question: q.question,
      answers: JSON.parse(q.correctAnswers || "[]") as string[],
      wrongResponse: q.wrongAnswerResponse,
      successResponse: q.successResponse,
      orderIndex: q.orderIndex,
    }));

    return NextResponse.json({ questions: parsedQuestions });
  } catch (error: any) {
    console.error("Error fetching NPC Q&A:", error);
    return NextResponse.json(
      { questions: [] }, // Return empty on error to fallback to hardcoded
      { status: 200 }
    );
  }
}
