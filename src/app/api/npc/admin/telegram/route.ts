import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireNpcAdminSession } from "@/lib/admin/require-npc-admin";
import { getDb } from "@/lib/db";
import { oasisNpcs } from "@/lib/db/schema";
import { ensureNpcTables } from "@/lib/npc/ensure";

function getWebhookBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "";
  if (u.startsWith("http")) return u;
  return u ? `https://${u}` : "";
}

async function registerTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<{ ok: boolean; error?: string; botUsername?: string }> {
  try {
    const setUrl = `https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    const setRes = await fetch(setUrl);
    const setData = await setRes.json();
    
    if (!setData.ok) {
      return { ok: false, error: setData.description ?? "Failed to set webhook" };
    }

    const meUrl = `https://api.telegram.org/bot${botToken.trim()}/getMe`;
    const meRes = await fetch(meUrl);
    const meData = await meRes.json();
    
    const botUsername = meData.ok ? meData.result?.username : undefined;
    
    return { ok: true, botUsername };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Registration failed" };
  }
}

async function deleteTelegramWebhook(botToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/deleteWebhook`;
    const res = await fetch(url);
    const data = await res.json();
    return data.ok ? { ok: true } : { ok: false, error: data.description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to disconnect" };
  }
}

async function getBotInfo(botToken: string): Promise<{ ok: boolean; username?: string; firstName?: string; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/getMe`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description ?? "Invalid bot token" };
    }
    return {
      ok: true,
      username: data.result?.username,
      firstName: data.result?.first_name,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to verify token" };
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const npcId = searchParams.get("npcId")?.trim();

  if (!npcId) {
    return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
  }

  const db = await getDb();
  await ensureNpcTables(db);

  const [row] = await db
    .select({
      id: oasisNpcs.id,
      npcId: oasisNpcs.npcId,
      name: oasisNpcs.name,
      telegramBotToken: oasisNpcs.telegramBotToken,
      telegramWebhookKey: oasisNpcs.telegramWebhookKey,
      telegramConnectedAt: oasisNpcs.telegramConnectedAt,
    })
    .from(oasisNpcs)
    .where(eq(oasisNpcs.npcId, npcId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  const baseUrl = getWebhookBaseUrl();
  const webhookUrl = row.telegramWebhookKey && baseUrl
    ? `${baseUrl}/api/npc/telegram/${row.telegramWebhookKey}`
    : null;

  let botInfo: { username?: string; firstName?: string } | null = null;
  if (row.telegramBotToken) {
    const info = await getBotInfo(row.telegramBotToken);
    if (info.ok) {
      botInfo = { username: info.username, firstName: info.firstName };
    }
  }

  return NextResponse.json({
    npcId: row.npcId,
    isConnected: !!(row.telegramBotToken && row.telegramWebhookKey),
    hasToken: !!row.telegramBotToken,
    webhookUrl,
    botInfo,
    connectedAt: row.telegramConnectedAt,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const npcId = String(body?.npcId || "").trim();
  const botToken = String(body?.botToken || "").trim();

  if (!npcId) {
    return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
  }
  if (!botToken) {
    return NextResponse.json({ error: "Missing botToken" }, { status: 400 });
  }

  const botInfo = await getBotInfo(botToken);
  if (!botInfo.ok) {
    return NextResponse.json({ error: botInfo.error || "Invalid bot token" }, { status: 400 });
  }

  const db = await getDb();
  await ensureNpcTables(db);

  const [row] = await db
    .select({ id: oasisNpcs.id, npcId: oasisNpcs.npcId })
    .from(oasisNpcs)
    .where(eq(oasisNpcs.npcId, npcId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  const webhookKey = crypto.randomBytes(24).toString("hex");
  const baseUrl = getWebhookBaseUrl();

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Server URL not configured. Set NEXT_PUBLIC_APP_URL or VERCEL_URL." },
      { status: 500 }
    );
  }

  const webhookUrl = `${baseUrl}/api/npc/telegram/${webhookKey}`;
  const registration = await registerTelegramWebhook(botToken, webhookUrl);

  if (!registration.ok) {
    return NextResponse.json(
      { error: registration.error || "Failed to register webhook with Telegram" },
      { status: 400 }
    );
  }

  await db
    .update(oasisNpcs)
    .set({
      telegramBotToken: botToken,
      telegramWebhookKey: webhookKey,
      telegramConnectedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(oasisNpcs.npcId, npcId));

  return NextResponse.json({
    ok: true,
    webhookUrl,
    botUsername: registration.botUsername || botInfo.username,
    botFirstName: botInfo.firstName,
  });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const npcId = String(body?.npcId || "").trim();

  if (!npcId) {
    return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
  }

  const db = await getDb();
  await ensureNpcTables(db);

  const [row] = await db
    .select({
      id: oasisNpcs.id,
      telegramBotToken: oasisNpcs.telegramBotToken,
    })
    .from(oasisNpcs)
    .where(eq(oasisNpcs.npcId, npcId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  if (row.telegramBotToken) {
    await deleteTelegramWebhook(row.telegramBotToken);
  }

  await db
    .update(oasisNpcs)
    .set({
      telegramBotToken: null,
      telegramWebhookKey: null,
      telegramConnectedAt: null,
    })
    .where(eq(oasisNpcs.npcId, npcId));

  return NextResponse.json({ ok: true });
}
