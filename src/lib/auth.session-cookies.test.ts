import test from "node:test";
import assert from "node:assert/strict";
import { createToken, marketplaceUserIdFromSessionCookiePair } from "@/lib/auth";

test("session cookie pair prefers platform-admin admin-token over auth-token", () => {
  const adminTok = createToken({ userId: 1, isAdmin: true, username: "admin" });
  const userTok = createToken({ userId: 99, username: "buyer" });
  assert.equal(marketplaceUserIdFromSessionCookiePair(userTok, adminTok), 1);
});

test("session cookie pair uses auth-token when admin-token is not admin", () => {
  const nonAdminTok = createToken({ userId: 2, username: "other" });
  const userTok = createToken({ userId: 99, username: "buyer" });
  assert.equal(marketplaceUserIdFromSessionCookiePair(userTok, nonAdminTok), 99);
});

test("session cookie pair uses auth-token when admin cookie empty", () => {
  const userTok = createToken({ userId: 42, username: "solo" });
  assert.equal(marketplaceUserIdFromSessionCookiePair(userTok, ""), 42);
});
