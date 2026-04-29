// Company Status API - Execution readiness workflow with audit trail
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { companies, trustDocuments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const UpdateStatusSchema = z.object({
  status: z.enum(["draft", "counsel_reviewed", "board_adopted", "execution_ready"]),
  counselReviewNotes: z.string().optional(),
  boardMeetingDate: z.string().optional(), // ISO date string
  boardResolutionNumber: z.string().optional(),
  executionNotes: z.string().optional(),
});

// Status transition validation
function canTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    draft: ["counsel_reviewed", "board_adopted"],
    counsel_reviewed: ["board_adopted", "execution_ready"],
    board_adopted: ["execution_ready"],
    execution_ready: [], // Terminal state
  };
  return transitions[from]?.includes(to) ?? false;
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  let body: z.infer<typeof UpdateStatusSchema>;
  try {
    body = UpdateStatusSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Get current company status
  const companyCheck = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (companyCheck.length === 0) {
    return NextResponse.json({ error: "Company not found or access denied" }, { status: 404 });
  }

  const currentCompany = companyCheck[0];

  // Validate status transition
  if (!canTransition(currentCompany.status, body.status)) {
    return NextResponse.json({
      error: `Invalid status transition from ${currentCompany.status} to ${body.status}`
    }, { status: 400 });
  }

  // Build audit metadata
  const auditMetadata: Record<string, any> = {
    previousStatus: currentCompany.status,
    newStatus: body.status,
    transitionedAt: new Date().toISOString(),
    transitionedBy: userId,
  };

  if (body.status === "counsel_reviewed" && body.counselReviewNotes) {
    auditMetadata.counselReviewNotes = body.counselReviewNotes;
  }

  if (body.status === "board_adopted") {
    auditMetadata.boardMeetingDate = body.boardMeetingDate;
    auditMetadata.boardResolutionNumber = body.boardResolutionNumber;
  }

  if (body.status === "execution_ready" && body.executionNotes) {
    auditMetadata.executionNotes = body.executionNotes;
  }

  // Update company status
  await db.update(companies)
    .set({
      status: body.status,
      updatedAt: new Date(),
      // Note: We could store the audit trail in a separate table or append to draftJson
      draftJson: currentCompany.draftJson ? JSON.stringify({
        ...JSON.parse(currentCompany.draftJson),
        statusAudit: [
          ...(JSON.parse(currentCompany.draftJson).statusAudit || []),
          auditMetadata
        ]
      }) : JSON.stringify({ statusAudit: [auditMetadata] }),
    })
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));

  // If moving to execution_ready, mark all draft documents as finalized
  if (body.status === "execution_ready") {
    await db.update(trustDocuments)
      .set({
        disclosureState: "shared", // Mark as shared when execution ready
        updatedAt: new Date(),
      })
      .where(eq(trustDocuments.trustId, `company-${companyId}`));
  }

  return NextResponse.json({
    message: `Company status updated to ${body.status}`,
    status: body.status,
    auditEntry: auditMetadata,
  });
}
