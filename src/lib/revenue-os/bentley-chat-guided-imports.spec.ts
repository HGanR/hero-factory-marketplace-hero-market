/**
 * Smoke test: critical Bentley chat / pipeline helpers must export real functions (no empty modules).
 */

import {
  formatBentleyDeploymentFeedbackReply,
  isDeploymentFeedbackIntent,
} from "@/lib/revenue-os/bentley-deployment-feedback-chat";
import { buildBentleyNotesPayload } from "@/lib/revenue-os/bentley-notes-payload";
import {
  formatApproveAllRedirectReply,
  isPublishApprovalFocusIntent,
} from "@/lib/revenue-os/bentley-publish-approval-chat";

describe("Bentley guided import surface", () => {
  it("exports callable chat helpers", () => {
    expect(typeof isDeploymentFeedbackIntent).toBe("function");
    expect(typeof formatBentleyDeploymentFeedbackReply).toBe("function");
    expect(typeof buildBentleyNotesPayload).toBe("function");
    expect(typeof isPublishApprovalFocusIntent).toBe("function");
    expect(typeof formatApproveAllRedirectReply).toBe("function");
  });

  it("publish approval intents do not throw when evaluated", () => {
    expect(() => isPublishApprovalFocusIntent("what is approved")).not.toThrow();
  });
});
