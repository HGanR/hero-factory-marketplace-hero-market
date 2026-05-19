/**
 * HS256 JWT sign/verify for admin NPC cookies using `jose` (Edge + Node).
 * Tokens from `jsonwebtoken` in `@/lib/auth` remain valid with the same secret.
 */
import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

/**
 * Dev/test only — matches `@/lib/auth` local fallback so admin + marketplace cookies verify locally.
 * Never used when `NODE_ENV === "production"`.
 */
const DEV_LOCAL_JWT_SECRET_FALLBACK = "fallback-secret";

export class AdminJwtSecretNotConfiguredError extends Error {
  readonly code = "ADMIN_JWT_SECRET_NOT_CONFIGURED";

  constructor() {
    super("JWT_SECRET environment variable is required when NODE_ENV is production");
    this.name = "AdminJwtSecretNotConfiguredError";
  }
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Resolve HS256 secret for admin session JWTs (fail-closed in production). */
export function resolveAdminJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (isProductionRuntime()) {
    throw new AdminJwtSecretNotConfiguredError();
  }
  return DEV_LOCAL_JWT_SECRET_FALLBACK;
}

function jwtSecretKey(): Uint8Array {
  return encoder.encode(resolveAdminJwtSecret());
}

export type NpcAdminJwtPayload = {
  userId?: unknown;
  isAdmin?: unknown;
  username?: unknown;
};

export async function verifyNpcAdminJwt(token: string): Promise<NpcAdminJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey(), { algorithms: ["HS256"] });
    return payload as NpcAdminJwtPayload;
  } catch (e) {
    if (e instanceof AdminJwtSecretNotConfiguredError) throw e;
    return null;
  }
}

export function npcJwtPayloadIsAdmin(decoded: NpcAdminJwtPayload | null): boolean {
  if (!decoded) return false;
  return decoded.isAdmin === true || decoded.isAdmin === 1;
}

export async function signNpcAdminSessionTokens(params: {
  userId: number;
  username: string;
}): Promise<{ adminToken: string; userToken: string }> {
  const key = jwtSecretKey();
  const { userId, username } = params;
  const adminToken = await new SignJWT({ userId, isAdmin: true, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
  const userToken = await new SignJWT({ userId, username, isAdmin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
  return { adminToken, userToken };
}
