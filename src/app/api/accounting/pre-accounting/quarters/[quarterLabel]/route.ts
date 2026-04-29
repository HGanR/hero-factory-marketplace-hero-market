import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { accountingProfiles, accountingQuarterlyWorkflows } from "@/lib/db/schema.pre-accounting";
import { insertAccountingAuditLog } from "@/lib/accounting/pre-accounting/server/audit";

export const runtime = "nodejs";

const Q = new Set(["Q1", "Q2", "Q3", "Q4"]);

type Ctx = { params: Promise<{ quarterLabel: string }> };

/** PATCH closeout checklist JSON for a quarter (server-backed). */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const quarterLabel = (await ctx.params).quarterLabel.toUpperCase();
    if (!Q.has(quarterLabel)) {
      return NextResponse.json({ error: "Invalid quarter" }, { status: 400 });
    }
    const body = (await request.json()) as { taxYear: number; closeoutJson?: Record<string, boolean> | null };
    const taxYear = Math.min(2100, Math.max(2000, Number(body.taxYear)));
    if (!Number.isFinite(taxYear)) {
      return NextResponse.json({ error: "taxYear required" }, { status: 400 });
    }
    if (body.closeoutJson !== undefined && body.closeoutJson !== null && typeof body.closeoutJson !== "object") {
      return NextResponse.json({ error: "closeoutJson must be an object" }, { status: 400 });
    }

    const db = await getDb();
    const prof = await db
      .select({ id: accountingProfiles.id })
      .from(accountingProfiles)
      .where(and(eq(accountingProfiles.userId, userId), eq(accountingProfiles.taxYear, taxYear)))
      .limit(1);
    if (!prof[0]) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profileId = prof[0].id;

    const serialized =
      body.closeoutJson === undefined || body.closeoutJson === null
        ? null
        : JSON.stringify(body.closeoutJson);

    await db
      .update(accountingQuarterlyWorkflows)
      .set({ closeoutJson: serialized })
      .where(
        and(
          eq(accountingQuarterlyWorkflows.accountingProfileId, profileId),
          eq(accountingQuarterlyWorkflows.quarterLabel, quarterLabel)
        )
      );

    await insertAccountingAuditLog({
      accountingProfileId: profileId,
      actorId: userId,
      actionType: "quarter_closeout_updated",
      entityType: "accounting_quarterly_workflows",
      entityId: `${quarterLabel}`,
      metadata: { quarterLabel },
    });

    const row = await db
      .select()
      .from(accountingQuarterlyWorkflows)
      .where(
        and(
          eq(accountingQuarterlyWorkflows.accountingProfileId, profileId),
          eq(accountingQuarterlyWorkflows.quarterLabel, quarterLabel)
        )
      )
      .limit(1);

    return NextResponse.json({ ok: true, quarterlyWorkflow: row[0] ?? null });
  } catch (e) {
    console.error("[quarter PATCH]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
