import {
  buildPublishWorkflowDebugApprovalAuditUrl,
  narrowPublishWorkflowDebugAuditFilters,
} from "@/lib/revenue-os/publish-workflow-debug-approval-audit";

describe("publish-workflow-debug-approval-audit", () => {
  describe("buildPublishWorkflowDebugApprovalAuditUrl", () => {
    it("includes limit and optional postId and platform", () => {
      expect(buildPublishWorkflowDebugApprovalAuditUrl({ limit: 5 })).toBe(
        "/api/revenue-os/approval-audit-recent?limit=5"
      );
      expect(
        buildPublishWorkflowDebugApprovalAuditUrl({
          limit: 5,
          postId: "post-1",
          platform: "linkedin",
        })
      ).toBe("/api/revenue-os/approval-audit-recent?limit=5&postId=post-1&platform=linkedin");
    });
  });

  describe("narrowPublishWorkflowDebugAuditFilters", () => {
    it("returns empty when not exactly one row", () => {
      expect(narrowPublishWorkflowDebugAuditFilters([])).toEqual({});
      expect(narrowPublishWorkflowDebugAuditFilters(undefined)).toEqual({});
      expect(
        narrowPublishWorkflowDebugAuditFilters([
          { id: "a", platform: "x" },
          { id: "b", platform: "y" },
        ])
      ).toEqual({});
    });

    it("returns postId and platform for a single row", () => {
      expect(
        narrowPublishWorkflowDebugAuditFilters([{ id: " pid ", platform: " linkedin " }])
      ).toEqual({ postId: "pid", platform: "linkedin" });
    });
  });
});
