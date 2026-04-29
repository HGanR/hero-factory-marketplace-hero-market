/**
 * Trust Records → Accounting Event Bridge
 * Publishes normalized lifecycle events to accounting_event_inbox for Accounting to consume.
 *
 * Trust Records = legal/asset state
 * Accounting = economic/tax state
 * Lifecycle Engine = event bridge between both
 */

import { getDb } from "@/lib/db";
import { accountingEventInbox } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

export type AccountingBridgeEventType =
  | "INSTRUMENT_ISSUED"
  | "COLLATERAL_PLEDGED"
  | "PROCEEDS_RECEIVED"
  | "INTEREST_ACCRUED"
  | "INTEREST_PAID"
  | "BROKERAGE_DEPOSIT_INITIATED"
  | "BROKERAGE_DEPOSIT_COMPLETED"
  | "BROKER_FEE_INCURRED"
  | "VALUATION_UPDATED"
  | "ASSET_IMPAIRMENT_RECORDED"
  | "INSTRUMENT_REDEEMED"
  | "INSTRUMENT_DEFAULTED"
  | "LIABILITY_CREATED"
  | "LIABILITY_REDUCED"
  | "FEE_EXPENSE";

export interface AccountingBridgePayload {
  trustId?: string;
  workspaceId?: string;
  assetId?: string;
  instrumentId?: string;
  collateralPoolId?: string;
  governingResolutionId?: string;
  brokerageAccountId?: string;
  [key: string]: unknown;
}

/**
 * Publish an event from Trust Records into the accounting event inbox.
 * Accounting will process these and create financing profiles, encumbrances, and transaction drafts.
 */
export async function publishAccountingEvent(
  sourceEventType: AccountingBridgeEventType,
  payload: AccountingBridgePayload,
  sourceEventId?: string
): Promise<string> {
  const db = await getDb();
  const id = uuidv4();
  await db.insert(accountingEventInbox).values({
    id,
    sourceSystem: "trust_records",
    sourceEventType,
    sourceEventId: sourceEventId ?? null,
    payload: payload as Record<string, unknown>,
    processingStatus: "pending",
  });
  return id;
}
