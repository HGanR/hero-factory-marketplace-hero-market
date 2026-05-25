import {
  canScheduledPostPublishUnderApprovalMode,
  readScheduledPublishRequireApprovalEnv,
} from "@/lib/revenue-os/publish-approval-gate";

describe("publish-approval-gate", () => {
  const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
  const prevReq = process.env.BENTLEY_REQUIRE_APPROVAL;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
    } else {
      process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
    }
    if (prevReq === undefined) {
      delete process.env.BENTLEY_REQUIRE_APPROVAL;
    } else {
      process.env.BENTLEY_REQUIRE_APPROVAL = prevReq;
    }
  });

  it("allows any scheduled post when approval mode is off (legacy)", () => {
    expect(
      canScheduledPostPublishUnderApprovalMode({
        requireApproval: false,
        utmParams: null,
      })
    ).toEqual({ ok: true });
    expect(
      canScheduledPostPublishUnderApprovalMode({
        requireApproval: false,
        utmParams: { bentley_approval_status: "pending_approval" },
      })
    ).toEqual({ ok: true });
  });

  it("blocks pending rows when approval mode is on", () => {
    const r = canScheduledPostPublishUnderApprovalMode({
      requireApproval: true,
      utmParams: { bentley_approval_status: "pending_approval" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/approval/i);
  });

  it("allows publish when campaign autopilot is on even if approval is pending", () => {
    expect(
      canScheduledPostPublishUnderApprovalMode({
        requireApproval: true,
        utmParams: { bentley_approval_status: "pending_approval" },
        campaignAutopilotPublish: true,
      })
    ).toEqual({ ok: true });
  });

  it("still blocks rejected posts when campaign autopilot is on", () => {
    const r = canScheduledPostPublishUnderApprovalMode({
      requireApproval: true,
      utmParams: { bentley_approval_status: "rejected" },
      campaignAutopilotPublish: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/rejected/i);
  });

  it("allows approved rows when approval mode is on", () => {
    expect(
      canScheduledPostPublishUnderApprovalMode({
        requireApproval: true,
        utmParams: { bentley_approval_status: "approved" },
      })
    ).toEqual({ ok: true });
  });

  it("treats missing approval metadata as not eligible when approval mode is on", () => {
    const r = canScheduledPostPublishUnderApprovalMode({
      requireApproval: true,
      utmParams: {},
    });
    expect(r.ok).toBe(false);
  });

  it("skips rejected rows when approval mode is on", () => {
    const r = canScheduledPostPublishUnderApprovalMode({
      requireApproval: true,
      utmParams: { bentley_approval_status: "rejected" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/rejected/i);
  });

  it("readScheduledPublishRequireApprovalEnv reads truthy env values", () => {
    delete process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
    delete process.env.BENTLEY_REQUIRE_APPROVAL;
    expect(readScheduledPublishRequireApprovalEnv()).toBe(false);
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    expect(readScheduledPublishRequireApprovalEnv()).toBe(true);
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "true";
    expect(readScheduledPublishRequireApprovalEnv()).toBe(true);
  });

  it("readScheduledPublishRequireApprovalEnv honors BENTLEY_REQUIRE_APPROVAL alias", () => {
    delete process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
    delete process.env.BENTLEY_REQUIRE_APPROVAL;
    expect(readScheduledPublishRequireApprovalEnv()).toBe(false);
    process.env.BENTLEY_REQUIRE_APPROVAL = "yes";
    expect(readScheduledPublishRequireApprovalEnv()).toBe(true);
  });
});
