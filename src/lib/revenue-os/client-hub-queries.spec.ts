import { assertValidClientId } from "@/lib/revenue-os/client-hub-queries";

describe("client hub query helpers", () => {
  it("assertValidClientId accepts RFC4122 uuids", () => {
    expect(() => assertValidClientId("550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
  });

  it("assertValidClientId rejects empty and non-uuid strings", () => {
    expect(() => assertValidClientId("")).toThrow("Invalid client id");
    expect(() => assertValidClientId("not-a-uuid")).toThrow("Invalid client id");
  });
});
