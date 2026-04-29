/**
 * Trust Records → Accounting Push API
 * POST: Publish instrument lifecycle event(s) to the accounting event inbox
 * Called when user clicks "Send to Accounting" from Trust Records
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustInstruments, trustCollateralPoolAssets } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { publishAccountingEvent } from "@/lib/accounting-bridge/publish-event";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ instrumentId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { instrumentId } = await ctx.params;
  if (!instrumentId) return NextResponse.json({ error: "Invalid instrumentId" }, { status: 400 });

  const db = await getDb();
  const [instrument] = await db
    .select()
    .from(trustInstruments)
    .where(eq(trustInstruments.id, instrumentId))
    .limit(1);
  if (!instrument) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, instrument.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const published: string[] = [];

  // 1. INSTRUMENT_ISSUED — if instrument is issued or beyond
  const issuedStatuses = ["ISSUED", "SIGNED", "PACKAGED", "DEPOSIT_INITIATED", "DEPOSIT_COMPLETED", "REDEEMED", "MATURED"];
  if (issuedStatuses.includes(instrument.status)) {
    const eventId = await publishAccountingEvent("INSTRUMENT_ISSUED", {
      trustId: instrument.trustId,
      workspaceId: instrument.workspaceId ?? instrument.trustId,
      instrumentId: instrument.id,
      instrumentKind: instrument.instrumentKind,
      faceValue: instrument.faceValue ? Number(instrument.faceValue) : 0,
      currency: instrument.currency ?? "USD",
      issueDate: instrument.issueDate?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      maturityDate: instrument.maturityDate?.toISOString().slice(0, 10),
      governingResolutionId: instrument.governingResolutionId ?? undefined,
      collateralPoolId: instrument.collateralPoolId ?? undefined,
    });
    published.push(eventId);
  }

  // 2. COLLATERAL_PLEDGED — for each asset in the instrument's collateral pool
  if (instrument.collateralPoolId) {
    const poolAssets = await db
      .select()
      .from(trustCollateralPoolAssets)
      .where(eq(trustCollateralPoolAssets.poolId, instrument.collateralPoolId));
    for (const pa of poolAssets) {
      const eventId = await publishAccountingEvent("COLLATERAL_PLEDGED", {
        trustId: instrument.trustId,
        instrumentId: instrument.id,
        assetId: pa.assetId,
        collateralPoolId: instrument.collateralPoolId,
        pledgedValue: pa.allocatedValue ? Number(pa.allocatedValue) : 0,
        lienPosition: pa.lienPosition ?? undefined,
      });
      published.push(eventId);
    }
  }

  return NextResponse.json({
    ok: true,
    instrumentId,
    publishedEvents: published.length,
    eventIds: published,
    message: "Events sent to Accounting. Review in Accounting → Capital & Instruments.",
  });
}
