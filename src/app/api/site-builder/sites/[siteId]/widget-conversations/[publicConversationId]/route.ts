import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import {
  getWidgetConversationForSiteByPublicId,
  listWidgetMessagesForConversation,
} from "@/lib/widget/widget-conversation-service";

type Params = { params: Promise<{ siteId: string; publicConversationId: string }> };

/** Authenticated: single conversation + messages (no secrets). */
export async function GET(_req: Request, { params }: Params) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId, publicConversationId } = await params;
    if (!siteId?.trim() || !publicConversationId?.trim()) {
      return NextResponse.json({ error: "siteId and publicConversationId required" }, { status: 400 });
    }

    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId.trim());
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const found = await getWidgetConversationForSiteByPublicId(db, site.id, publicConversationId.trim());
    if (!found) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const c = found.conversation;

    const messages = await listWidgetMessagesForConversation(db, c.id, 500);
    return NextResponse.json({
      conversation: {
        publicConversationId: c.publicConversationId,
        agentId: c.agentId,
        status: c.status,
        startedAt: c.startedAt,
        lastMessageAt: c.lastMessageAt,
        widgetKeySnapshot: c.widgetKeySnapshot,
        providerStrategySnapshot: c.providerStrategySnapshot,
        siteVersionId: c.siteVersionId,
        originHost: c.originHost,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.contentText,
        status: m.status,
        errorCode: m.errorCode,
        providerStrategySnapshot: m.providerStrategySnapshot,
        modelSnapshot: m.modelSnapshot,
        latencyMs: m.latencyMs,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    console.error("widget-conversations detail GET", e);
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }
}
