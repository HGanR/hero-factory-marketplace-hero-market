/**
 * Trust Records → Accounting Event Publish API
 * POST: Publish a lifecycle event to the accounting event inbox
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { publishAccountingEvent } from "@/lib/accounting-bridge/publish-event";
import type { AccountingBridgeEventType } from "@/lib/accounting-bridge/publish-event";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    eventType: AccountingBridgeEventType;
    payload: Record<string, unknown>;
    sourceEventId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventType, payload, sourceEventId } = body;
  if (!eventType || !payload) {
    return NextResponse.json(
      { error: "eventType and payload are required" },
      { status: 400 }
    );
  }

  const validTypes: AccountingBridgeEventType[] = [
    "INSTRUMENT_ISSUED",
    "COLLATERAL_PLEDGED",
    "PROCEEDS_RECEIVED",
    "INTEREST_ACCRUED",
    "INTEREST_PAID",
    "BROKERAGE_DEPOSIT_INITIATED",
    "BROKERAGE_DEPOSIT_COMPLETED",
    "BROKER_FEE_INCURRED",
    "VALUATION_UPDATED",
    "ASSET_IMPAIRMENT_RECORDED",
    "INSTRUMENT_REDEEMED",
    "INSTRUMENT_DEFAULTED",
    "LIABILITY_CREATED",
    "LIABILITY_REDUCED",
    "FEE_EXPENSE",
  ];
  if (!validTypes.includes(eventType)) {
    return NextResponse.json(
      { error: `eventType must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const id = await publishAccountingEvent(eventType, payload, sourceEventId);

  return NextResponse.json(
    { ok: true, eventId: id, eventType, status: "pending" },
    { status: 201 }
  );
}
