/**
 * Platform API v1 - Event Stream (SSE)
 * GET /api/v1/events/stream - Server-Sent Events stream of platform activity
 * Requires read:events scope.
 * Query params:
 *   token - API key (required when not using Bearer; EventSource cannot send headers)
 *   eventType - Filter to specific event type (e.g. world_published)
 *   scope=public - Stream platform-wide public events (world_published, app_published, etc.)
 */
import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformActivity } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";

const POLL_INTERVAL_MS = 2000;

const PUBLIC_EVENT_TYPES = [
  "world_published",
  "commerce_node_created",
  "commerce_transaction",
  "app_published",
  "app_installed",
  "asset_purchased",
] as const;

export async function GET(req: NextRequest) {
  let ctx = await getPlatformApiContext(req);
  if (!ctx) {
    const token = req.nextUrl.searchParams.get("token");
    if (token) {
      const crypto = await import("crypto");
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const db = await getDb();
      const { developerApiKeys } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const [key] = await db.select().from(developerApiKeys).where(eq(developerApiKeys.keyHash, hash)).limit(1);
      if (key) {
        const { resolveScopes } = await import("@/lib/platform-api/scopes");
        ctx = {
          userId: key.userId,
          scopes: resolveScopes(key.scopes),
          authType: "api_key" as const,
          apiKeyId: key.id,
        };
      }
    }
  }
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:events")) return forbidden();

  const eventTypeFilter = req.nextUrl.searchParams.get("eventType");
  const scopeParam = req.nextUrl.searchParams.get("scope");

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
          const db = await getDb();
          const { and: andOp } = await import("drizzle-orm");
          const conditions = [eq(platformActivity.userId, ctx.userId)];
          if (eventTypeFilter) {
            conditions.push(eq(platformActivity.eventType, eventTypeFilter));
          }
          if (scopeParam === "public") {
            const { inArray } = await import("drizzle-orm");
            conditions.length = 0;
            conditions.push(inArray(platformActivity.eventType, [...PUBLIC_EVENT_TYPES]));
          }
          const whereClause = conditions.length === 1 ? conditions[0] : andOp(...conditions);

          const rows = lastCreatedAt
            ? await db
                .select()
                .from(platformActivity)
                .where(whereClause)
                .orderBy(desc(platformActivity.createdAt))
                .limit(50)
            : await db
                .select()
                .from(platformActivity)
                .where(whereClause)
                .orderBy(desc(platformActivity.createdAt))
                .limit(10);

          const toSend = lastCreatedAt
            ? rows.filter((r) => r.createdAt && r.createdAt > lastCreatedAt!)
            : rows;

          for (const r of toSend.reverse()) {
            send(`event: ${r.eventType}\ndata: ${JSON.stringify({
              id: r.id,
              eventType: r.eventType,
              sourceModule: r.sourceModule,
              payload: r.payload,
              trustId: r.trustId,
              createdAt: r.createdAt?.toISOString(),
            })}\n\n`);
          }

          if (rows.length > 0 && rows[0].createdAt) {
            lastCreatedAt = rows[0].createdAt;
          }
        } catch (e) {
          console.error("[v1/events/stream] poll error", e);
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
