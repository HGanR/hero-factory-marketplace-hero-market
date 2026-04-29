/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishApprovalReportScheduleControls } from "./PublishApprovalReportScheduleControls";

describe("PublishApprovalReportScheduleControls", () => {
  it("renders schedule shell", () => {
    const h = renderToStaticMarkup(
      <PublishApprovalReportScheduleControls
        campaignId="camp-1"
        initialSchedule={{
          enabled: true,
          frequency: "weekly",
          format: "json",
          recipientMode: "owner_only",
        }}
      />
    );
    expect(h).toContain("publish-approval-report-schedule");
    expect(h).toContain("Scheduled compliance reports");
    expect(h).toContain("Save schedule");
    expect(h).toContain("Clear schedule");
  });

  it("shows plan gate copy and disables actions when planGated", () => {
    const h = renderToStaticMarkup(
      <PublishApprovalReportScheduleControls
        campaignId="camp-1"
        initialSchedule={null}
        planGated
      />
    );
    expect(h).toContain("publish-approval-report-schedule-plan-gated");
    expect(h).toContain("disabled");
  });
});
