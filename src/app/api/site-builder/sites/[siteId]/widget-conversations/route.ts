import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import { listWidgetConversationsForSite } from "@/lib/widget/widget-conversation-service";

type Params = { params: Promise<{ siteId: string }> };

/** Authenticated: recent embed widget conversations for a site (transcript audit). */
export async function GET(_req: Request, { params }: Params) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    if (!siteId?.trim()) return NextResponse.json({ error: "siteId required" }, { status: 400 });

    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId.trim());
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const items = await listWidgetConversationsForSite(db, site.id, 50);
    return NextResponse.json({
      siteId: site.id,
      conversations: items.map((c) => ({
        publicConversationId: c.publicConversationId,
        agentId: c.agentId,
        status: c.status,
        lastMessageAt: c.lastMessageAt,
        startedAt: c.startedAt,
        widgetKeySnapshot: c.widgetKeySnapshot,
        providerStrategySnapshot: c.providerStrategySnapshot,
      })),
    });
  } catch (e) {
    console.error("widget-conversations list GET", e);
    return NextResponse.json({ error: "Failed to list conversations" }, { status: 500 });
  }
}
