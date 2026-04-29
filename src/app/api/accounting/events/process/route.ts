/**
 * Accounting Event Process API
 * POST: Process pending events from the inbox into financing profiles, encumbrances, and suggested transactions
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  accountingEventInbox,
  accountingFinancingProfiles,
  accountingAssetEncumbrances,
  trusts,
} from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";
import { emitAccountingPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { eventIds?: string[]; processAll?: boolean };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const db = await getDb();

  // Get user's trusts
  const userTrusts = await db
    .select({ id: trusts.id })
    .from(trusts)
    .where(eq(trusts.userId, userId));
  const trustIds = userTrusts.map((t) => t.id);

  if (trustIds.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      suggestedTransactions: [],
      errors: [],
    });
  }

  // Fetch pending events
  let eventsToProcess;
  if (body.eventIds?.length) {
    eventsToProcess = await db
      .select()
      .from(accountingEventInbox)
      .where(
        and(
          eq(accountingEventInbox.processingStatus, "pending"),
          inArray(accountingEventInbox.id, body.eventIds)
        )
      );
  } else if (body.processAll) {
    eventsToProcess = await db
      .select()
      .from(accountingEventInbox)
      .where(eq(accountingEventInbox.processingStatus, "pending"))
      .limit(50);
  } else {
    return NextResponse.json(
      { error: "Provide eventIds or processAll: true" },
      { status: 400 }
    );
  }

  const suggestedTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: "income" | "expense";
    category: string;
    transactionClass: string;
    trustId?: string;
    instrumentId?: string;
    assetId?: string;
    brokerageAccountId?: string;
    sourceEventId: string;
  }> = [];
  const errors: string[] = [];

  for (const evt of eventsToProcess) {
    const payload = (evt.payload ?? {}) as Record<string, unknown>;
    const trustId = payload.trustId as string | undefined;
    if (trustId && !trustIds.includes(trustId)) continue; // Skip events for other users' trusts

    await db
      .update(accountingEventInbox)
      .set({
        processingStatus: "processing",
        processedByUserId: userId,
      })
      .where(eq(accountingEventInbox.id, evt.id));

    try {
      switch (evt.sourceEventType) {
        case "INSTRUMENT_ISSUED": {
          const instrumentId = payload.instrumentId as string | undefined;
          const faceValue = Number(payload.faceValue ?? 0);
          const currency = (payload.currency as string) ?? "USD";
          const issueDate = (payload.issueDate as string) ?? new Date().toISOString().slice(0, 10);
          const maturityDate = payload.maturityDate as string | undefined;
          const instrumentKind = payload.instrumentKind as string | undefined;

          if (trustId && instrumentId) {
            const profileId = uuidv4();
            await db.insert(accountingFinancingProfiles).values({
              id: profileId,
              trustId,
              instrumentId,
              principalAmount: String(faceValue),
              outstandingPrincipal: String(faceValue),
              interestRate: null,
              accruedInterest: "0",
              nextPaymentDate: null,
              maturityDate: maturityDate ? new Date(maturityDate) : null,
              status: "active",
              currency,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            suggestedTransactions.push({
              id: uuidv4(),
              date: issueDate,
              description: `Instrument issued: ${instrumentKind ?? "Note"} ${instrumentId.slice(0, 8)}`,
              amount: faceValue,
              type: "expense",
              category: "Interest (mortgage/other)",
              transactionClass: "liability_created",
              trustId,
              instrumentId,
              sourceEventId: evt.id,
            });
          }
          break;
        }

        case "COLLATERAL_PLEDGED": {
          const assetId = payload.assetId as string | undefined;
          const instrumentId = payload.instrumentId as string | undefined;
          const pledgedValue = Number(payload.pledgedValue ?? 0);
          const lienPosition = payload.lienPosition as number | undefined;
          const coverageRatio = payload.coverageRatio as number | undefined;
          const effectiveDate = (payload.effectiveDate as string) ?? new Date().toISOString().slice(0, 10);

          if (trustId && assetId) {
            const encId = uuidv4();
            await db.insert(accountingAssetEncumbrances).values({
              id: encId,
              trustId,
              assetId,
              instrumentId: instrumentId ?? null,
              pledgedValue: String(pledgedValue),
              lienPosition: lienPosition ?? null,
              coverageRatio: coverageRatio != null ? String(coverageRatio) : null,
              effectiveDate: new Date(effectiveDate),
              releaseDate: null,
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          break;
        }

        case "PROCEEDS_RECEIVED": {
          const instrumentId = payload.instrumentId as string | undefined;
          const amount = Number(payload.amount ?? 0);
          const date = (payload.date as string) ?? new Date().toISOString().slice(0, 10);

          if (trustId && instrumentId && amount > 0) {
            suggestedTransactions.push({
              id: uuidv4(),
              date,
              description: `Financing proceeds received for instrument ${instrumentId.slice(0, 8)}`,
              amount,
              type: "income",
              category: "Other expenses",
              transactionClass: "financing_inflow",
              trustId,
              instrumentId,
              sourceEventId: evt.id,
            });

            // Update financing profile outstanding principal if exists
            const [profile] = await db
              .select()
              .from(accountingFinancingProfiles)
              .where(
                and(
                  eq(accountingFinancingProfiles.trustId, trustId),
                  eq(accountingFinancingProfiles.instrumentId, instrumentId)
                )
              )
              .limit(1);
            if (profile && profile.outstandingPrincipal) {
              const current = Number(profile.outstandingPrincipal);
              // Proceeds don't reduce principal; they're the funding. No change to outstanding.
            }
          }
          break;
        }

        case "INTEREST_PAID": {
          const instrumentId = payload.instrumentId as string | undefined;
          const amount = Number(payload.amount ?? 0);
          const date = (payload.date as string) ?? new Date().toISOString().slice(0, 10);

          if (trustId && instrumentId && amount > 0) {
            suggestedTransactions.push({
              id: uuidv4(),
              date,
              description: `Interest paid for instrument ${instrumentId.slice(0, 8)}`,
              amount,
              type: "expense",
              category: "Interest (mortgage/other)",
              transactionClass: "interest_expense",
              trustId,
              instrumentId,
              sourceEventId: evt.id,
            });
          }
          break;
        }

        case "BROKER_FEE_INCURRED":
        case "FEE_EXPENSE": {
          const amount = Number(payload.amount ?? 0);
          const date = (payload.date as string) ?? new Date().toISOString().slice(0, 10);
          const description = (payload.description as string) ?? "Broker/custody fee";
          const brokerageAccountId = payload.brokerageAccountId as string | undefined;
          const instrumentId = payload.instrumentId as string | undefined;

          if (amount > 0) {
            suggestedTransactions.push({
              id: uuidv4(),
              date,
              description,
              amount,
              type: "expense",
              category: "Commissions and fees",
              transactionClass: "fee_expense",
              trustId,
              instrumentId,
              brokerageAccountId,
              sourceEventId: evt.id,
            });
          }
          break;
        }

        case "INSTRUMENT_REDEEMED":
        case "INSTRUMENT_DEFAULTED": {
          const instrumentId = payload.instrumentId as string | undefined;
          const amount = Number(payload.amount ?? payload.outstandingPrincipal ?? 0);
          const date = (payload.date as string) ?? new Date().toISOString().slice(0, 10);

          if (trustId && instrumentId) {
            await db
              .update(accountingFinancingProfiles)
              .set({
                status: evt.sourceEventType === "INSTRUMENT_REDEEMED" ? "redeemed" : "defaulted",
                outstandingPrincipal: "0",
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(accountingFinancingProfiles.trustId, trustId),
                  eq(accountingFinancingProfiles.instrumentId, instrumentId)
                )
              );

            if (amount > 0) {
              suggestedTransactions.push({
                id: uuidv4(),
                date,
                description: `${evt.sourceEventType === "INSTRUMENT_REDEEMED" ? "Redemption" : "Default"} - instrument ${instrumentId.slice(0, 8)}`,
                amount,
                type: "expense",
                category: "Interest (mortgage/other)",
                transactionClass: "liability_reduction",
                trustId,
                instrumentId,
                sourceEventId: evt.id,
              });
            }
          }
          break;
        }

        default:
          // Other event types: mark processed, no side effects yet
          break;
      }

      await db
        .update(accountingEventInbox)
        .set({
          processingStatus: "processed",
          processedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(accountingEventInbox.id, evt.id));

      // Log to activity stream, run workflows, deliver webhooks
      try {
        await emitAccountingPlatformEvent(evt.sourceEventType, payload as Record<string, unknown>, userId);
      } catch {
        // Don't fail event processing if platform events fail
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${evt.id}: ${msg}`);
      await db
        .update(accountingEventInbox)
        .set({
          processingStatus: "failed",
          processedAt: new Date(),
          errorMessage: msg,
        })
        .where(eq(accountingEventInbox.id, evt.id));
    }
  }

  return NextResponse.json({
    ok: true,
    processed: eventsToProcess.length,
    suggestedTransactions,
    errors,
  });
}
