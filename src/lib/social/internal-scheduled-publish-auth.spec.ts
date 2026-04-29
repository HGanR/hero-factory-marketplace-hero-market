/**
 * @jest-environment node
 */
import { isAuthorizedScheduledPublishRequest } from "@/lib/social/internal-scheduled-publish-auth";

describe("internal-scheduled-publish-auth", () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  it("rejects when no secret configured", () => {
    delete process.env.SCHEDULED_PUBLISH_WORKER_SECRET;
    delete process.env.CRON_SECRET;
    expect(
      isAuthorizedScheduledPublishRequest({
        headers: new Headers({ "x-scheduled-publish-secret": "x" }),
      })
    ).toBe(false);
  });

  it("accepts matching x-scheduled-publish-secret", () => {
    process.env.SCHEDULED_PUBLISH_WORKER_SECRET = "abc";
    expect(
      isAuthorizedScheduledPublishRequest({
        headers: new Headers({ "x-scheduled-publish-secret": "abc" }),
      })
    ).toBe(true);
    expect(
      isAuthorizedScheduledPublishRequest({
        headers: new Headers({ "x-scheduled-publish-secret": "wrong" }),
      })
    ).toBe(false);
  });

  it("accepts CRON_SECRET via x-cron-secret", () => {
    process.env.CRON_SECRET = "cron";
    expect(
      isAuthorizedScheduledPublishRequest({
        headers: new Headers({ "x-cron-secret": "cron" }),
      })
    ).toBe(true);
  });

  it("accepts Authorization Bearer", () => {
    process.env.CRON_SECRET = "tok";
    expect(
      isAuthorizedScheduledPublishRequest({
        headers: new Headers({ authorization: "Bearer tok" }),
      })
    ).toBe(true);
  });
});
