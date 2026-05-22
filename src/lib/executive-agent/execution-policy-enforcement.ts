import {
  TriggerCampaignSyncPayloadSchema,
} from "@/lib/executive-agent/executive-action-payloads";
import {
  isWriteAction,
  scopeForWriteAction,
  type ExecutiveWriteActionName,
} from "@/lib/executive-agent/executive-agent-policy";
import type { ExecutionPolicyValidationResult } from "@/lib/executive-agent/executive-automation-types";

const GOVERNANCE_MUTATION_ACTIONS = new Set<string>([
  "recordSmartTrustResolutionCheckpoint",
]);

const PUBLISH_SPEND_ACTIONS = new Set<string>(["triggerCampaignSync"]);

const DEPLOY_ACTIONS = new Set<string>([]);

export type PolicyEnforcementInput = {
  proposedAction: string;
  payloadJson: string;
  targetType?: string | null;
  targetId?: string | null;
};

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Enforces governed automation boundaries — no autonomous deploy/publish/spend/governance mutation. */
export function validateExecutionPolicy(input: PolicyEnforcementInput): ExecutionPolicyValidationResult {
  const violations: string[] = [];
  const preservedBoundaries: string[] = [
    "approval_required",
    "audit_required",
    "department_isolation",
    "no_autonomous_deploy",
    "no_autonomous_publish",
    "no_autonomous_spend",
    "no_autonomous_governance_mutation",
  ];

  if (!isWriteAction(input.proposedAction)) {
    violations.push(`Unknown or unsupported write action: ${input.proposedAction}`);
    return {
      allowed: false,
      violations,
      preservedBoundaries,
      departmentIsolationOk: false,
    };
  }

  const action = input.proposedAction as ExecutiveWriteActionName;
  const scope = scopeForWriteAction(action);
  if (!scope) {
    violations.push(`Action ${action} has no governed scope mapping.`);
  }

  const payload = parsePayload(input.payloadJson);

  if (DEPLOY_ACTIONS.has(action)) {
    violations.push("Autonomous deployment is blocked by execution policy.");
  }

  if (PUBLISH_SPEND_ACTIONS.has(action)) {
    if (action === "triggerCampaignSync") {
      const parsed = TriggerCampaignSyncPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        violations.push("Campaign sync payload failed schema validation.");
      } else if (!parsed.data.dryRun) {
        violations.push(
          "Autonomous publish/spend blocked — triggerCampaignSync requires dryRun=true for governed automation."
        );
      }
    } else {
      violations.push("Autonomous publish/spend actions are blocked.");
    }
  }

  if (GOVERNANCE_MUTATION_ACTIONS.has(action)) {
    violations.push(
      "Autonomous governance mutation blocked — SMART_TRUST resolution checkpoints require direct human approval flow."
    );
  }

  if (action === "createSpecializedAgent" && payload.autonomous === true) {
    violations.push("Autonomous agent creation is blocked.");
  }

  const departmentIsolationOk = validateDepartmentIsolation(action, payload, violations);

  return {
    allowed: violations.length === 0,
    violations,
    preservedBoundaries,
    departmentIsolationOk,
  };
}

function validateDepartmentIsolation(
  action: ExecutiveWriteActionName,
  payload: Record<string, unknown>,
  violations: string[]
): boolean {
  if (action === "delegateOperationalTask" || action === "escalateOperationalTask") {
    const taskId = payload.taskId;
    const targetOperatorId = payload.targetOperatorId;
    if (typeof taskId !== "string" || !taskId.trim()) {
      violations.push("Task coordination requires a scoped taskId.");
      return false;
    }
    if (typeof targetOperatorId !== "string" || !targetOperatorId.trim()) {
      violations.push("Scoped delegation requires targetOperatorId within operator registry.");
      return false;
    }
    return true;
  }

  const primaryService = payload.primaryService;
  if (typeof primaryService === "string") {
    const allowed = ["WEBSITE", "TRUST", "REVENUE_OS", "SMART_TRUST"];
    if (!allowed.includes(primaryService)) {
      violations.push(`Department isolation violation — unknown primaryService ${primaryService}.`);
      return false;
    }
  }

  return true;
}
