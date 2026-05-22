import type { ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";
import { isWriteAction } from "@/lib/executive-agent/executive-agent-policy";
import type { RollbackStrategy, RollbackStrategyKind } from "@/lib/executive-agent/executive-automation-types";

const COORDINATION_ACTIONS = new Set<string>(["delegateOperationalTask", "escalateOperationalTask"]);

const AUDIT_ONLY_ACTIONS = new Set<string>([
  "createTodo",
  "assignFollowUp",
  "createSiteBuilderTask",
  "createTrustFulfillmentPacket",
  "createRevenueOsCampaignReviewPacket",
  "recordRevenueOsLaunchReadinessCheckpoint",
  "createSmartTrustGovernanceReviewPacket",
  "updateClientStatus",
  "createSpecializedAgent",
  "triggerBentleyAnalysis",
  "triggerCampaignSync",
]);

export function buildRollbackStrategy(proposedAction: string): RollbackStrategy {
  if (!isWriteAction(proposedAction)) {
    return notReversible(`Unsupported action ${proposedAction}`);
  }

  const action = proposedAction as ExecutiveWriteActionName;

  if (COORDINATION_ACTIONS.has(action)) {
    return {
      kind: "coordination_revert",
      reversible: true,
      steps: [
        "Load task coordination metadata from execution audit.",
        "Revert delegation or escalation block to pre-execution snapshot.",
        "Record rollback audit entry with prior owner/priority when available.",
      ],
      limitations: [
        "Cannot undo operator acceptance after delegation was accepted.",
        "Escalation priority changes may require manual desk review.",
      ],
    };
  }

  if (AUDIT_ONLY_ACTIONS.has(action)) {
    const limitations =
      action === "createSiteBuilderTask" ||
      action === "createTrustFulfillmentPacket" ||
      action === "createRevenueOsCampaignReviewPacket" ||
      action === "createSmartTrustGovernanceReviewPacket"
        ? ["Internal fulfillment notes cannot be deleted — rollback marks execution reversed in audit only."]
        : ["Created records (todos, agents, notes) cannot be physically deleted — audit reversal only."];

    return {
      kind: "audit_mark_reversed",
      reversible: true,
      steps: [
        "Mark execution audit as reversed.",
        "Insert compensating rollback audit with rationale.",
        "Surface manual follow-up steps for desk operators when needed.",
      ],
      limitations,
    };
  }

  return notReversible(`No rollback strategy registered for ${action}`);
}

function notReversible(reason: string): RollbackStrategy {
  return {
    kind: "not_reversible" satisfies RollbackStrategyKind,
    reversible: false,
    steps: [],
    limitations: [reason],
  };
}

export function isActionReversible(proposedAction: string): boolean {
  return buildRollbackStrategy(proposedAction).reversible;
}
