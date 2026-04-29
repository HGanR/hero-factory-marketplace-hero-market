import { mergeClientActivityByTime } from "./client-activity-timeline-adapter";
import type { ClientActivityItem } from "./client-hub-types";

const base = (over: Partial<ClientActivityItem>): ClientActivityItem => ({
  id: "x",
  kind: "site",
  title: "t",
  detail: null,
  occurredAt: "2020-01-01T00:00:00.000Z",
  ...over,
});

describe("mergeClientActivityByTime", () => {
  it("dedupes by id and orders newest first", () => {
    const items: ClientActivityItem[] = [
      base({ id: "a", occurredAt: "2024-01-01T00:00:00.000Z" }),
      base({ id: "a", kind: "campaign", title: "dup" }),
      base({ id: "b", occurredAt: "2025-01-01T00:00:00.000Z" }),
    ];
    const out = mergeClientActivityByTime(items, 10);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("b");
    expect(out[1]!.id).toBe("a");
    expect(out[1]!.title).toBe("t");
  });
});
