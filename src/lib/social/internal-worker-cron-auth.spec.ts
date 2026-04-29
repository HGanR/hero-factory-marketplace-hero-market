/**
 * @jest-environment node
 */
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";

describe("internal-worker-cron-auth", () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  it("rejects when no secrets configured", () => {
    delete process.env.SCHEDULED_PUBLISH_WORKER_SECRET;
    delete process.env.CRON_SECRET;
    expect(
      isAuthorizedInternalCronRequest({
        headers: new Headers({ "x-scheduled-publish-secret": "x" }),
      })
    ).toBe(false);
  });

  it("accepts matching scheduled publish secret header", () => {
    process.env.SCHEDULED_PUBLISH_WORKER_SECRET = "secret";
    expect(
      isAuthorizedInternalCronRequest({
        headers: new Headers({ "x-scheduled-publish-secret": "secret" }),
      })
    ).toBe(true);
  });
});
