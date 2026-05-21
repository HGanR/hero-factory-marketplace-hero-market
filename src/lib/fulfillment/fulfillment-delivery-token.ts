import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const PREFIX = "hfd_";

export function generateRawDeliveryToken(): string {
  return `${PREFIX}${randomBytes(TOKEN_BYTES).toString("hex")}`;
}

export function hashDeliveryToken(raw: string): string {
  return createHash("sha256").update(raw.trim(), "utf8").digest("hex");
}

export function deliveryTokenPrefix(raw: string): string {
  const t = raw.trim();
  return t.length <= 16 ? t : `${t.slice(0, 12)}…`;
}

export function isDeliveryTokenFormat(raw: string): boolean {
  return /^hfd_[a-f0-9]{64}$/i.test(raw.trim());
}
