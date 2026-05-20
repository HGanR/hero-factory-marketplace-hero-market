import "server-only";

import type { NextRequest } from "next/server";
import { and, eq, isNull, or, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { claudeWorkerApiKeys } from "@/lib/db/schema";
import { hashClaudeWorkerApiKey, validateClaudeWorkerBearerFormat } from "@/lib/workers/claude-worker-key-generate";
import {
  CLAUDE_WORKER_HANDOFF_SCOPE,
  parseClaudeWorkerScopesJson,
  scopesIncludeHandoffSubmit,
} from "@/lib/workers/claude-worker-scopes";

export type ClaudeWorkerAuthContext = {
  apiKeyId: string;
  ownerAdminUserId: number;
  keyPrefix: string;
  scopes: string[];
};

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Validates `hf_cwd_*` worker keys for Claude fulfillment handoff routes.
 * Rejects admin JWT, developer `hf_live_*` keys, and inactive/revoked rows.
 */
export async function authenticateClaudeWorkerRequest(
  req: NextRequest,
  requiredScope: string = CLAUDE_WORKER_HANDOFF_SCOPE
): Promise<ClaudeWorkerAuthContext | null> {
  const format = validateClaudeWorkerBearerFormat(extractBearerToken(req));
  if (!format.ok) return null;

  const db = await getDb();
  const hash = hashClaudeWorkerApiKey(format.token);
  const now = new Date();

  const [row] = await db
    .select()
    .from(claudeWorkerApiKeys)
    .where(
      and(
        eq(claudeWorkerApiKeys.keyHash, hash),
        eq(claudeWorkerApiKeys.isActive, true),
        isNull(claudeWorkerApiKeys.revokedAt),
        or(isNull(claudeWorkerApiKeys.expiresAt), gt(claudeWorkerApiKeys.expiresAt, now))
      )
    )
    .limit(1);

  if (!row) return null;

  const scopes = parseClaudeWorkerScopesJson(row.scopesJson);
  if (requiredScope && !scopes.includes(requiredScope)) return null;
  if (!scopesIncludeHandoffSubmit(scopes)) return null;

  await db
    .update(claudeWorkerApiKeys)
    .set({ lastUsedAt: now })
    .where(eq(claudeWorkerApiKeys.id, row.id));

  return {
    apiKeyId: row.id,
    ownerAdminUserId: row.ownerAdminUserId,
    keyPrefix: row.keyPrefix,
    scopes,
  };
}
