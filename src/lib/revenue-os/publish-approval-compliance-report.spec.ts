/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildPublishApprovalComplianceReportCsv,
  composePublishApprovalComplianceReport,
  extractPublishApprovalChainFieldsFromAuditDetails,
  mapRowToPublishApprovalComplianceAuditRow,
  mapReviewerAssignmentAuditRowToComplianceItem,
  parsePublishApprovalReportQueryParams,
  PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_DEFAULT,
  PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MAX,
  PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MIN,
} from "@/lib/revenue-os/publish-approval-compliance-report";
import { BENTLEY_UTM_APPROVAL_STATUS, BENTLEY_UTM_APPROVAL_STEP_STARTED_AT } from "@/lib/revenue-os/publish-approval-utm";

describe("parsePublishApprovalReportQueryParams", () => {
  it("defaults format json, include flags true, audit limit 25", () => {
    const q = parsePublishApprovalReportQueryParams(new URLSearchParams(""));
    expect(q.format).toBe("json");
    expect(q.includeCurrentState).toBe(true);
    expect(q.includeAuditTail).toBe(true);
    expect(q.auditLimit).toBe(PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_DEFAULT);
  });

  it("clamps auditLimit between 1 and 100", () => {
    expect(parsePublishApprovalReportQueryParams(new URLSearchParams("auditLimit=0")).auditLimit).toBe(
      PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MIN
    );
    expect(parsePublishApprovalReportQueryParams(new URLSearchParams("auditLimit=500")).auditLimit).toBe(
      PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MAX
    );
    expect(parsePublishApprovalReportQueryParams(new URLSearchParams("auditLimit=40")).auditLimit).toBe(40);
  });

  it("parses format csv and boolean flags", () => {
    const q = parsePublishApprovalReportQueryParams(
      new URLSearchParams("format=csv&includeCurrentState=false&includeAuditTail=0")
    );
    expect(q.format).toBe("csv");
    expect(q.includeCurrentState).toBe(false);
    expect(q.includeAuditTail).toBe(false);
  });
});

describe("extractPublishApprovalChainFieldsFromAuditDetails", () => {
  it("reads chain fields from details object", () => {
    const f = extractPublishApprovalChainFieldsFromAuditDetails({
      approvalStepIndex: 1,
      approvalStepRole: "approver",
      chainCompleted: false,
    });
    expect(f).toEqual({
      approvalStepIndex: 1,
      approvalStepRole: "approver",
      chainCompleted: false,
    });
  });
});

describe("mapRowToPublishApprovalComplianceAuditRow", () => {
  it("maps actor and chain fields", () => {
    const r = mapRowToPublishApprovalComplianceAuditRow({
      id: "e1",
      postId: "p1",
      action: "publish_approval_approved",
      platform: "linkedin",
      details: {
        decidedByUserId: 9,
        decidedByLabel: "Pat",
        reviewerRole: "approver",
        approvalStepIndex: 0,
        approvalStepRole: "editor",
        chainCompleted: true,
      },
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    expect(r.postId).toBe("p1");
    expect(r.action).toBe("publish_approval_approved");
    expect(r.actorUserId).toBe(9);
    expect(r.actorDisplayName).toBe("Pat");
    expect(r.reviewerRole).toBe("approver");
    expect(r.approvalStepIndex).toBe(0);
    expect(r.approvalStepRole).toBe("editor");
    expect(r.chainCompleted).toBe(true);
    expect(r.createdAt).toContain("2026-04-01");
  });
});

describe("mapReviewerAssignmentAuditRowToComplianceItem", () => {
  it("returns only compliance fields", () => {
    const r = mapReviewerAssignmentAuditRowToComplianceItem({
      id: "a1",
      campaignId: "c1",
      action: "reviewer_added",
      targetUserId: "5",
      actorUserId: "9",
      previousRole: null,
      nextRole: "approver",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
    } as never);
    expect(r).toEqual({
      action: "reviewer_added",
      targetUserId: 5,
      actorUserId: 9,
      previousRole: null,
      nextRole: "approver",
      createdAt: "2026-04-02T00:00:00.000Z",
    });
    expect((r as { id?: string }).id).toBeUndefined();
  });
});

describe("composePublishApprovalComplianceReport", () => {
  const basePosts = [
    {
      id: "young",
      utmParams: {
        [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
        [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-04-05T10:00:00.000Z",
      },
    },
    {
      id: "old",
      utmParams: {
        [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
        [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-04-04T10:00:00.000Z",
      },
    },
  ];

  it("includes expected sections and stalled ordering by age desc", () => {
    const report = composePublishApprovalComplianceReport({
      generatedAt: new Date("2026-04-05T12:00:00.000Z"),
      campaignId: "camp-1",
      campaignName: "Test",
      publishApprovalChainJson: null,
      workerRequiresApproval: true,
      postRows: basePosts,
      includeCurrentState: true,
      includeAuditTail: true,
      publishApprovalAuditTail: [],
      reviewerAssignmentAuditTail: [],
    });
    expect(report.campaign.campaignId).toBe("camp-1");
    expect(report.campaign.campaignName).toBe("Test");
    expect(report.currentState?.summary.pendingApprovalCount).toBe(2);
    expect(report.currentState?.stalledPosts[0]?.postId).toBe("old");
    expect(report.currentState?.stalledPosts[1]?.postId).toBe("young");
    expect(report.publishApprovalAuditTail).toEqual([]);
    expect(report.reviewerAssignmentAuditTail).toEqual([]);
  });

  it("omits currentState when includeCurrentState is false", () => {
    const report = composePublishApprovalComplianceReport({
      generatedAt: new Date(),
      campaignId: "c",
      campaignName: "N",
      publishApprovalChainJson: null,
      workerRequiresApproval: true,
      postRows: basePosts,
      includeCurrentState: false,
      includeAuditTail: false,
    });
    expect(report.currentState).toBeUndefined();
    expect(report.publishApprovalAuditTail).toBeUndefined();
  });
});

describe("buildPublishApprovalComplianceReportCsv", () => {
  it("includes row_kind stalled and summary sections", () => {
    const report = composePublishApprovalComplianceReport({
      generatedAt: new Date("2026-04-05T12:00:00.000Z"),
      campaignId: "camp-1",
      campaignName: "CSV Camp",
      publishApprovalChainJson: null,
      workerRequiresApproval: true,
      postRows: [
        {
          id: "p1",
          utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval", [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-04-05T11:00:00.000Z" },
        },
      ],
      includeCurrentState: true,
      includeAuditTail: true,
      publishApprovalAuditTail: [
        {
          action: "publish_approval_approved",
          postId: "p1",
          actorUserId: 1,
          actorDisplayName: "A",
          reviewerRole: "owner",
          approvalStepIndex: null,
          approvalStepRole: null,
          chainCompleted: null,
          createdAt: "2026-04-03T00:00:00.000Z",
        },
      ],
      reviewerAssignmentAuditTail: [
        {
          action: "reviewer_added",
          targetUserId: 2,
          actorUserId: 1,
          previousRole: null,
          nextRole: "approver",
          createdAt: "2026-04-02T00:00:00.000Z",
        },
      ],
    });
    const csv = buildPublishApprovalComplianceReportCsv(report);
    expect(csv).toContain("row_kind");
    expect(csv).toContain("stalled");
    expect(csv).toContain("publish_approval_audit");
    expect(csv).toContain("reviewer_assignment_audit");
    expect(csv).toContain("summary");
    expect(csv).toContain("CSV Camp");
  });
});
