import crypto from "crypto";

export function hashMinutesRecord(payload: unknown): string {
  const json = JSON.stringify(payload, Object.keys(payload as any).sort());
  return crypto.createHash("sha256").update(json).digest("hex");
}
