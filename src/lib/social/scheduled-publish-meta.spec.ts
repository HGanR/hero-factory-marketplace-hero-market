import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeRawScheduledPublishMeta,
  mergeScheduledPublishMeta,
  parseScheduledPublishMeta,
  isContent360PlatformScheduleTrustedMeta,
  stripServerWrittenScheduledPublishMetaForUserMerge,
} from "@/lib/social/scheduled-publish-meta";

describe("scheduled-publish-meta (Content360 extensions)", () => {
  it("parseScheduledPublishMeta reads publishRoute and provider fields", () => {
    const m = parseScheduledPublishMeta({
      publishRoute: "content360",
      provider: "content360",
      providerConnectionId: "conn-1",
      publishAttemptCount: 2,
    });
    assert.equal(m.publishRoute, "content360");
    assert.equal(m.provider, "content360");
    assert.equal(m.providerConnectionId, "conn-1");
    assert.equal(m.publishAttemptCount, 2);
  });

  it("mergeScheduledPublishMeta remains backward compatible for legacy rows", () => {
    const prev = { publishAttemptCount: 1, lastPublishError: "x" };
    const next = mergeScheduledPublishMeta(prev, { nextPublishAttemptAt: "2026-01-01T00:00:00.000Z" });
    assert.equal(next.publishAttemptCount, 1);
    assert.equal(next.lastPublishError, "x");
    assert.equal(next.nextPublishAttemptAt, "2026-01-01T00:00:00.000Z");
  });

  it("mergeRawScheduledPublishMeta preserves unknown keys while applying typed patch", () => {
    const raw = {
      bentley_custom_flag: "keep-me",
      publishAttemptCount: 0,
      scheduledPublishSource: "bentley_sync_launch",
    };
    const out = mergeRawScheduledPublishMeta(raw, {
      publishRoute: "content360",
      provider: "content360",
      providerPublishJobId: "job-1",
    });
    assert.equal((out as { bentley_custom_flag?: string }).bentley_custom_flag, "keep-me");
    assert.equal((out as { publishRoute?: string }).publishRoute, "content360");
    assert.equal((out as { providerPublishJobId?: string }).providerPublishJobId, "job-1");
    assert.equal((out as { scheduledPublishSource?: string }).scheduledPublishSource, "bentley_sync_launch");
  });

  it("parseScheduledPublishMeta reads platform Content360 lineage fields", () => {
    const m = parseScheduledPublishMeta({
      content360PlatformPublish: true,
      content360ProviderResponse: { ok: true },
    });
    assert.equal(m.content360PlatformPublish, true);
    assert.deepEqual(m.content360ProviderResponse, { ok: true });
  });

  it("parseScheduledPublishMeta reads content360PlatformScheduled", () => {
    const m = parseScheduledPublishMeta({
      publishRoute: "content360",
      content360PlatformScheduled: true,
      scheduledPublishSource: "bentley_sync_launch",
    });
    assert.equal(m.content360PlatformScheduled, true);
    assert.equal(m.publishRoute, "content360");
  });

  it("isContent360PlatformScheduleTrustedMeta accepts bentley_sync_launch without job id", () => {
    assert.equal(
      isContent360PlatformScheduleTrustedMeta({
        publishRoute: "content360",
        content360PlatformScheduled: true,
        scheduledPublishSource: "bentley_sync_launch",
      }),
      true,
    );
  });

  it("isContent360PlatformScheduleTrustedMeta rejects manual_schedule", () => {
    assert.equal(
      isContent360PlatformScheduleTrustedMeta({
        publishRoute: "content360",
        content360PlatformScheduled: true,
        scheduledPublishSource: "manual_schedule",
      }),
      false,
    );
  });

  it("isContent360PlatformScheduleTrustedMeta rejects when providerPublishJobId is set", () => {
    assert.equal(
      isContent360PlatformScheduleTrustedMeta({
        publishRoute: "content360",
        content360PlatformScheduled: true,
        scheduledPublishSource: "bentley_sync_launch",
        providerPublishJobId: "job-1",
      }),
      false,
    );
  });

  it("stripServerWrittenScheduledPublishMetaForUserMerge removes forged platform scheduled flag", () => {
    const cleaned = stripServerWrittenScheduledPublishMetaForUserMerge({
      publishRoute: "content360",
      content360PlatformScheduled: true,
      other: 1,
    });
    assert.equal(cleaned.content360PlatformScheduled, undefined);
    assert.equal(cleaned.publishRoute, "content360");
    assert.equal(cleaned.other, 1);
  });
});
