/**
 * Token encryption at rest (AES-256-GCM).
 * Set SOCIAL_ENCRYPTION_KEY (32 bytes hex) for production. Without it, tokens are stored plain (dev only).
 */
import crypto from "crypto";

const KEY = process.env.SOCIAL_ENCRYPTION_KEY;
const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

function getKey(): Buffer | null {
  if (!KEY) return null;
  const buf = Buffer.from(KEY, "hex");
  if (buf.length !== 32) return null;
  return buf;
}

export function encryptToken(plain: string): string {
  const key = getKey();
  if (!key) return plain; // dev fallback: store plaintext
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  if (!key) return encrypted; // dev fallback
  const buf = Buffer.from(encrypted, "base64");
  if (buf.length < IV_LEN + TAG_LEN) return encrypted;
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final("utf8");
}
