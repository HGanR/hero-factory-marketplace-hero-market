import { NextResponse } from "next/server";
import { getClientPortalRequestById } from "@/lib/client-portal/portal-requests";
import { requireClientPortalSession } from "@/lib/client-portal/portal-session";

type Ctx = { params: Promise<{ requestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const s = await requireClientPortalSession();
    const { requestId } = await ctx.params;
    const item = await getClientPortalRequestById(s, requestId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      item: {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        status: item.status,
        operatorNote: item.operatorNote,
        relatedConversationId: item.relatedConversationId,
        relatedAgentId: item.relatedAgentId,
        relatedSiteId: item.relatedSiteId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
