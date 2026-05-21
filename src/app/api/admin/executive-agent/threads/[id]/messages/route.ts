import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { isExecutiveOperationalMessageKind } from "@/lib/executive-agent/executive-conversation-threads";
import {
  getExecutiveOperationalThreadDetail,
  postExecutiveOperationalThreadMessage,
} from "@/lib/executive-agent/operational-thread-service";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  bodyText: z.string().min(1).max(20_000),
  messageKind: z
    .string()
    .optional()
    .refine((v) => !v || isExecutiveOperationalMessageKind(v), { message: "invalid_message_kind" }),
  priorityTag: z.string().max(32).optional().nullable(),
  isPinned: z.boolean().optional(),
  ownerOnly: z.boolean().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "80") || 80;

  const db = await getDb();
  try {
    const result = await getExecutiveOperationalThreadDetail(db, {
      adminUserId,
      threadId: id,
      messageLimit: limit,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "READ_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const body = PostSchema.parse(await req.json());
    const db = await getDb();
    const result = await postExecutiveOperationalThreadMessage(db, {
      adminUserId,
      threadId: id,
      bodyText: body.bodyText,
      messageKind: body.messageKind as
        | "discussion"
        | "operational_note"
        | "question"
        | "decision_request"
        | "status_update"
        | "owner_annotation"
        | undefined,
      priorityTag: body.priorityTag,
      isPinned: body.isPinned,
      ownerOnly: body.ownerOnly,
    });
    if (!result.ok) {
      const status = result.error === "thread_not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "POST_FAILED", message: msg }, { status: 500 });
  }
}
