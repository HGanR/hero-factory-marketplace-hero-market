import { ExecuteIntentRequestSchema } from "@/lib/site-builder/assistant/execute-intent-types";

describe("ExecuteIntentRequestSchema", () => {
  it("accepts valid payload", () => {
    const r = ExecuteIntentRequestSchema.safeParse({
      message: "hello",
      siteId: "550e8400-e29b-41d4-a716-446655440000",
      versionId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      schemaSnapshotHash: "a".repeat(64),
      sessionId: "sess-1",
      editContext: { lastSectionIds: ["sec-1"], lastPageSlug: "/" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects bad siteId", () => {
    const r = ExecuteIntentRequestSchema.safeParse({
      message: "x",
      siteId: "not-a-uuid",
      sessionId: "s",
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(r.success).toBe(false);
  });
});
