import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { z } from "zod";
import * as schema from "@/lib/db/schema";
import { clients, paymentConfirmations } from "@/lib/db/schema";
import { auditFulfillmentExecutiveAction } from "@/lib/fulfillment/fulfillment-audit";
import { assertClientOwnedByAdmin } from "@/lib/fulfillment/fulfillment-client-access";
import { AdminManualPaymentConfirmBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas";
import { PAYMENT_PROVIDER_ADMIN_MANUAL } from "@/lib/fulfillment/fulfillment-types";

export { AdminManualPaymentConfirmBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas";

type Db = MySql2Database<typeof schema>;

export type PaymentConfirmationRow = typeof paymentConfirmations.$inferSelect;

export type PaymentHandoffGateResult =
  | { ok: true; row: PaymentConfirmationRow }
  | { ok: false; code: "not_found" | "not_confirmed" | "already_consumed" | "client_mismatch"; message: string };

/**
 * Owner/admin confirms payment after reviewing PayPal manually.
 * No paywall, no PayPal webhook, no PayPal API — desk reconciliation only.
 */
export async function confirmPaymentManuallyForAdmin(
  db: Db,
  input: {
    adminUserId: number;
    body: z.infer<typeof AdminManualPaymentConfirmBodySchema>;
  }
): Promise<{ ok: true; confirmation: PaymentConfirmationRow } | { ok: false; message: string }> {
  const parsed = AdminManualPaymentConfirmBodySchema.safeParse(input.body);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const own = await assertClientOwnedByAdmin(db, parsed.data.clientId, input.adminUserId);
  if (!own.ok) return { ok: false, message: own.message };

  const evidence =
    parsed.data.paypalTransactionNote?.trim()
      ? {
          paypalTransactionNote: parsed.data.paypalTransactionNote.trim(),
          confirmedVia: "executive_admin_manual",
        }
      : { confirmedVia: "executive_admin_manual" };

  const id = randomUUID();
  const now = new Date();

  await db.insert(paymentConfirmations).values({
    id,
    clientId: parsed.data.clientId,
    marketplaceUserId: parsed.data.marketplaceUserId ?? null,
    provider: PAYMENT_PROVIDER_ADMIN_MANUAL,
    externalRef: parsed.data.externalRef?.trim() || null,
    amountCents: parsed.data.amountCents ?? null,
    currency: parsed.data.currency ?? "USD",
    status: "confirmed",
    confirmedAt: now,
    confirmedByAdminUserId: input.adminUserId,
    evidenceJson: JSON.stringify(evidence).slice(0, 50_000),
  });

  const [row] = await db
    .select()
    .from(paymentConfirmations)
    .where(eq(paymentConfirmations.id, id))
    .limit(1);

  if (!row) return { ok: false, message: "Failed to load payment confirmation after insert." };

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "payment_confirmations.confirm_manual",
    actionType: "payment_confirmed",
    targetType: "payment_confirmation",
    targetId: id,
    inputJson: {
      clientId: parsed.data.clientId,
      provider: PAYMENT_PROVIDER_ADMIN_MANUAL,
      externalRef: parsed.data.externalRef ?? null,
      amountCents: parsed.data.amountCents ?? null,
    },
    outputJson: { status: "confirmed" },
  });

  return { ok: true, confirmation: row };
}

export async function listPaymentConfirmationsForAdmin(
  db: Db,
  input: {
    adminUserId: number;
    clientId?: string | null;
    status?: "pending" | "confirmed" | "failed" | null;
    limit?: number;
  }
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  if (input.clientId?.trim()) {
    const own = await assertClientOwnedByAdmin(db, input.clientId.trim(), input.adminUserId);
    if (!own.ok) return { ok: false as const, message: own.message, rows: [] };
  }

  const owned = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.userId, input.adminUserId));
  const ownedIds = owned.map((c) => c.id);
  if (ownedIds.length === 0) {
    return { ok: true as const, rows: [] };
  }

  const filters = [inArray(paymentConfirmations.clientId, ownedIds)];

  if (input.clientId?.trim()) {
    filters.push(eq(paymentConfirmations.clientId, input.clientId.trim()));
  }
  if (input.status) {
    filters.push(eq(paymentConfirmations.status, input.status));
  }

  const rows = await db
    .select({
      id: paymentConfirmations.id,
      clientId: paymentConfirmations.clientId,
      marketplaceUserId: paymentConfirmations.marketplaceUserId,
      provider: paymentConfirmations.provider,
      externalRef: paymentConfirmations.externalRef,
      amountCents: paymentConfirmations.amountCents,
      currency: paymentConfirmations.currency,
      status: paymentConfirmations.status,
      confirmedAt: paymentConfirmations.confirmedAt,
      consumedAt: paymentConfirmations.consumedAt,
      consumedByOrderId: paymentConfirmations.consumedByOrderId,
      createdAt: paymentConfirmations.createdAt,
    })
    .from(paymentConfirmations)
    .where(and(...filters))
    .orderBy(desc(paymentConfirmations.createdAt))
    .limit(limit);

  return { ok: true as const, rows };
}

/** Gate for Claude handoff — payment must be admin-confirmed and not yet consumed. */
export async function assertPaymentConfirmedForHandoff(
  db: Db,
  input: { confirmationId: string; clientId: string }
): Promise<PaymentHandoffGateResult> {
  const [row] = await db
    .select()
    .from(paymentConfirmations)
    .where(eq(paymentConfirmations.id, input.confirmationId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "not_found", message: "Payment confirmation not found." };
  }
  if (row.status !== "confirmed") {
    return {
      ok: false,
      code: "not_confirmed",
      message: "Payment is not confirmed. Owner must confirm payment in Executive Agent first.",
    };
  }
  if (row.consumedAt != null || row.consumedByOrderId != null) {
    return {
      ok: false,
      code: "already_consumed",
      message: "Payment confirmation already linked to a fulfillment order.",
    };
  }
  if (row.clientId && row.clientId !== input.clientId) {
    return {
      ok: false,
      code: "client_mismatch",
      message: "Payment confirmation client does not match handoff client.",
    };
  }
  if (row.provider !== PAYMENT_PROVIDER_ADMIN_MANUAL) {
    return {
      ok: false,
      code: "not_confirmed",
      message: "Only admin_manual payment confirmations are accepted in this slice.",
    };
  }

  return { ok: true, row };
}

export async function consumePaymentConfirmationForOrder(
  db: Db,
  input: { confirmationId: string; orderId: string }
): Promise<void> {
  await db
    .update(paymentConfirmations)
    .set({
      consumedAt: new Date(),
      consumedByOrderId: input.orderId,
    })
    .where(
      and(
        eq(paymentConfirmations.id, input.confirmationId),
        isNull(paymentConfirmations.consumedAt),
        isNull(paymentConfirmations.consumedByOrderId)
      )
    );
}
