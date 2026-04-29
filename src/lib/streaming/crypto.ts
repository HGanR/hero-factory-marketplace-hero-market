import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/** True when env is set (non-empty); does not validate key length (that happens on encrypt/decrypt). */
export function isStreamDestinationEncryptionConfigured(): boolean {
  return Boolean(process.env.STREAM_DESTINATION_ENCRYPTION_KEY?.trim());
}

function loadKey(): Buffer {
  const raw = process.env.STREAM_DESTINATION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("STREAM_DESTINATION_ENCRYPTION_KEY is not set");
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "STREAM_DESTINATION_ENCRYPTION_KEY must decode to 32 bytes (use base64 or 64-char hex)"
    );
  }
  return key;
}

/** Encrypt stream key for DB storage (AES-256-GCM). */
export function encryptStreamKey(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt stream key from DB blob. */
export function decryptStreamKey(blob: string): string {
  const key = loadKey();
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted stream key payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}

export function streamKeyLast4(key: string): string {
  const t = key.trim();
  if (t.length <= 4) return t;
  return t.slice(-4);
}
