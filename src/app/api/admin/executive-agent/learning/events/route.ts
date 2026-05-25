import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { insertSkipperLearningEvent } from "@/lib/executive-agent/skipper-learning-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  eventType: z.enum(["helpful", "not_helpful", "save_memory", "suggest_improvement", "voice_command", "analytics_request"]),
  source: z.enum(["chat", "voice", "routine", "system"]).optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = BodySchema.parse(await req.json());
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const id = await insertSkipperLearningEvent(db, {
      adminUserId,
      eventType: body.eventType,
      source: body.source,
      payload: body.payload ?? {},
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "LEARNING_EVENT_FAILED", message: msg }, { status: 500 });
  }
}
