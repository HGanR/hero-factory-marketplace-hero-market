import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  isExecutiveOperationalThreadKind,
  isExecutiveOperationalThreadPriority,
  isExecutiveOperationalThreadStatus,
  type ExecutiveOperationalThreadKind,
  type ExecutiveOperationalThreadStatus,
} from "@/lib/executive-agent/executive-conversation-threads";
import { isExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import {
  createExecutiveOperationalThread,
  listExecutiveOperationalThreads,
} from "@/lib/executive-agent/operational-thread-service";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  title: z.string().min(1).max(500),
  threadKind: z.string().refine(isExecutiveOperationalThreadKind, { message: "invalid_thread_kind" }),
  subjectId: z.string().optional().nullable(),
  department: z.enum(["WEBSITE", "TRUST"]).optional().nullable(),
  clientId: z.string().max(191).optional().nullable(),
  orderId: z.string().max(191).optional().nullable(),
  approvalId: z.string().max(36).optional().nullable(),
  priority: z
    .string()
    .optional()
    .refine((v) => !v || isExecutiveOperationalThreadPriority(v), { message: "invalid_priority" }),
  status: z
    .string()
    .optional()
    .refine((v) => !v || isExecutiveOperationalThreadStatus(v), { message: "invalid_status" }),
  decisionNeeded: z.boolean().optional(),
  pinnedNoteText: z.string().max(4000).optional().nullable(),
  initialMessage: z.string().max(20_000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const subjectId = p.get("subjectId");
  if (subjectId && !isExecutiveSubjectId(subjectId)) {
    return NextResponse.json({ error: "invalid_subject_id" }, { status: 400 });
  }

  const threadKind = p.get("threadKind");
  if (threadKind && !isExecutiveOperationalThreadKind(threadKind)) {
    return NextResponse.json({ error: "invalid_thread_kind" }, { status: 400 });
  }

  const status = p.get("status");
  if (status && !isExecutiveOperationalThreadStatus(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await listExecutiveOperationalThreads(db, {
      adminUserId,
      subjectId,
      clientId: p.get("clientId"),
      orderId: p.get("orderId"),
      approvalId: p.get("approvalId"),
      threadKind: (threadKind as ExecutiveOperationalThreadKind | null) ?? undefined,
      status: (status as ExecutiveOperationalThreadStatus | null) ?? undefined,
      decisionNeeded: p.get("decisionNeeded") === "true" ? true : undefined,
      limit: Number(p.get("limit") ?? "40") || 40,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "LIST_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = PostSchema.parse(await req.json());
    if (body.subjectId && !isExecutiveSubjectId(body.subjectId)) {
      return NextResponse.json({ error: "invalid_subject_id" }, { status: 400 });
    }

    const db = await getDb();
    const result = await createExecutiveOperationalThread(db, {
      adminUserId,
      title: body.title,
      threadKind: body.threadKind,
      subjectId: body.subjectId ?? null,
      department: body.department ?? null,
      clientId: body.clientId,
      orderId: body.orderId,
      approvalId: body.approvalId,
      priority: body.priority as "low" | "normal" | "high" | "urgent" | undefined,
      status: body.status as "open" | "monitoring" | "resolved" | "archived" | undefined,
      decisionNeeded: body.decisionNeeded,
      pinnedNoteText: body.pinnedNoteText,
      initialMessage: body.initialMessage,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "CREATE_FAILED", message: msg }, { status: 500 });
  }
}
