/**
 * HS256 JWT sign/verify for admin NPC cookies using `jose` (Edge + Node).
 * Tokens from `jsonwebtoken` in `@/lib/auth` remain valid with the same secret.
 */
import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function jwtSecretKey() {
  return encoder.encode(process.env.JWT_SECRET || "fallback-secret");
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
  } catch {
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
