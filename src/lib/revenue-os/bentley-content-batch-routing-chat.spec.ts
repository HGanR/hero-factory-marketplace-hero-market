import { isContentBatchRoutingIntent } from "@/lib/revenue-os/bentley-content-batch-routing-chat";

describe("bentley-content-batch-routing-chat", () => {
  it("detects content batch / awareness / sequencing questions", () => {
    expect(isContentBatchRoutingIntent("What kind of content did we generate?")).toBe(true);
    expect(isContentBatchRoutingIntent("Which posts are for awareness?")).toBe(true);
    expect(isContentBatchRoutingIntent("Which content should I post first?")).toBe(true);
    expect(isContentBatchRoutingIntent("Which batch should go to Instagram?")).toBe(true);
    expect(isContentBatchRoutingIntent("How is my content batched?")).toBe(true);
  });

  it("does not steal generic platform-role questions without content focus", () => {
    expect(isContentBatchRoutingIntent("Which platform should I use for awareness?")).toBe(false);
  });
});
