import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisNpcs } from "@/lib/db/schema";
import { ensureNpcTables } from "@/lib/npc/ensure";
import { buildNpcResponse } from "@/lib/npc/engine";
import { generateLlmResponse } from "@/lib/npc/llm-bridge";
import {
  addMessage,
  createSession,
  getKnowledgeForNpc,
  getNpcByNpcId,
  getSessionBySessionId,
  incrementSessionMessageCount,
} from "@/lib/npc/db";

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: replyToMessageId,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

function generateTelegramSessionId(chatId: number, npcId: string): string {
  return `telegram-${chatId}-${npcId}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ webhookKey: string }> }
) {
  const { webhookKey } = await params;
  
  if (!webhookKey) {
    return NextResponse.json({ error: "Invalid webhook key" }, { status: 400 });
  }

  const db = await getDb();
  await ensureNpcTables(db);

  const [npcRow] = await db
    .select()
    .from(oasisNpcs)
    .where(eq(oasisNpcs.telegramWebhookKey, webhookKey))
    .limit(1);

  if (!npcRow || !npcRow.telegramBotToken) {
    return NextResponse.json({ ok: true });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
  if (!message?.text || message.from?.is_bot) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const userMessage = message.text.trim();
  const messageId = message.message_id;

  if (!userMessage || userMessage.startsWith("/start")) {
    const greeting = npcRow.greeting || `Hello! I'm ${npcRow.name}. How can I help you?`;
    await sendTelegramMessage(npcRow.telegramBotToken, chatId, greeting);
    return NextResponse.json({ ok: true });
  }

  if (userMessage.startsWith("/")) {
    return NextResponse.json({ ok: true });
  }

  const profile = await getNpcByNpcId(npcRow.npcId);
  if (!profile) {
    return NextResponse.json({ ok: true });
  }

  const sessionId = generateTelegramSessionId(chatId, npcRow.npcId);
  let session = await getSessionBySessionId(sessionId);
  
  if (!session) {
    await createSession({
      sessionId,
      npcRowId: npcRow.id,
      npcNpcId: npcRow.npcId,
      userId: null,
    });
    session = await getSessionBySessionId(sessionId);
  }

  if (!session) {
    console.error("Failed to create Telegram session");
    return NextResponse.json({ ok: true });
  }

  const knowledge = await getKnowledgeForNpc(npcRow.id);
  let response = buildNpcResponse({ message: userMessage, profile, knowledge });

  if (response.source === "rule" && response.intent === "unknown") {
    try {
      const llmResponse = await generateLlmResponse({ message: userMessage, profile, knowledge });
      if (llmResponse?.text) {
        response = {
          ...llmResponse,
          suggestions: llmResponse.suggestions?.length ? llmResponse.suggestions : response.suggestions,
        };
      }
    } catch {
      // Keep rule-based response if LLM fails
    }
  }

  await addMessage({
    sessionRowId: session.id,
    role: "user",
    content: userMessage,
    intent: response.intent,
  });
  await addMessage({
    sessionRowId: session.id,
    role: "npc",
    content: response.text,
    intent: response.intent,
    responseSource: response.source,
  });
  await incrementSessionMessageCount(sessionId, 2);

  await sendTelegramMessage(
    npcRow.telegramBotToken,
    chatId,
    response.text,
    messageId
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ status: "Telegram webhook endpoint active" });
}
