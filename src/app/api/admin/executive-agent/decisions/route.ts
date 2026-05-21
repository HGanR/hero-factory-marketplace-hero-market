import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listExecutivePendingDecisions } from "@/lib/executive-agent/decision-queue-service";
import { createExecutiveOperationalDecision } from "@/lib/executive-agent/decision-recording-service";
import {
  isExecutiveOperationalDecisionPriority,
  isExecutiveOperationalDecisionSourceKind,
} from "@/lib/executive-agent/executive-operational-decisions";
import { isExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  title: z.string().min(1).max(500),
  promptSummary: z.string().min(1).max(4000),
  priority: z
    .string()
    .optional()
    .refine((v) => !v || isExecutiveOperationalDecisionPriority(v), { message: "invalid_priority" }),
  sourceKind: z
    .string()
    .optional()
    .refine((v) => !v || isExecutiveOperationalDecisionSourceKind(v), { message: "invalid_source" }),
  threadId: z.string().max(36).optional().nullable(),
  questionMessageId: z.string().max(36).optional().nullable(),
  approvalId: z.string().max(36).optional().nullable(),
  orderId: z.string().max(191).optional().nullable(),
  clientId: z.string().max(191).optional().nullable(),
  subjectId: z.string().optional().nullable(),
  department: z.enum(["WEBSITE", "TRUST"]).optional().nullable(),
  supersedesDecisionId: z.string().max(36).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const subjectId = p.get("subjectId");
  if (subjectId && !isExecutiveSubjectId(subjectId)) {
    return NextResponse.json({ error: "invalid_subject_id" }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await listExecutivePendingDecisions(db, {
      adminUserId,
      subjectId,
      threadId: p.get("threadId"),
      orderId: p.get("orderId"),
      promote: p.get("promote") !== "false",
      limit: Number(p.get("limit") ?? "50") || 50,
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
    const result = await createExecutiveOperationalDecision(db, {
      adminUserId,
      title: body.title,
      promptSummary: body.promptSummary,
      priority: body.priority as "low" | "normal" | "high" | "urgent" | undefined,
      sourceKind: body.sourceKind as
        | "manual"
        | "decision_request"
        | "question"
        | "approval"
        | undefined,
      threadId: body.threadId,
      questionMessageId: body.questionMessageId,
      approvalId: body.approvalId,
      orderId: body.orderId,
      clientId: body.clientId,
      subjectId: body.subjectId ?? null,
      department: body.department ?? null,
      supersedesDecisionId: body.supersedesDecisionId,
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
