import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateApprovalGate } from "@/lib/executive-agent/approval-gated-execution";
import {
  buildExecutionPlanForAction,
  classifyAutomationWorkflow,
  prepareGovernedAutomationExecution,
} from "@/lib/executive-agent/executive-automation-engine";
import { validateExecutionPolicy } from "@/lib/executive-agent/execution-policy-enforcement";
import { buildRollbackStrategy, isActionReversible } from "@/lib/executive-agent/reversible-operational-actions";
import { isWorkloadRedistributionPayload } from "@/lib/executive-agent/workload-redistribution-execution";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";

const taskId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";

describe("executive automation engine", () => {
  it("requires human confirmation for approval gate", () => {
    const denied = validateApprovalGate({
      approvalId: "a1",
      status: "pending",
      proposedAction: "createTodo",
      adminUserId: 1,
      approvalOwnerAdminUserId: 1,
      humanConfirmed: false,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "HUMAN_CONFIRMATION_REQUIRED");
  });

  it("blocks autonomous campaign sync without dryRun", () => {
    const campaignId = "33333333-3333-4333-8333-333333333333";
    const policy = validateExecutionPolicy({
      proposedAction: "triggerCampaignSync",
      payloadJson: JSON.stringify({ campaignId, dryRun: false }),
    });
    assert.equal(policy.allowed, false);
    assert.ok(policy.violations.some((v) => /publish|spend|dryRun/i.test(v)));
  });

  it("blocks autonomous governance mutation checkpoints", () => {
    const policy = validateExecutionPolicy({
      proposedAction: "recordSmartTrustResolutionCheckpoint",
      payloadJson: JSON.stringify({
        clientId,
        trustId: "44444444-4444-4444-8444-444444444444",
        fulfillmentOrderId: "55555555-5555-4555-8555-555555555555",
        primaryService: "SMART_TRUST",
        resolutionId: "66666666-6666-4666-8666-666666666666",
        resolutionTitle: "Test",
        minutesSummary: "Summary",
        recordMarkdown: "# Record",
        deliverableType: "trust_resolution_record",
      }),
    });
    assert.equal(policy.allowed, false);
  });

  it("classifies delegation vs workload redistribution", () => {
    const delegatePayload = JSON.stringify({
      taskId,
      targetOperatorId: "website_desk_lead",
      rationale: "Standard delegation for task coverage",
    });
    const workloadPayload = JSON.stringify({
      taskId,
      targetOperatorId: "website_desk_lead",
      rationale: "Operator overload — rebalance workload to backup desk",
    });
    assert.equal(classifyAutomationWorkflow("delegateOperationalTask", delegatePayload), "delegation_execution");
    assert.equal(
      classifyAutomationWorkflow("delegateOperationalTask", workloadPayload),
      "workload_redistribution"
    );
    assert.equal(isWorkloadRedistributionPayload(workloadPayload), true);
  });

  it("builds execution plan with rollback strategy for escalation", () => {
    const payloadJson = JSON.stringify({
      taskId,
      targetOperatorId: "website_desk_lead",
      rationale: "SLA breach",
      priority: "urgent",
    });
    const plan = buildExecutionPlanForAction("escalateOperationalTask", payloadJson);
    assert.equal(plan.workflowKind, "escalation_execution");
    assert.ok(plan.steps.length >= 3);
    const rollback = buildRollbackStrategy("escalateOperationalTask");
    assert.equal(rollback.reversible, true);
    assert.equal(rollback.kind, "coordination_revert");
  });

  it("prepares governed execution preview with policy validation", () => {
    const prepared = prepareGovernedAutomationExecution({
      approvalId: "77777777-7777-4777-8777-777777777777",
      proposedAction: "createTodo",
      payloadJson: JSON.stringify({ clientId, note: "Recovery follow-up" }),
      targetType: "client",
      targetId: clientId,
      status: "pending",
      adminUserId: 1,
      approvalOwnerAdminUserId: 1,
      humanConfirmed: true,
      approvalSource: "automation_panel",
    });
    assert.equal(prepared.ok, true);
    if (prepared.ok) {
      assert.equal(prepared.preview.executionPlan.workflowKind, "recovery_workflow");
      assert.equal(prepared.preview.policyValidation.allowed, true);
      assert.equal(prepared.preview.rollbackStrategy.reversible, true);
    }
  });

  it("marks fulfillment transitions as audit-only reversible", () => {
    assert.equal(isActionReversible("createSiteBuilderTask"), true);
    const strategy = buildRollbackStrategy("createSiteBuilderTask");
    assert.equal(strategy.kind, "audit_mark_reversed");
  });

  it("does not expose automation execute in Skipper read tool picker", () => {
    const tools = pickExecutiveReadTools("show automation execution history and rollback audit");
    assert.ok(!tools.includes("executeExecutiveAutomation" as never));
  });
});
