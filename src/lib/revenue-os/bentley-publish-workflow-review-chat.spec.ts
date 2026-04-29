import { isPublishWorkflowReviewIntent } from "@/lib/revenue-os/bentley-publish-workflow-review-chat";

describe("bentley-publish-workflow-review-chat", () => {
  it("detects operator review intents", () => {
    expect(isPublishWorkflowReviewIntent("show me what is ready to go out")).toBe(true);
    expect(isPublishWorkflowReviewIntent("review my posting workflow")).toBe(true);
    expect(isPublishWorkflowReviewIntent("what is blocked before publishing")).toBe(true);
    expect(isPublishWorkflowReviewIntent("confirm my schedule")).toBe(true);
    expect(isPublishWorkflowReviewIntent("what still needs review")).toBe(true);
  });
});
