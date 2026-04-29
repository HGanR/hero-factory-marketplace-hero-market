/**
 * Accounting Sync Queue API
 * GET: List pending Trust Records events for review
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  accountingEventInbox,
  accountingFinancingProfiles,
  accountingAssetEncumbrances,
  trusts,
} from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const trustId = searchParams.get("trustId");
  const status = searchParams.get("status") ?? "pending"; // pending | all

  const db = await getDb();

  // Get user's trusts for filtering
  const userTrusts = await db
    .select({ id: trusts.id })
    .from(trusts)
    .where(eq(trusts.userId, userId));
  const trustIds = userTrusts.map((t) => t.id);

  if (trustIds.length === 0) {
    return NextResponse.json({
      ok: true,
      pendingEvents: [],
      financingProfiles: [],
      encumbrances: [],
    });
  }

  // Pending events from inbox
  const eventConditions = [eq(accountingEventInbox.sourceSystem, "trust_records")];
  if (status === "pending") {
    eventConditions.push(eq(accountingEventInbox.processingStatus, "pending"));
  }

  const pendingEvents = await db
    .select()
    .from(accountingEventInbox)
    .where(and(...eventConditions))
    .orderBy(desc(accountingEventInbox.createdAt))
    .limit(50);

  // Filter events by user's trusts (include events with no trustId for visibility)
  const payloadTrustId = (p: unknown) =>
    (p as Record<string, unknown>)?.trustId as string | undefined;
  const filteredEvents = pendingEvents.filter((e) => {
    const tid = payloadTrustId(e.payload);
    return !tid || trustIds.includes(tid);
  });

  // Financing profiles and encumbrances for user's trusts
  const financingProfiles = trustIds.length
    ? await db
        .select()
        .from(accountingFinancingProfiles)
        .where(inArray(accountingFinancingProfiles.trustId, trustIds))
        .orderBy(desc(accountingFinancingProfiles.createdAt))
        .limit(100)
    : [];

  const encumbrances = trustIds.length
    ? await db
        .select()
        .from(accountingAssetEncumbrances)
        .where(inArray(accountingAssetEncumbrances.trustId, trustIds))
        .orderBy(desc(accountingAssetEncumbrances.createdAt))
        .limit(100)
    : [];

  return NextResponse.json({
    ok: true,
    pendingEvents: filteredEvents.map((e) => ({
      id: e.id,
      sourceEventType: e.sourceEventType,
      sourceEventId: e.sourceEventId,
      payload: e.payload,
      processingStatus: e.processingStatus,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt?.toISOString(),
    })),
    financingProfiles: financingProfiles.map((f) => ({
      id: f.id,
      trustId: f.trustId,
      instrumentId: f.instrumentId,
      principalAmount: f.principalAmount ? Number(f.principalAmount) : null,
      outstandingPrincipal: f.outstandingPrincipal ? Number(f.outstandingPrincipal) : null,
      interestRate: f.interestRate ? Number(f.interestRate) : null,
      accruedInterest: f.accruedInterest ? Number(f.accruedInterest) : null,
      nextPaymentDate: f.nextPaymentDate?.toISOString().slice(0, 10),
      maturityDate: f.maturityDate?.toISOString().slice(0, 10),
      status: f.status,
      currency: f.currency,
      createdAt: f.createdAt?.toISOString(),
    })),
    encumbrances: encumbrances.map((e) => ({
      id: e.id,
      trustId: e.trustId,
      assetId: e.assetId,
      instrumentId: e.instrumentId,
      pledgedValue: e.pledgedValue ? Number(e.pledgedValue) : null,
      lienPosition: e.lienPosition,
      coverageRatio: e.coverageRatio ? Number(e.coverageRatio) : null,
      effectiveDate: e.effectiveDate?.toISOString().slice(0, 10),
      releaseDate: e.releaseDate?.toISOString().slice(0, 10),
      status: e.status,
      createdAt: e.createdAt?.toISOString(),
    })),
  });
}
