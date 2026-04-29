import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { trusts, resolutions, minutes, minuteBooks } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { requiresResolutionForComplexTrust, ComplexTrustAction } from "@/lib/governance/complex-trust-requirements";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { trustId, action } = body as { trustId: string; action: ComplexTrustAction };

    if (!trustId || !action) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "trustId and action are required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const trustRows = await db.select().from(trusts).where(eq(trusts.id, trustId)).limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Trust not found" } }, { status: 404 });
    }

    const trust = trustRows[0];

    // Check if resolution is required
    const requirement = requiresResolutionForComplexTrust(
      action,
      trust.trustMode,
      trust.complexTrustMode ?? false
    );

    if (!requirement.required) {
      return NextResponse.json({ ok: true, required: false });
    }

    // Check for existing approved resolutions that might cover this action
    // Resolutions link to minutes, which link to minuteBooks, which have trustId
    const resolutionRows = await db
      .select({
        resolution: resolutions,
        minutes: minutes,
        minuteBook: minuteBooks,
      })
      .from(resolutions)
      .innerJoin(minutes, eq(resolutions.minutesId, minutes.id))
      .innerJoin(minuteBooks, eq(minutes.minuteBookId, minuteBooks.id))
      .where(
        and(
          eq(minuteBooks.trustId, trustId),
          eq(resolutions.status, "approved")
        )
      );

    // Filter to only resolutions whose parent minutes are approved/locked
    const eligibleResolutions = resolutionRows
      .filter((row) => ["approved", "locked"].includes(row.minutes.status || ""))
      .map((row) => row.resolution);

    return NextResponse.json({
      ok: true,
      required: true,
      reason: requirement.reason,
      existingResolutions: eligibleResolutions.map((r) => ({
        id: r.id,
        title: r.title,
        resolutionType: r.resolutionType,
        status: r.status,
      })),
    });
  } catch (error: any) {
    console.error("Check requirement error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to check requirement" } },
      { status: 500 }
    );
  }
}
