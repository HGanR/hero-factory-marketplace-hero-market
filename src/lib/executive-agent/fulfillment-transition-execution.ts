import type { ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";
import type { ExecutionPlan, ExecutionPlanStep } from "@/lib/executive-agent/executive-automation-types";

const FULFILLMENT_ACTIONS = new Set<ExecutiveWriteActionName>([
  "createSiteBuilderTask",
  "createTrustFulfillmentPacket",
  "createRevenueOsCampaignReviewPacket",
  "recordRevenueOsLaunchReadinessCheckpoint",
  "createSmartTrustGovernanceReviewPacket",
]);

export function isFulfillmentTransitionAction(action: string): action is ExecutiveWriteActionName {
  return FULFILLMENT_ACTIONS.has(action as ExecutiveWriteActionName);
}

export function buildFulfillmentTransitionPlan(
  proposedAction: ExecutiveWriteActionName,
  payloadJson: string
): ExecutionPlan {
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  const department =
    typeof payload.primaryService === "string"
      ? payload.primaryService
      : proposedAction === "createSiteBuilderTask"
        ? "WEBSITE"
        : null;

  const steps: ExecutionPlanStep[] = [
    {
      order: 1,
      step: "Validate fulfillment order scope and department isolation",
      scope: "fulfillment_orders",
      reversible: true,
    },
    {
      order: 2,
      step: "Execute approved fulfillment transition via governed executor",
      scope: "fulfillment_executor",
      reversible: false,
    },
    {
      order: 3,
      step: "Link deliverable draft or internal note — no deploy/publish",
      scope: "fulfillment_deliverables",
      reversible: false,
    },
    {
      order: 4,
      step: "Record fulfillment transition audit",
      scope: "executive_audit",
      reversible: false,
    },
  ];

  const mutations = [`approval_action:${proposedAction}`];
  if (typeof payload.fulfillmentOrderId === "string") {
    mutations.push(`order:${payload.fulfillmentOrderId}:transition`);
  }
  if (typeof payload.clientId === "string") {
    mutations.push(`client:${payload.clientId}:internal_note`);
  }

  return {
    workflowKind: "fulfillment_transition",
    proposedAction,
    steps,
    department,
    estimatedMutations: mutations,
    advisoryOnly: false,
  };
}
