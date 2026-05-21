import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  createExecutiveOperationalTask,
  listExecutiveOperationalTasks,
} from "@/lib/executive-agent/operational-task-service";
import {
  isExecutiveOperationalTaskPriority,
  isExecutiveOperationalTaskStatus,
} from "@/lib/executive-agent/executive-operational-tasks";
import { isExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(20_000),
  priority: z
    .string()
    .optional()
    .refine((v) => !v || isExecutiveOperationalTaskPriority(v), { message: "invalid_priority" }),
  ownerLabel: z.string().max(64).optional(),
  department: z.enum(["WEBSITE", "TRUST"]).optional().nullable(),
  recommendedAgent: z.string().max(64).optional().nullable(),
  decisionId: z.string().max(36).optional().nullable(),
  threadId: z.string().max(36).optional().nullable(),
  approvalId: z.string().max(36).optional().nullable(),
  orderId: z.string().max(191).optional().nullable(),
  clientId: z.string().max(191).optional().nullable(),
  subjectId: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  dependsOnTaskIds: z.array(z.string().max(36)).max(12).optional(),
});

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const subjectId = p.get("subjectId");
  if (subjectId && !isExecutiveSubjectId(subjectId)) {
    return NextResponse.json({ error: "invalid_subject_id" }, { status: 400 });
  }

  const status = p.get("status");
  if (status && !isExecutiveOperationalTaskStatus(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await listExecutiveOperationalTasks(db, {
      adminUserId,
      subjectId,
      threadId: p.get("threadId"),
      decisionId: p.get("decisionId"),
      orderId: p.get("orderId"),
      status,
      limit: Number(p.get("limit") ?? "80") || 80,
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
    const result = await createExecutiveOperationalTask(db, {
      adminUserId,
      title: body.title,
      description: body.description,
      priority: body.priority as "low" | "normal" | "high" | "urgent" | undefined,
      ownerLabel: body.ownerLabel,
      department: body.department ?? null,
      recommendedAgent: body.recommendedAgent,
      decisionId: body.decisionId,
      threadId: body.threadId,
      approvalId: body.approvalId,
      orderId: body.orderId,
      clientId: body.clientId,
      subjectId: body.subjectId ?? null,
      dueAt: body.dueAt,
      dependsOnTaskIds: body.dependsOnTaskIds,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "CREATE_FAILED", message: msg }, { status: 500 });
  }
}
