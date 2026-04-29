import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import {
  incrementBroadcastRealtimeConnect,
  incrementBroadcastRealtimeDisconnect,
} from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import { getBroadcastRenderSessionByToken } from "@/lib/meet/broadcast-render-sessions";
import { subscribeMeetBroadcastRealtimeSse } from "@/lib/meet/broadcast-realtime-sse";

export const dynamic = "force-dynamic";

/**
 * GET /api/meet/broadcast/render-events?rsid=&token=
 * Token-gated SSE for egress template (no user session). Same invalidation hints as operator feed.
 */
export async function GET(req: NextRequest) {
  const rsidRaw = req.nextUrl.searchParams.get("rsid")?.trim() ?? "";
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  const id = Number(rsidRaw);
  if (!Number.isFinite(id) || !token) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await getBroadcastRenderSessionByToken(id, token);
  if (!row) {
    return new Response(JSON.stringify({ ok: false, error: "Expired or not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = await getDb();
  const sessRows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, row.broadcastSessionId))
    .limit(1);
  const session = sessRows[0];
  if (!session || !isV2LiveSceneControlAvailable(session)) {
    return new Response(JSON.stringify({ ok: false, error: "Not available" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const broadcastSessionId = row.broadcastSessionId;
  const roomId = session.roomId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const unsub = await subscribeMeetBroadcastRealtimeSse({
        req,
        broadcastSessionId,
        roomId,
        userId: row.userId,
        channelLabel: "template",
        renderSessionId: id,
        safeEnqueue,
      });
      safeEnqueue(encoder.encode(": connected\n\n"));

      broadcastAudit("broadcast_realtime_connected", {
        broadcastSessionId,
        userId: row.userId,
        roomId,
        channel: "template",
        renderSessionId: id,
      });
      incrementBroadcastRealtimeConnect({
        userId: row.userId,
        roomId,
        sessionId: broadcastSessionId,
        reason: "template",
      });

      const hb = setInterval(() => {
        safeEnqueue(encoder.encode(": hb\n\n"));
      }, 25_000);

      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(hb);
        unsub();
        broadcastAudit("broadcast_realtime_disconnected", {
          broadcastSessionId,
          userId: row.userId,
          roomId,
          channel: "template",
          renderSessionId: id,
        });
        incrementBroadcastRealtimeDisconnect({
          userId: row.userId,
          roomId,
          sessionId: broadcastSessionId,
          reason: "abort_template",
        });
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
