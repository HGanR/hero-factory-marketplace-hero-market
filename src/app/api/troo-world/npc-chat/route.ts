/**
 * NPC Chat API
 * Public endpoint for chatting with AI agents in Troo World.
 * Uses NPC knowledge bases for RAG (retrieval-augmented generation).
 *
 * POST: Send a message to an NPC
 *   - npcId: The NPC's unique identifier
 *   - message: User's message
 *   - sessionId: Optional existing session ID
 *
 * Returns: { response, sessionId }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs, oasisNpcKnowledge, oasisNpcSessions, oasisNpcMessages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveUnifiedSkipperRuntimeContext } from "@/lib/agents/skipper-unified-runtime";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { npcId, message, sessionId } = body;

    if (!npcId || !message) {
      return NextResponse.json(
        { error: "npcId and message are required" },
        { status: 400 }
      );
    }

    // Fetch NPC from database
    const [npc] = await db
      .select()
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npcId))
      .limit(1);

    if (!npc) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    // Parse personality JSON
    let personality: { systemPrompt?: string; department?: string; expertise?: string } = {};
    if (npc.personalityJson) {
      try {
        personality = JSON.parse(npc.personalityJson);
      } catch {
        // ignore parse errors
      }
    }

    // Fetch NPC's knowledge documents
    const knowledgeDocs = await db
      .select()
      .from(oasisNpcKnowledge)
      .where(eq(oasisNpcKnowledge.npcId, npc.id))
      .orderBy(desc(oasisNpcKnowledge.priority));

    // Retrieve relevant knowledge (simple keyword matching)
    const messageLower = message.toLowerCase();
    const relevantDocs = knowledgeDocs
      .map((doc) => {
        const keywords = doc.keywords?.split(",").map((k) => k.trim().toLowerCase()) || [];
        const score = keywords.reduce((s, kw) => (messageLower.includes(kw) ? s + 1 : s), 0);
        return { doc, score };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((d) => d.doc);

    // If no keyword matches, use top 2 by priority
    const docsToUse = relevantDocs.length > 0 ? relevantDocs : knowledgeDocs.slice(0, 2);

    // Build knowledge context
    const knowledgeContext = docsToUse.length > 0
      ? docsToUse.map((d) => `## ${d.topic}\n${d.content}`).join("\n\n")
      : "";

    // Get or create session
    let currentSessionId = sessionId;
    let existingMessages: { role: "user" | "npc"; content: string }[] = [];

    if (sessionId) {
      const [session] = await db
        .select()
        .from(oasisNpcSessions)
        .where(eq(oasisNpcSessions.sessionId, sessionId))
        .limit(1);

      if (session) {
        // Fetch previous messages
        const prevMessages = await db
          .select()
          .from(oasisNpcMessages)
          .where(eq(oasisNpcMessages.sessionId, session.id))
          .orderBy(oasisNpcMessages.createdAt)
          .limit(10);

        existingMessages = prevMessages.map((m) => ({
          role: m.role === "user" ? "user" : "npc",
          content: m.content,
        }));

        // Update session activity
        await db
          .update(oasisNpcSessions)
          .set({ lastActivity: new Date(), messageCount: session.messageCount + 1 })
          .where(eq(oasisNpcSessions.id, session.id));
      }
    }

    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.insert(oasisNpcSessions).values({
        sessionId: currentSessionId,
        npcId: npc.id,
        npcNpcId: npc.npcId,
        messageCount: 1,
      });
    }

    // Build system prompt (executive_admin uses unified SKIPPER resolver for persona + capability stack)
    let executivePersonaCore = personality.systemPrompt?.trim() || `You are ${npc.name}, a helpful assistant.`;
    if (npc.role === "executive_admin") {
      const cognitive = await resolveUnifiedSkipperRuntimeContext({
        surface: "troo_world",
        db,
        npcName: npc.name,
        npcRole: npc.role,
        hasKnowledgeDocs: knowledgeDocs.length > 0,
        personalitySystemPrompt: personality.systemPrompt ?? null,
      });
      if (cognitive) {
        executivePersonaCore = cognitive.systemPrompt;
      }
    }

    const systemPrompt = `${executivePersonaCore}

Your name is ${npc.name}.
Your role is: ${npc.title || npc.role}
${personality.department ? `Department: ${personality.department}` : ""}
${personality.expertise ? `Expertise: ${personality.expertise}` : ""}

${npc.greeting ? `When starting a conversation, you may greet with: "${npc.greeting}"` : ""}

${knowledgeContext ? `\n---\nKNOWLEDGE BASE (use this to answer questions accurately):\n\n${knowledgeContext}\n---\n` : ""}

Guidelines:
- Stay in character as ${npc.name}
- Be professional, helpful, and knowledgeable
- If you don't know something, say so and offer to connect them with the right person
- Keep responses concise but informative
- Use the knowledge base above when relevant`;

    // Build conversation history
    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    existingMessages.forEach((m) => {
      messages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      });
    });

    messages.push({ role: "user", content: message });

    // Call OpenAI (or fallback to simple response)
    let response: string;

    if (OPENAI_API_KEY) {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!aiRes.ok) {
        console.error("OpenAI API error:", await aiRes.text());
        response = npc.greeting || `Hello! I'm ${npc.name}. How can I help you today?`;
      } else {
        const aiData = await aiRes.json();
        response = aiData.choices?.[0]?.message?.content || "I apologize, I'm having trouble responding right now.";
      }
    } else {
      // No API key — return greeting
      response = npc.greeting || `Hello! I'm ${npc.name}, ${npc.title || npc.role}. How can I help you today?`;
    }

    // Save messages to database
    const [session] = await db
      .select()
      .from(oasisNpcSessions)
      .where(eq(oasisNpcSessions.sessionId, currentSessionId))
      .limit(1);

    if (session) {
      await db.insert(oasisNpcMessages).values([
        {
          sessionId: session.id,
          role: "user",
          content: message,
        },
        {
          sessionId: session.id,
          role: "npc",
          content: response,
        },
      ]);
    }

    return NextResponse.json({
      response,
      sessionId: currentSessionId,
      npc: {
        id: npc.id,
        npcId: npc.npcId,
        name: npc.name,
        title: npc.title,
        avatarEmoji: npc.avatarEmoji,
        role: npc.role,
      },
    });
  } catch (error) {
    console.error("NPC Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}

// GET: Fetch chat history for a session
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const [session] = await db
      .select()
      .from(oasisNpcSessions)
      .where(eq(oasisNpcSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await db
      .select()
      .from(oasisNpcMessages)
      .where(eq(oasisNpcMessages.sessionId, session.id))
      .orderBy(oasisNpcMessages.createdAt);

    const [npc] = await db
      .select()
      .from(oasisNpcs)
      .where(eq(oasisNpcs.id, session.npcId))
      .limit(1);

    return NextResponse.json({
      session: {
        id: session.sessionId,
        messageCount: session.messageCount,
        startedAt: session.startedAt,
        lastActivity: session.lastActivity,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      npc: npc
        ? {
            id: npc.id,
            npcId: npc.npcId,
            name: npc.name,
            title: npc.title,
            avatarEmoji: npc.avatarEmoji,
          }
        : null,
    });
  } catch (error) {
    console.error("NPC Chat history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history" },
      { status: 500 }
    );
  }
}
