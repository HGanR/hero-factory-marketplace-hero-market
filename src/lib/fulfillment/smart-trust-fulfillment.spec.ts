import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectClaudeFulfillmentHandoffPrimary,
  smartTrustDeskOnlyHandoffResult,
} from "@/lib/fulfillment/claude-fulfillment-handoff-routing";
import { buildGovernanceReviewCheckpoint } from "@/lib/fulfillment/smart-trust-review-checkpoints";
import { buildComplianceReminders } from "@/lib/fulfillment/smart-trust-compliance-intelligence";
import { assessTrusteeWorkflow } from "@/lib/fulfillment/smart-trust-governance-workflow";
import { parseSmartTrustFulfillmentHandoff } from "@/lib/fulfillment/smart-trust-fulfillment-handoff";
import { summarizeResolutionTracking } from "@/lib/fulfillment/smart-trust-resolution-tracking";
import { buildSmartTrustOrchestrationSignals } from "@/lib/fulfillment/smart-trust-orchestration-signals";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import { resolveSubjectWorkspace } from "@/lib/executive-agent/subject-workspace-state";
import { isWriteAction, WRITE_ACTION_NAMES } from "@/lib/executive-agent/executive-agent-policy";
import { FULFILLMENT_ORCHESTRATION_DEPARTMENTS } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST } from "@/lib/fulfillment/fulfillment-types";

const TRUST_ID = "00000000-0000-4000-8000-000000000020";

describe("SMART_TRUST fulfillment handoff", () => {
  it("parses trustId and governance rounds", () => {
    const h = parseSmartTrustFulfillmentHandoff(
      JSON.stringify({ trustId: TRUST_ID, governanceReviewRound: 1, amendmentReviewRound: 0 })
    );
    assert.equal(h.trustId, TRUST_ID);
    assert.equal(h.governanceReviewRound, 1);
  });
});

describe("governance workflow", () => {
  it("assesses trustee workflow with unresolved actions when trust missing", () => {
    const handoff = parseSmartTrustFulfillmentHandoff("{}");
    const wf = assessTrusteeWorkflow({
      pipelineStage: "service_drafting",
      handoff,
      pendingGovernanceApproval: false,
      pendingResolutionApproval: false,
    });
    assert.ok(wf.unresolvedGovernanceActions.some((u) => u.includes("trust workspace")));
  });

  it("builds governance review checkpoint blockers without trustId", () => {
    const cp = buildGovernanceReviewCheckpoint({
      handoff: parseSmartTrustFulfillmentHandoff("{}"),
      pipelineStage: "executive_handoff_received",
      pendingGovernanceApproval: false,
      pendingResolutionApproval: false,
      governanceApprovalId: null,
    });
    assert.ok(cp.blockers.some((b) => b.includes("Trust workspace")));
  });
});

describe("compliance and resolution tracking", () => {
  it("flags compliance reminders when trust unlinked", () => {
    const c = buildComplianceReminders({
      handoff: parseSmartTrustFulfillmentHandoff("{}"),
      pipelineStage: "service_drafting",
      daysInCurrentStage: 2,
    });
    assert.ok(c.reminders.some((r) => r.id === "link-trust"));
  });

  it("summarizes resolution tracking timeline", () => {
    const handoff = parseSmartTrustFulfillmentHandoff(
      JSON.stringify({
        resolutions: [
          {
            id: "r1",
            title: "Annual meeting",
            status: "recorded",
            minutesSummary: "Notes",
            recordedAt: "2026-05-18T12:00:00.000Z",
          },
        ],
      })
    );
    const s = summarizeResolutionTracking(handoff);
    assert.equal(s.recorded, 1);
    assert.equal(s.timeline.length, 1);
  });
});

describe("orchestration integration", () => {
  it("includes SMART_TRUST in fulfillment departments", () => {
    assert.ok(FULFILLMENT_ORCHESTRATION_DEPARTMENTS.includes("SMART_TRUST"));
  });

  it("rejects Claude worker handoff for SMART_TRUST (desk-only intake)", () => {
    const primary = detectClaudeFulfillmentHandoffPrimary({ service: { primary: "SMART_TRUST" } });
    assert.equal(primary, FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST);
    const result = smartTrustDeskOnlyHandoffResult();
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "smart_trust_desk_only");
  });

  it("resolves smart_trust subject workspace", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "smart_trust" });
    assert.equal(scope.workspaceKind, "smart_trust");
    assert.equal(scope.department, "SMART_TRUST");
  });

  it("registers smart trust write actions", () => {
    assert.ok(isWriteAction("createSmartTrustGovernanceReviewPacket"));
    assert.ok(isWriteAction("recordSmartTrustResolutionCheckpoint"));
    assert.ok(WRITE_ACTION_NAMES.includes("createSmartTrustGovernanceReviewPacket"));
  });

  it("picker selects getExecutiveSmartTrustFulfillment for governance prompts", () => {
    const tools = pickExecutiveReadTools("smart trust governance review blockers", null, {
      dashboardMode: "CRM",
    });
    assert.ok(tools.includes("getExecutiveSmartTrustFulfillment"));
  });

  it("builds orchestration signals for SMART_TRUST order snapshot", () => {
    const signals = buildSmartTrustOrchestrationSignals(
      {
        orderId: "o1",
        clientId: "c1",
        department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
        assignedDepartment: "smart_trust",
        pipelineStage: "owner_review",
        approvalStatus: "pending",
        ownerReviewStatus: null,
        paymentStatus: "confirmed",
        paymentConsumed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        daysInCurrentStage: 3,
        trustId: TRUST_ID,
        governanceReviewApproved: false,
        governanceReviewRound: 1,
      },
      JSON.stringify({ trustId: TRUST_ID })
    );
    assert.ok(signals);
    assert.equal(signals!.trustId, TRUST_ID);
  });
});
