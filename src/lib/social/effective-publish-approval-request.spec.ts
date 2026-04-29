import { describe, it, expect, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import {
  readEffectivePublishApprovalRequiredFromRequest,
  X_BENTLEY_PUBLISH_APPROVAL_SESSION,
} from "@/lib/social/effective-publish-approval-request";

describe("readEffectivePublishApprovalRequiredFromRequest", () => {
  const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;

  afterEach(() => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
  });

  it("is true when env gate is on", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const req = new NextRequest("http://localhost/api/social/posts", { method: "POST" });
    expect(readEffectivePublishApprovalRequiredFromRequest(req)).toBe(true);
  });

  it("is true when session header is 1", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const req = new NextRequest("http://localhost/api/social/posts", {
      method: "POST",
      headers: { [X_BENTLEY_PUBLISH_APPROVAL_SESSION]: "1" },
    });
    expect(readEffectivePublishApprovalRequiredFromRequest(req)).toBe(true);
  });

  it("is false when neither env nor header", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const req = new NextRequest("http://localhost/api/social/posts", { method: "POST" });
    expect(readEffectivePublishApprovalRequiredFromRequest(req)).toBe(false);
  });
});
