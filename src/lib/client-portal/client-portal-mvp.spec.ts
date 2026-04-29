/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";
import { hashInviteToken, generateRawInviteToken } from "./invite-token";
import { createClientPortalToken, verifyClientPortalToken } from "./portal-token";
import { createToken, hashPassword, verifyPassword } from "@/lib/auth";

describe("client portal MVP", () => {
  it("invite token is hashed (sha256 hex)", () => {
    const raw = generateRawInviteToken();
    const h = hashInviteToken(raw);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain(raw.slice(0, 8));
  });

  it("portal JWT round-trip includes portal claims", () => {
    const tok = createClientPortalToken({
      portalUserId: "pu-1",
      clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ownerUserId: 42,
      role: "manager",
    });
    const p = verifyClientPortalToken(tok);
    expect(p?.portalUserId).toBe("pu-1");
    expect(p?.clientId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(p?.ownerUserId).toBe(42);
    expect(p?.role).toBe("manager");
  });

  it("auth marketplace token is not accepted as portal token", () => {
    const market = createToken({ userId: 1 });
    expect(verifyClientPortalToken(market)).toBeNull();
  });

  it("password hash + verify (bcrypt)", () => {
    const h = hashPassword("secret12345");
    expect(verifyPassword("secret12345", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});
