import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { accountingProfiles } from "@/lib/db/schema.pre-accounting";
import {
  createReviewItem,
  listReviewItemsForProfile,
  type ReviewItemSourceType,
} from "@/lib/accounting/pre-accounting/server/review-items";

export const runtime = "nodejs";

const SOURCE_TYPES = new Set<ReviewItemSourceType>([
  "missing_document",
  "document_review",
  "ledger_unresolved",
  "form_support_gap",
  "incomplete_quarter",
  "handoff_deficiency",
  "manual",
]);

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const taxYear = Math.min(
      2100,
      Math.max(2000, Number(request.nextUrl.searchParams.get("taxYear") || new Date().getFullYear()))
    );
    const db = await getDb();
    const prof = await db
      .select({ id: accountingProfiles.id })
      .from(accountingProfiles)
      .where(and(eq(accountingProfiles.userId, userId), eq(accountingProfiles.taxYear, taxYear)))
      .limit(1);
    if (!prof[0]) {
      return NextResponse.json({ ok: true, reviewItems: [] });
    }
    const reviewItems = await listReviewItemsForProfile(prof[0].id);
    return NextResponse.json({ ok: true, reviewItems });
  } catch (e) {
    console.error("[review-items GET]", e);
    return NextResponse.json({ error: "Failed to list review items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      taxYear: number;
      sourceType?: string;
      sourceId?: string | null;
      title?: string;
      description?: string | null;
      severity?: string;
      status?: string;
      assignedRole?: string;
      dueAt?: string | null;
      resolutionNotes?: string | null;
    };
    const taxYear = Math.min(2100, Math.max(2000, Number(body.taxYear)));
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const st = body.sourceType as ReviewItemSourceType;
    if (!st || !SOURCE_TYPES.has(st)) {
      return NextResponse.json({ error: "invalid sourceType" }, { status: 400 });
    }
    const db = await getDb();
    const prof = await db
      .select({ id: accountingProfiles.id })
      .from(accountingProfiles)
      .where(and(eq(accountingProfiles.userId, userId), eq(accountingProfiles.taxYear, taxYear)))
      .limit(1);
    if (!prof[0]) {
      return NextResponse.json({ error: "Profile not found for year" }, { status: 404 });
    }
    const created = await createReviewItem(prof[0].id, userId, {
      sourceType: st,
      sourceId: body.sourceId ?? null,
      title: body.title.trim(),
      description: body.description ?? null,
      severity: (body.severity as "info" | "warning" | "blocker") ?? "warning",
      status: (body.status as "open" | "in_progress" | "waiting_on_client" | "resolved" | "waived") ?? "open",
      assignedRole: (body.assignedRole as "client" | "reviewer" | "preparer" | "admin") ?? "reviewer",
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      resolutionNotes: body.resolutionNotes ?? null,
    });
    return NextResponse.json({ ok: true, reviewItem: created });
  } catch (e) {
    console.error("[review-items POST]", e);
    return NextResponse.json({ error: "Failed to create review item" }, { status: 500 });
  }
}
