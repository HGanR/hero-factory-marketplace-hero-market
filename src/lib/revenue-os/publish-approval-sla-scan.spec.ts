/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { runCampaignPublishApprovalSlaScan } from "@/lib/revenue-os/publish-approval-sla-scan";
import * as publishApprovalNotification from "@/lib/revenue-os/publish-approval-notification";
import {
  BENTLEY_UTM_APPROVAL_STATUS,
  BENTLEY_UTM_APPROVAL_STEP_STARTED_AT,
  BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP,
} from "@/lib/revenue-os/publish-approval-utm";

jest.mock("@/lib/revenue-os/publish-approval-notification", () => ({
  createPublishApprovalStepSlaOverdueNotifications: jest.fn(async () => {}),
}));

describe("runCampaignPublishApprovalSlaScan dedupe", () => {
  beforeEach(() => {
    jest.mocked(publishApprovalNotification.createPublishApprovalStepSlaOverdueNotifications).mockClear();
  });

  it("does not emit a second reminder when the same logical step is already recorded on the post", async () => {
    const oldIso = "2020-01-01T00:00:00.000Z";
    const utm = {
      [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
      [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: oldIso,
      [BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP]: "0",
    };
    const updates: unknown[] = [];
    const db = {
      update: jest.fn(() => ({
        set: (patch: unknown) => {
          updates.push(patch);
          return {
            where: jest.fn().mockResolvedValue(undefined),
          };
        },
      })),
    };

    await runCampaignPublishApprovalSlaScan(db as never, {
      campaignId: "camp",
      campaignName: "C",
      clientId: "cl",
      ownerUserId: "1",
      publishApprovalChainJson: null,
      posts: [{ id: "p1", utmParams: { ...utm } }],
      workerRequiresApproval: true,
      assignmentRows: [],
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(publishApprovalNotification.createPublishApprovalStepSlaOverdueNotifications).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
