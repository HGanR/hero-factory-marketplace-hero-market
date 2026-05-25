import crypto from "crypto";

export type ExternalReviewAllowedRole = "editor" | "approver" | "owner";

export function generateExternalSocialReviewTokenRaw(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashExternalSocialReviewTokenRaw(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function timingSafeEqualTokenHash(raw: string, storedHash: string): boolean {
  const h = hashExternalSocialReviewTokenRaw(raw);
  if (h.length !== storedHash.length || h.length % 2 !== 0 || storedHash.length % 2 !== 0) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export function normalizeExternalReviewAllowedRoles(
  input?: ("editor" | "approver" | "owner")[] | null,
): ExternalReviewAllowedRole[] {
  if (!input?.length) return ["approver"];
  const out: ExternalReviewAllowedRole[] = [];
  for (const r of input) {
    if (r === "editor" || r === "approver" || r === "owner") out.push(r);
  }
  return out.length ? out : ["approver"];
}

export function parseExternalReviewAllowedRolesJson(json: unknown): ExternalReviewAllowedRole[] {
  if (json == null) return ["approver"];
  if (typeof json === "string") {
    const t = json.trim();
    if (!t) return ["approver"];
    try {
      return parseExternalReviewAllowedRolesJson(JSON.parse(t));
    } catch {
      return ["approver"];
    }
  }
  if (!Array.isArray(json)) return ["approver"];
  const out: ExternalReviewAllowedRole[] = [];
  for (const el of json) {
    if (el === "editor" || el === "approver" || el === "owner") out.push(el);
  }
  return out.length ? out : ["approver"];
}

export function allowedRolesJsonForInsert(roles: ExternalReviewAllowedRole[]): string {
  return JSON.stringify(roles);
}
