import crypto from "crypto";

/**
 * Verifies Content360 webhook signature when `CONTENT360_WEBHOOK_SECRET` is set.
 * Header name can be overridden via `CONTENT360_WEBHOOK_SIGNATURE_HEADER` (default `x-content360-signature`).
 */
export function getContent360WebhookSecret(): string | null {
  const s = process.env.CONTENT360_WEBHOOK_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

export function getContent360WebhookSignatureHeaderName(): string {
  const h = process.env.CONTENT360_WEBHOOK_SIGNATURE_HEADER?.trim();
  return h && h.length > 0 ? h.toLowerCase() : "x-content360-signature";
}

/**
 * @param signatureHeader raw header value (e.g. hex hmac or plain shared secret match — vendor TBD)
 */
export function verifyContent360WebhookSignature(signatureHeader: string | null, rawBody: string): boolean {
  const secret = getContent360WebhookSecret();
  if (!secret) return false;

  const sig = signatureHeader?.trim() ?? "";
  if (!sig) return false;

  // TODO(Content360): replace with vendor-documented HMAC algorithm / header format.
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
