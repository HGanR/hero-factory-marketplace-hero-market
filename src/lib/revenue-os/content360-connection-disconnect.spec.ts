import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countActiveContent360JobsForConnection } from "@/lib/revenue-os/content360-connection-disconnect";

describe("Content360 disconnect guards", () => {
  it("countActiveContent360JobsForConnection sums scheduled+queued", async () => {
    const db = {
      select() {
        return {
          from() {
            return {
              where: async () => [{ n: 3n }],
            };
          },
        };
      },
    };
    const n = await countActiveContent360JobsForConnection(db as never, {
      clientId: "00000000-0000-4000-8000-000000000001",
      connectionId: "conn-1",
    });
    assert.equal(n, 3);
  });
});
