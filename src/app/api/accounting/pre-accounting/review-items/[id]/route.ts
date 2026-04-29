import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { accountingProfiles, accountingReviewItems } from "@/lib/db/schema.pre-accounting";
import { updateReviewItem } from "@/lib/accounting/pre-accounting/server/review-items";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const itemId = Number((await ctx.params).id);
    if (!Number.isFinite(itemId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = (await request.json()) as {
      status?: string;
      severity?: string;
      assignedRole?: string;
      resolutionNotes?: string | null;
      dueAt?: string | null;
      title?: string;
      description?: string | null;
    };

    const db = await getDb();
    const row = await db
      .select({
        profileId: accountingReviewItems.accountingProfileId,
      })
      .from(accountingReviewItems)
      .where(eq(accountingReviewItems.id, itemId))
      .limit(1);
    if (!row[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const own = await db
      .select({ id: accountingProfiles.id })
      .from(accountingProfiles)
      .where(and(eq(accountingProfiles.id, row[0].profileId), eq(accountingProfiles.userId, userId)))
      .limit(1);
    if (!own[0]) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const patch: Partial<{
      status: string;
      severity: string;
      assignedRole: string;
      resolutionNotes: string | null;
      dueAt: Date | null;
      title: string;
      description: string | null;
    }> = {};
    if (typeof body.status === "string") patch.status = body.status;
    if (typeof body.severity === "string") patch.severity = body.severity;
    if (typeof body.assignedRole === "string") patch.assignedRole = body.assignedRole;
    if (body.resolutionNotes !== undefined) patch.resolutionNotes = body.resolutionNotes;
    if (body.dueAt !== undefined) patch.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (typeof body.title === "string") patch.title = body.title.slice(0, 512);
    if (body.description !== undefined) patch.description = body.description;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const updated = await updateReviewItem(row[0].profileId, itemId, userId, patch);
    return NextResponse.json({ ok: true, reviewItem: updated });
  } catch (e) {
    console.error("[review-items PATCH]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
