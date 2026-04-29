/**
 * Signed OAuth state (userId, clientId, platform) for CSRF protection.
 */
import jwt from "jsonwebtoken";

const SECRET = process.env.SOCIAL_OAUTH_STATE_SECRET || process.env.JWT_SECRET || "fallback-secret";

export type OAuthStatePayload = {
  userId: string;
  clientId: string;
  platform: string;
  /** Relative path to redirect after success (sanitized at issue time). */
  returnTo?: string;
};

export function createOAuthState(payload: OAuthStatePayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "10m" });
}

export function verifyOAuthState(token: string): OAuthStatePayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as OAuthStatePayload;
    return decoded;
  } catch {
    return null;
  }
}
