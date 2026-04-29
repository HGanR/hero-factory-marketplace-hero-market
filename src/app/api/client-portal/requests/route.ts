import { NextRequest, NextResponse } from "next/server";
import {
  createClientPortalRequest,
  listClientPortalRequests,
} from "@/lib/client-portal/portal-requests";
import { requireClientPortalSession } from "@/lib/client-portal/portal-session";

export async function GET() {
  try {
    const s = await requireClientPortalSession();
    const items = await listClientPortalRequests(s, 100);
    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        status: r.status,
        operatorNote: r.operatorNote,
        relatedConversationId: r.relatedConversationId,
        relatedAgentId: r.relatedAgentId,
        relatedSiteId: r.relatedSiteId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireClientPortalSession();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if ("clientId" in body && body.clientId !== s.tokenPayload.clientId) {
      return NextResponse.json({ error: "Invalid client scope" }, { status: 403 });
    }
    const id = await createClientPortalRequest(s, body);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    if (msg.includes("required")) return NextResponse.json({ error: msg }, { status: 400 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
