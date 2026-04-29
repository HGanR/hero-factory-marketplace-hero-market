import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { agentArchitectureMaps } from "@/lib/db/schema";
import { ensureAgentArchitectureMapsTable, ensureAgentWebhookRegistrationsTable } from "@/lib/agent-maps/db";

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (Array.isArray(parsed) ? parsed : fallback) as T;
  } catch {
    return fallback;
  }
}

function needsWebhookRegistration(node: { data?: { nodeType?: string; triggerKind?: string; platform?: string } }): boolean {
  const d = node.data ?? {};
  if (d.nodeType !== "Trigger") return false;
  return d.triggerKind === "on_webhook" || d.platform === "webhook" || d.platform === "telegram";
}

async function registerTelegramWebhook(botToken: string, webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    const res = await fetch(url);
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.description ?? "Telegram setWebhook failed" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram registration failed" };
  }
}

function getWebhookBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "";
  if (u.startsWith("http")) return u;
  return u ? `https://${u}` : "";
}

/** GET: Fetch map for workspace. Returns existing or empty default. */
export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const db = await getDb();
    await ensureAgentArchitectureMapsTable(db);

    const [row] = await db
      .select()
      .from(agentArchitectureMaps)
      .where(
        and(
          eq(agentArchitectureMaps.workspaceId, workspaceId),
          eq(agentArchitectureMaps.userId, userId)
        )
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({
        id: null,
        title: "Agent Architecture Map",
        nodes: [],
        edges: [],
      });
    }

    return NextResponse.json({
      id: row.id,
      title: row.title,
      nodes: safeJsonParse(row.nodesJson, []),
      edges: safeJsonParse(row.edgesJson, []),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agent-maps GET error:", err);
    return NextResponse.json({ error: "Failed to fetch map" }, { status: 500 });
  }
}

/** PUT: Upsert map for workspace. Registers webhooks for on_webhook triggers. */
export async function PUT(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : null;
    const consultantId = typeof body?.consultantId === "string" ? body.consultantId.trim() || null : null;
    const title = typeof body?.title === "string" ? body.title.trim() : "Agent Architecture Map";
    let nodes = Array.isArray(body?.nodes) ? body.nodes : [];
    const edges = Array.isArray(body?.edges) ? body.edges : [];

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const db = await getDb();
    await ensureAgentArchitectureMapsTable(db);
    await ensureAgentWebhookRegistrationsTable(db);

    const webhookUrls: { nodeId: string; label?: string; url: string; telegramOk?: boolean }[] = [];
    const baseUrl = getWebhookBaseUrl();

    for (const node of nodes) {
      if (!needsWebhookRegistration(node) || !node.id) continue;
      let webhookKey = (node.data?.webhookKey as string)?.trim();
      if (!webhookKey || webhookKey.length < 16) {
        webhookKey = crypto.randomBytes(24).toString("hex");
        nodes = nodes.map((n: { id: string; data?: Record<string, unknown> }) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, webhookKey } }
            : n
        );
      }
      await db.execute(
        sql`
          INSERT INTO agent_webhook_registrations (webhookKey, userId, workspaceId, triggerNodeId)
          VALUES (${webhookKey}, ${userId}, ${workspaceId}, ${node.id})
          ON DUPLICATE KEY UPDATE workspaceId = VALUES(workspaceId), triggerNodeId = VALUES(triggerNodeId)
        `
      );
      const webhookUrl = baseUrl ? `${baseUrl}/api/app/webhooks/${webhookKey}` : "";
      let telegramOk: boolean | undefined;
      if (node.data?.platform === "telegram" && webhookUrl) {
        const token = (node.data?.accessToken ?? node.data?.apiKey ?? "") as string;
        if (token.trim()) {
          const reg = await registerTelegramWebhook(token.trim(), webhookUrl);
          telegramOk = reg.ok;
        }
      }
      if (baseUrl) {
        webhookUrls.push({
          nodeId: node.id,
          label: node.data?.label as string,
          url: webhookUrl,
          telegramOk,
        });
      }
    }

    const [existing] = await db
      .select({ id: agentArchitectureMaps.id })
      .from(agentArchitectureMaps)
      .where(
        and(
          eq(agentArchitectureMaps.workspaceId, workspaceId),
          eq(agentArchitectureMaps.userId, userId)
        )
      )
      .limit(1);

    const id = existing?.id ?? crypto.randomUUID();

    if (existing) {
      await db
        .update(agentArchitectureMaps)
        .set({
          title,
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
          consultantId,
        })
        .where(eq(agentArchitectureMaps.id, id));
    } else {
      await db.insert(agentArchitectureMaps).values({
        id,
        userId,
        workspaceId,
        consultantId,
        title,
        nodesJson: JSON.stringify(nodes),
        edgesJson: JSON.stringify(edges),
      });
    }

    return NextResponse.json({ id, ok: true, nodes, webhookUrls });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agent-maps PUT error:", err);
    return NextResponse.json({ error: "Failed to save map" }, { status: 500 });
  }
}
