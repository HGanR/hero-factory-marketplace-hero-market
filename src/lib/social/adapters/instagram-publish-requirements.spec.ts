import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { instagramAdapter } from "@/lib/social/adapters/instagram";
import type { SocialAccount } from "@/lib/social/types";

describe("instagramAdapter publish requirements", () => {
  const prevFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = prevFetch;
  });

  it("fails clearly when no image/video URL (text-only)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ instagram_business_account: { id: "178414000" } }),
      text: async () => "",
    });

    const account: SocialAccount = {
      id: "a1",
      userId: "u1",
      clientId: "c1",
      platform: "instagram",
      authType: "OAUTH",
      accessToken: "token",
      externalAccountId: "page-1",
    };

    await expect(
      instagramAdapter.publish(account, { caption: "Only text", linkUrl: undefined })
    ).rejects.toThrow(/requires an image or video/);
  });
});
