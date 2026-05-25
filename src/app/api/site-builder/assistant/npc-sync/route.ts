import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { syncStephonSiteBuilderMessage } from "@/lib/site-builder/stephon-session-sync";
import { shouldPersistChatMessage } from "@/lib/site-builder/assistant-chat-persistence";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  siteId: z.string().max(128).optional().nullable(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
  topic: z.string().max(255).optional().nullable(),
});

/** POST /api/site-builder/assistant/npc-sync — mirror Stephon chat to OASIS for executive usability intelligence. */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (userId == null) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  if (
    !shouldPersistChatMessage({
      role: body.role,
      content: body.content,
    })
  ) {
    return NextResponse.json({ ok: true, skipped: true, reason: "non_persistable" });
  }

  const result = await syncStephonSiteBuilderMessage({
    userId,
    siteId: body.siteId,
    role: body.role,
    content: body.content,
    topic: body.topic,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason ?? "sync_failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}
