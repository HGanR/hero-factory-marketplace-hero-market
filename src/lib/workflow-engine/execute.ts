/**
 * Workflow Engine - Execute workflows when events occur
 * Maps platform events to workflow triggers and runs configured actions.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workflowAutomations, trusts } from "@/lib/db/schema";

export type WorkflowTriggerEvent =
  | "certificate_issued"
  | "instrument_issued"
  | "collateral_pledged"
  | "proceeds_received"
  | "entity_created"
  | "accounting_event_processed"
  | "world_draft_saved"
  | "world_published"
  | "commerce_node_created"
  | "commerce_transaction"
  | "app_published"
  | "app_installed"
  | "asset_purchased";

const ACCOUNTING_TO_TRIGGER: Record<string, WorkflowTriggerEvent> = {
  INSTRUMENT_ISSUED: "instrument_issued",
  COLLATERAL_PLEDGED: "collateral_pledged",
  PROCEEDS_RECEIVED: "proceeds_received",
  INTEREST_ACCRUED: "accounting_event_processed",
  INTEREST_PAID: "accounting_event_processed",
  BROKERAGE_DEPOSIT_INITIATED: "accounting_event_processed",
  BROKERAGE_DEPOSIT_COMPLETED: "accounting_event_processed",
  BROKER_FEE_INCURRED: "accounting_event_processed",
  VALUATION_UPDATED: "accounting_event_processed",
  ASSET_IMPAIRMENT_RECORDED: "accounting_event_processed",
  INSTRUMENT_REDEEMED: "accounting_event_processed",
  INSTRUMENT_DEFAULTED: "accounting_event_processed",
  LIABILITY_CREATED: "accounting_event_processed",
  LIABILITY_REDUCED: "accounting_event_processed",
  FEE_EXPENSE: "accounting_event_processed",
};

export interface WorkflowEventPayload {
  trustId?: string;
  workspaceId?: string;
  assetId?: string;
  instrumentId?: string;
  sourceEventId?: string;
  sourceEventType?: string;
  [key: string]: unknown;
}

export interface WorkflowRunResult {
  workflowId: string;
  workflowName: string;
  ran: boolean;
  error?: string;
}

/**
 * Resolve userId from payload (trustId -> trust.userId)
 */
async function resolveUserId(payload: WorkflowEventPayload): Promise<number | null> {
  const trustId = payload.trustId as string | undefined;
  if (!trustId) return null;
  const db = await getDb();
  const [row] = await db
    .select({ userId: trusts.userId })
    .from(trusts)
    .where(eq(trusts.id, trustId))
    .limit(1);
  return row?.userId ?? null;
}

/**
 * Run all matching workflows for an event.
 * Call this after certificate issuance, instrument issuance, accounting event processing, etc.
 */
export async function runWorkflowsForEvent(
  triggerEvent: WorkflowTriggerEvent,
  payload: WorkflowEventPayload,
  userId?: number
): Promise<WorkflowRunResult[]> {
  let resolvedUserId = userId;
  if (resolvedUserId == null) {
    resolvedUserId = (await resolveUserId(payload)) ?? undefined;
  }
  if (resolvedUserId == null) return [];

  const db = await getDb();
  const workflows = await db
    .select()
    .from(workflowAutomations)
    .where(
      and(
        eq(workflowAutomations.triggerEvent, triggerEvent),
        eq(workflowAutomations.userId, resolvedUserId),
        eq(workflowAutomations.isActive, true)
      )
    );

  const results: WorkflowRunResult[] = [];

  for (const w of workflows) {
    const actions = (typeof w.actions === "string" ? JSON.parse(w.actions as string) : w.actions) as Array<{
      type: string;
      config?: Record<string, unknown>;
    }>;
    let ran = false;
    let err: string | undefined;

    try {
      for (const action of actions ?? []) {
        await executeAction(action, payload, db);
        ran = true;
      }
      if (ran) {
        await db
          .update(workflowAutomations)
          .set({
            lastRunAt: new Date(),
            runCount: (w.runCount ?? 0) + 1,
          })
          .where(eq(workflowAutomations.id, w.id));
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }

    results.push({
      workflowId: w.id,
      workflowName: w.name,
      ran,
      error: err,
    });
  }

  return results;
}

/**
 * Map accounting bridge event type to workflow trigger and run workflows.
 */
export async function runWorkflowsForAccountingEvent(
  sourceEventType: string,
  payload: WorkflowEventPayload,
  userId?: number
): Promise<WorkflowRunResult[]> {
  const trigger = ACCOUNTING_TO_TRIGGER[sourceEventType] ?? "accounting_event_processed";
  const enrichedPayload: WorkflowEventPayload = {
    ...payload,
    sourceEventType,
  };
  return runWorkflowsForEvent(trigger, enrichedPayload, userId);
}

async function executeAction(
  action: { type: string; config?: Record<string, unknown> },
  _payload: WorkflowEventPayload,
  _db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  switch (action.type) {
    case "create_accounting_entry":
      // Placeholder: in future, create a suggested transaction or accounting entry
      // For now we just log that the action ran
      break;
    case "send_notification":
      // Placeholder: could trigger webhooks, email, etc.
      break;
    case "generate_resolution":
      // Placeholder: could generate a trust resolution document
      break;
    case "publish_to_inbox":
      // Placeholder: could publish a follow-up event to accounting_event_inbox
      break;
    default:
      // Unknown action - no-op
      break;
  }
}
