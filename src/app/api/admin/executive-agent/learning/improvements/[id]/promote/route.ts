import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  getSkipperPromptImprovementSuggestionForAdmin,
  insertSkipperPromptOverlay,
  updateSkipperPromptImprovementSuggestionStatus,
} from "@/lib/executive-agent/skipper-learning-store";

export const dynamic = "force-dynamic";

/** Promotes a pending prompt-improvement suggestion to an **active** versioned overlay (admin gate). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const row = await getSkipperPromptImprovementSuggestionForAdmin(db, id, adminUserId);
    if (!row) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
    }
    const overlayId = await insertSkipperPromptOverlay(db, {
      adminUserId,
      title: row.title.slice(0, 500),
      content: row.proposedOverlayContent,
      status: "active",
      sourceSummaryId: row.summaryId,
      approvedAt: new Date(),
    });
    await updateSkipperPromptImprovementSuggestionStatus(db, id, adminUserId, "approved");
    return NextResponse.json({ ok: true, overlayId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "PROMOTE_FAILED", message: msg }, { status: 500 });
  }
}
