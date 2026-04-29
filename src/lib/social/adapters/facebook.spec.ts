import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { facebookAdapter } from "@/lib/social/adapters/facebook";
import type { SocialAccount } from "@/lib/social/types";

describe("facebookAdapter", () => {
  const prevFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = prevFetch;
  });

  it("throws when Page id is missing", async () => {
    const account: SocialAccount = {
      id: "a1",
      userId: "u1",
      clientId: "c1",
      platform: "facebook",
      authType: "OAUTH",
      accessToken: "token",
      externalAccountId: null,
    };
    await expect(
      facebookAdapter.publish(account, { caption: "Hi", linkUrl: "https://example.com" })
    ).rejects.toThrow(/Page is not linked/);
  });

  it("POSTs to Page feed and returns platform post id", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "123_456" }),
      text: async () => "",
    });

    const account: SocialAccount = {
      id: "a1",
      userId: "u1",
      clientId: "c1",
      platform: "facebook",
      authType: "OAUTH",
      accessToken: "page-token",
      externalAccountId: "page-99",
    };

    const r = await facebookAdapter.publish(account, {
      caption: "Hello",
      linkUrl: "https://example.com/p",
    });

    expect(r.platformPostId).toBe("123_456");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/page-99/feed",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("POSTs to Page photos when IMAGE asset URL is present", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "photo-1" }),
      text: async () => "",
    });

    const account: SocialAccount = {
      id: "a1",
      userId: "u1",
      clientId: "c1",
      platform: "facebook",
      authType: "OAUTH",
      accessToken: "page-token",
      externalAccountId: "page-99",
    };

    const r = await facebookAdapter.publish(account, {
      caption: "Shot",
      assetUrl: "https://cdn.example.com/p.jpg",
      assetCreativeType: "IMAGE",
      linkUrl: "https://example.com/landing",
    });

    expect(r.platformPostId).toBe("photo-1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/page-99/photos",
      expect.objectContaining({ method: "POST" })
    );
  });
});
