/**
 * GET /api/worlds/[worldId]/activity-stream
 * SSE stream of platform activity relevant to this world.
 * Events with payload.worldId = worldId, plus platform-wide public events.
 * No auth required for published public worlds; session for private.
 */
import { NextRequest } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformActivity } from "@/lib/db/schema";
import { worlds } from "@/lib/db/schema.worlds";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";

const POLL_INTERVAL_MS = 3000;

const WORLD_RELEVANT_EVENT_TYPES = [
  "world_published",
  "commerce_node_created",
  "commerce_transaction",
  "app_published",
  "app_installed",
  "asset_purchased",
  "entity_created",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;
  if (!worldId) return new Response("Missing worldId", { status: 400 });

  const db = await getDb();
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return new Response("World not found", { status: 404 });

  const userId = await getAuthedUserId();
  const isOwner = userId !== null && world.ownerId === userId;
  const isPublic = world.visibility === "public" || world.visibility === "unlisted";
  const isPublished = world.status === "published";
  if (!isOwner && (!isPublic || !isPublished)) {
    return new Response("World not found", { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCreatedAt: Date | null = null;

      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };

      send(": connected\n\n");

      const poll = async () => {
        try {
          const rows = await db
            .select()
            .from(platformActivity)
            .where(inArray(platformActivity.eventType, [...WORLD_RELEVANT_EVENT_TYPES]))
            .orderBy(desc(platformActivity.createdAt))
            .limit(lastCreatedAt ? 100 : 20);

          const filtered = rows.filter((r) => {
            const payload = (r.payload as Record<string, unknown>) ?? {};
            const eventWorldId = payload.worldId as string | undefined;
            if (eventWorldId) return eventWorldId === worldId;
            return true;
          });

          const toSend = lastCreatedAt
            ? filtered.filter((r) => r.createdAt && r.createdAt > lastCreatedAt!)
            : filtered;

          for (const r of toSend.reverse()) {
            send(
              `event: ${r.eventType}\ndata: ${JSON.stringify({
                id: r.id,
                eventType: r.eventType,
                sourceModule: r.sourceModule,
                payload: r.payload,
                trustId: r.trustId,
                createdAt: r.createdAt?.toISOString(),
              })}\n\n`
            );
          }

          if (rows.length > 0 && rows[0].createdAt) {
            lastCreatedAt = rows[0].createdAt;
          }
        } catch (e) {
          console.error("[worlds/activity-stream] poll error", e);
        }
      };

      await poll();
      const interval = setInterval(poll, POLL_INTERVAL_MS);

      req.signal?.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
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
