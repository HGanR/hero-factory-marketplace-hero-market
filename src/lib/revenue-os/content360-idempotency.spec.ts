import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildContent360ScheduleIdempotencyKey,
  findActiveContent360ScheduleDuplicate,
} from "@/lib/revenue-os/content360-idempotency";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";

describe("Content360 idempotency", () => {
  it("buildContent360ScheduleIdempotencyKey is stable per post+provider+second", () => {
    const d = new Date("2026-03-15T14:22:47.900Z");
    const a = buildContent360ScheduleIdempotencyKey({
      campaignPostId: "post-1",
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt: d,
    });
    const b = buildContent360ScheduleIdempotencyKey({
      campaignPostId: "post-1",
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt: new Date("2026-03-15T14:22:47.100Z"),
    });
    assert.equal(a, b);
    const c = buildContent360ScheduleIdempotencyKey({
      campaignPostId: "post-1",
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt: new Date("2026-03-15T14:22:48.000Z"),
    });
    assert.notEqual(a, c);
  });

  it("findActiveContent360ScheduleDuplicate matches idempotencyKey on payload", async () => {
    const scheduledAt = new Date("2026-01-01T12:00:00.000Z");
    const idempotencyKey = buildContent360ScheduleIdempotencyKey({
      campaignPostId: "cp1",
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt,
    });
    const row = {
      id: "job-1",
      scheduledAt,
      providerPayloadJson: { idempotencyKey },
    };
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit: async () => [row],
                };
              },
            };
          },
        };
      },
    };
    const dup = await findActiveContent360ScheduleDuplicate(db as never, {
      clientId: "00000000-0000-4000-8000-000000000001",
      campaignPostId: "cp1",
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt,
      idempotencyKey,
    });
    assert.equal(dup?.id, "job-1");
  });
});
