/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishWorkflowDebugApprovalAuditList } from "./PublishWorkflowDebugApprovalAuditList";
import type { PublishApprovalAuditRecentApiEvent } from "@/lib/revenue-os/publish-approval-audit";

describe("PublishWorkflowDebugApprovalAuditList", () => {
  const formatWhen = (s: string) => s.slice(0, 10);

  it("renders multiple recent events in API order", () => {
    const events: PublishApprovalAuditRecentApiEvent[] = [
      {
        id: "evt-first",
        postId: "p-a",
        action: "publish_approval_approved",
        platform: "linkedin",
        details: {},
        createdAt: "2026-02-02T00:00:00.000Z",
        actorDisplayName: "Alex",
      },
      {
        id: "evt-second",
        postId: "p-b",
        action: "publish_approval_rejected",
        platform: "instagram",
        details: {},
        createdAt: "2026-02-01T00:00:00.000Z",
        actorUserId: 99,
      },
    ];
    const html = renderToStaticMarkup(
      <PublishWorkflowDebugApprovalAuditList events={events} formatWhen={formatWhen} />
    );
    const i1 = html.indexOf('data-event-id="evt-first"');
    const i2 = html.indexOf('data-event-id="evt-second"');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(-1);
    expect(i1).toBeLessThan(i2);
    expect(html).toContain("publish_approval_approved");
    expect(html).toContain("user #99");
  });
});
