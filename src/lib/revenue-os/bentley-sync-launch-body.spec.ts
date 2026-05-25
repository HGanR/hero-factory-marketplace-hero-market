import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bentleySyncLaunchBodySchema } from "@/lib/revenue-os/bentley-sync-launch-body";

const validId = "123e4567-e89b-12d3-a456-426614174000";

describe("bentleySyncLaunchBodySchema", () => {
  it("parses minimal staggered launch without platform schedule", () => {
    const p = bentleySyncLaunchBodySchema.parse({
      campaignId: validId,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
    });
    assert.equal(p.content360PlatformSchedule, undefined);
  });

  it("requires publishRoute content360 when content360PlatformSchedule is true", () => {
    assert.throws(
      () =>
        bentleySyncLaunchBodySchema.parse({
          campaignId: validId,
          scheduleStrategy: "staggered",
          staggerMinutes: 30,
          content360PlatformSchedule: true,
        }),
      /publishRoute/
    );
  });

  it("requires staggered strategy when content360PlatformSchedule is true", () => {
    assert.throws(
      () =>
        bentleySyncLaunchBodySchema.parse({
          campaignId: validId,
          scheduleStrategy: "immediate",
          content360PlatformSchedule: true,
          publishRoute: "content360",
        }),
      /scheduleStrategy/
    );
  });

  it("accepts admin platform schedule payload", () => {
    const p = bentleySyncLaunchBodySchema.parse({
      campaignId: validId,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
      content360PlatformSchedule: true,
      publishRoute: "content360",
    });
    assert.equal(p.content360PlatformSchedule, true);
    assert.equal(p.publishRoute, "content360");
    assert.equal(p.scheduleStrategy, "staggered");
  });
});
