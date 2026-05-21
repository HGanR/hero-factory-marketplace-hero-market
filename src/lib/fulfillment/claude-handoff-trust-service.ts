import "server-only";

import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { v4 as uuidv4 } from "uuid";
import * as schema from "@/lib/db/schema";
import {
  clientServiceOrders,
  fulfillmentDeliverables,
} from "@/lib/db/schema";
import type { ClaudeWorkerAuthContext } from "@/lib/workers/claude-worker-auth";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import { assertClientOwnedByAdmin } from "@/lib/fulfillment/fulfillment-client-access";
import { ClaudeTrustFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas-trust";
import {
  assertPaymentConfirmedForHandoff,
  consumePaymentConfirmationForOrder,
} from "@/lib/fulfillment/payment-confirmation-service";
import { resolveTrustArtifactType } from "@/lib/fulfillment/trust-review-packet-builder";
import { buildTrustIntakeSnapshot } from "@/lib/fulfillment/trust-intake-summary";
import {
  FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
  FULFILLMENT_INITIAL_STAGE,
  FULFILLMENT_ORDER_SOURCE_CLAUDE_WORKER,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
} from "@/lib/fulfillment/fulfillment-types";
import type { ClaudeHandoffResult } from "@/lib/fulfillment/claude-handoff-service";

type Db = MySql2Database<typeof schema>;

export async function findExistingTrustHandoffByIdempotency(
  db: Db,
  input: { apiKeyId: string; idempotencyKey: string }
) {
  const [row] = await db
    .select({ id: clientServiceOrders.id, pipelineStage: clientServiceOrders.pipelineStage })
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.claudeWorkerApiKeyId, input.apiKeyId),
        eq(clientServiceOrders.claudeIdempotencyKey, input.idempotencyKey),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_TRUST)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function submitClaudeTrustFulfillmentHandoff(
  db: Db,
  input: {
    worker: ClaudeWorkerAuthContext;
    body: unknown;
    idempotencyKey?: string | null;
  }
): Promise<ClaudeHandoffResult> {
  const parsed = ClaudeTrustFulfillmentHandoffBodySchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const { client, payment, service } = parsed.data;
  const adminUserId = input.worker.ownerAdminUserId;

  const own = await assertClientOwnedByAdmin(db, client.clientId, adminUserId);
  if (!own.ok) {
    return { ok: false, httpStatus: 404, code: "client_not_found", message: own.message };
  }

  if (input.idempotencyKey?.trim()) {
    const existing = await findExistingTrustHandoffByIdempotency(db, {
      apiKeyId: input.worker.apiKeyId,
      idempotencyKey: input.idempotencyKey.trim(),
    });
    if (existing) {
      const [del] = await db
        .select({ id: fulfillmentDeliverables.id })
        .from(fulfillmentDeliverables)
        .where(eq(fulfillmentDeliverables.orderId, existing.id))
        .limit(1);
      return {
        ok: true,
        handoffId: existing.id,
        stage: existing.pipelineStage,
        assignedDepartment: FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
        paymentConfirmationId: payment.confirmationId,
        deliverableId: del?.id ?? existing.id,
      };
    }
  }

  const payGate = await assertPaymentConfirmedForHandoff(db, {
    confirmationId: payment.confirmationId,
    clientId: client.clientId,
  });
  if (!payGate.ok) {
    const httpStatus =
      payGate.code === "not_found" ? 404 : payGate.code === "client_mismatch" ? 422 : 409;
    return {
      ok: false,
      httpStatus,
      code: payGate.code,
      message: payGate.message,
    };
  }

  if (
    payment.externalRef?.trim() &&
    payGate.row.externalRef?.trim() &&
    payment.externalRef.trim() !== payGate.row.externalRef.trim()
  ) {
    return {
      ok: false,
      httpStatus: 422,
      code: "payment_ref_mismatch",
      message: "payment.externalRef does not match the confirmed payment record.",
    };
  }

  const orderId = uuidv4();
  const deliverableId = uuidv4();
  const intakeSnapshot = buildTrustIntakeSnapshot({
    trustIntake: parsed.data.trustIntake,
    salesSummaryText: parsed.data.salesSummary.text,
    requestedDeliverableJson: JSON.stringify(parsed.data.requestedDeliverable),
  });

  const artifactType = resolveTrustArtifactType(
    parsed.data.requestedDeliverable.type,
    intakeSnapshot.normalized.desiredOutputPackage
  );

  const handoffSnapshot = {
    version: parsed.data.version,
    client: parsed.data.client,
    service: parsed.data.service,
    payment: { confirmationId: payment.confirmationId },
    salesSummary: {
      textLength: parsed.data.salesSummary.text.length,
      channel: parsed.data.salesSummary.channel,
    },
    requestedDeliverable: parsed.data.requestedDeliverable,
    metadata: parsed.data.metadata ?? null,
    trustIntake: parsed.data.trustIntake ?? null,
    intake: intakeSnapshot,
  };

  await db.transaction(async (tx) => {
    await tx.insert(clientServiceOrders).values({
      id: orderId,
      clientId: client.clientId,
      marketplaceUserId: client.marketplaceUserId ?? payGate.row.marketplaceUserId ?? null,
      primaryService: service.primary,
      requestedServicesJson: JSON.stringify(service.requested ?? [FULFILLMENT_PRIMARY_SERVICE_TRUST]),
      pipelineStage: FULFILLMENT_INITIAL_STAGE,
      paymentConfirmationId: payment.confirmationId,
      assignedDepartment: FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
      salesSummaryText: parsed.data.salesSummary.text,
      consentJson: parsed.data.consent ? JSON.stringify(parsed.data.consent) : null,
      requestedDeliverableJson: JSON.stringify(parsed.data.requestedDeliverable),
      executiveHandoffJson: JSON.stringify(handoffSnapshot).slice(0, 100_000),
      source: FULFILLMENT_ORDER_SOURCE_CLAUDE_WORKER,
      claudeWorkerApiKeyId: input.worker.apiKeyId,
      ownerAdminUserId: adminUserId,
      claudeIdempotencyKey: input.idempotencyKey?.trim() || null,
    });

    await tx.insert(fulfillmentDeliverables).values({
      id: deliverableId,
      orderId,
      department: FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
      artifactType,
      ownerReviewStatus: "pending",
    });

    await consumePaymentConfirmationForOrder(tx, {
      confirmationId: payment.confirmationId,
      orderId,
    });

    await insertFulfillmentOrderEvent(tx, {
      orderId,
      actorType: "claude_worker",
      actorId: input.worker.apiKeyId,
      fromStage: null,
      toStage: FULFILLMENT_INITIAL_STAGE,
      payloadJson: {
        primaryService: service.primary,
        paymentConfirmationId: payment.confirmationId,
        deliverableId,
        artifactType,
        intakeReadinessTier: intakeSnapshot.readiness.tier,
        intakeScore: intakeSnapshot.readiness.score,
        fulfillmentReady: intakeSnapshot.readiness.fulfillmentReady,
      },
    });

    await auditFulfillmentExecutiveAction(tx, {
      adminUserId,
      toolName: "claude_worker.trust_fulfillment_handoff",
      actionType: "trust_fulfillment_handoff_received",
      targetType: "client_service_order",
      targetId: orderId,
      inputJson: {
        clientId: client.clientId,
        paymentConfirmationId: payment.confirmationId,
        artifactType,
      },
      outputJson: {
        stage: FULFILLMENT_INITIAL_STAGE,
        deliverableId,
        legalReviewRequired: true,
      },
    });
  });

  return {
    ok: true,
    handoffId: orderId,
    stage: FULFILLMENT_INITIAL_STAGE,
    assignedDepartment: FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
    paymentConfirmationId: payment.confirmationId,
    deliverableId,
  };
}
