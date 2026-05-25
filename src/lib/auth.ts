// src/lib/auth.ts
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export function createToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Coerce JWT `userId` (string or number) to marketplace user id, or null if missing/invalid. */
export function normalizeJwtUserId(userId: unknown): number | null {
  if (userId == null) return null;
  if (typeof userId === "bigint") {
    const n = Number(userId);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  if (typeof userId === "number" && Number.isFinite(userId)) return Math.trunc(userId);
  if (typeof userId === "string") {
    const t = userId.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Resolve marketplace numeric user id from a verified JWT payload.
 * Tries `userId` then `id` (some hand-rolled tokens only set `id`).
 */
export function marketplaceUserIdFromJwtPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return normalizeJwtUserId(p.userId) ?? normalizeJwtUserId(p.id);
}

/** JWT from `/api/admin/login` — used to prefer admin identity when both session cookies exist. */
export function jwtPayloadIndicatesPlatformAdmin(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  return (payload as Record<string, unknown>).isAdmin === true;
}

/**
 * Numeric marketplace user id for ownership checks. If `admin-token` verifies as platform admin,
 * its `userId` wins over `auth-token`. That way an admin who later logs in as a test user (new
 * `auth-token`) still sees Client Hub rows and `/api/clients/*` scoped to the admin user while
 * `admin-token` remains set. To browse strictly as the test user, clear admin session (logout)
 * or use a separate browser profile.
 */
export function marketplaceUserIdFromSessionCookiePair(
  authTokenCookie: string,
  adminTokenCookie: string,
): number | null {
  const adminRaw = adminTokenCookie.trim();
  if (adminRaw) {
    const adminPayload = verifyToken(adminRaw);
    if (jwtPayloadIndicatesPlatformAdmin(adminPayload)) {
      const fromAdmin = marketplaceUserIdFromJwtPayload(adminPayload);
      if (fromAdmin != null) return fromAdmin;
    }
  }
  const authRaw = authTokenCookie.trim();
  if (!authRaw) return null;
  const authPayload = verifyToken(authRaw);
  return marketplaceUserIdFromJwtPayload(authPayload);
}

/**
 * Resolve marketplace user id from Next.js request cookies (API routes).
 * Throws Error("Unauthorized") when neither cookie yields a valid user id.
 */
export function requireUserId(req: NextRequest): number {
  const auth = req.cookies.get("auth-token")?.value ?? "";
  const admin = req.cookies.get("admin-token")?.value ?? "";
  const id = marketplaceUserIdFromSessionCookiePair(auth, admin);
  if (id == null) {
    throw new Error("Unauthorized");
  }
  return id;
}

