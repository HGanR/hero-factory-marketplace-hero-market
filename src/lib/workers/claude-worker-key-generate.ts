import crypto from "crypto";
import { CLAUDE_WORKER_DEFAULT_SCOPES, serializeClaudeWorkerScopes } from "@/lib/workers/claude-worker-scopes";

/** Claude Worker Desk keys — never `hf_live_` (developer platform) or JWT. */
export const CLAUDE_WORKER_KEY_PREFIX = "hf_cwd_";

const KEY_BYTES = 24;

export type ClaudeWorkerKeyMaterial = {
  raw: string;
  prefix: string;
  hash: string;
  scopesJson: string;
};

export function hashClaudeWorkerApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateClaudeWorkerApiKey(): ClaudeWorkerKeyMaterial {
  const raw =
    CLAUDE_WORKER_KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString("base64url").slice(0, 32);
  const prefix = raw.slice(0, 16) + "…";
  return {
    raw,
    prefix,
    hash: hashClaudeWorkerApiKey(raw),
    scopesJson: serializeClaudeWorkerScopes(CLAUDE_WORKER_DEFAULT_SCOPES),
  };
}

export type ClaudeWorkerBearerFormatError =
  | "missing"
  | "jwt_like"
  | "developer_key"
  | "wrong_prefix"
  | "too_short";

export function validateClaudeWorkerBearerFormat(
  bearer: string | null | undefined
): { ok: true; token: string } | { ok: false; code: ClaudeWorkerBearerFormatError } {
  const token = bearer?.trim() ?? "";
  if (!token) return { ok: false, code: "missing" };
  if (token.startsWith("eyJ")) return { ok: false, code: "jwt_like" };
  if (token.startsWith("hf_live_")) return { ok: false, code: "developer_key" };
  if (!token.startsWith(CLAUDE_WORKER_KEY_PREFIX)) return { ok: false, code: "wrong_prefix" };
  if (token.length < CLAUDE_WORKER_KEY_PREFIX.length + 32) return { ok: false, code: "too_short" };
  return { ok: true, token };
}
