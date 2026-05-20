import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { claudeWorkerApiKeys } from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { generateClaudeWorkerApiKey } from "@/lib/workers/claude-worker-key-generate";
import { CLAUDE_WORKER_DEFAULT_SCOPES } from "@/lib/workers/claude-worker-scopes";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/worker-keys
 * List Claude worker desk keys for the signed-in executive admin (no secrets).
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const keys = await db
    .select({
      id: claudeWorkerApiKeys.id,
      name: claudeWorkerApiKeys.name,
      keyPrefix: claudeWorkerApiKeys.keyPrefix,
      scopesJson: claudeWorkerApiKeys.scopesJson,
      isActive: claudeWorkerApiKeys.isActive,
      revokedAt: claudeWorkerApiKeys.revokedAt,
      expiresAt: claudeWorkerApiKeys.expiresAt,
      lastUsedAt: claudeWorkerApiKeys.lastUsedAt,
      createdAt: claudeWorkerApiKeys.createdAt,
    })
    .from(claudeWorkerApiKeys)
    .where(eq(claudeWorkerApiKeys.ownerAdminUserId, adminUserId))
    .orderBy(desc(claudeWorkerApiKeys.createdAt));

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId,
    prompt: null,
    toolName: "claude_worker_api_keys.list",
    actionType: "worker_keys_accessed",
    targetType: "platform",
    targetId: null,
    inputJson: JSON.stringify({ count: keys.length }),
    outputJson: null,
    approvalStatus: "not_required",
  });

  return NextResponse.json({
    ok: true,
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: CLAUDE_WORKER_DEFAULT_SCOPES,
      isActive: k.isActive,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/admin/executive-agent/worker-keys
 * Mint a Claude worker desk key (`hf_cwd_*`) for fulfillment handoff only.
 */
export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { raw, prefix, hash, scopesJson } = generateClaudeWorkerApiKey();
  const id = uuidv4();
  const db = await getDb();

  await db.insert(claudeWorkerApiKeys).values({
    id,
    ownerAdminUserId: adminUserId,
    createdByAdminUserId: adminUserId,
    name,
    keyPrefix: prefix,
    keyHash: hash,
    scopesJson,
    isActive: true,
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId,
    prompt: null,
    toolName: "claude_worker_api_keys.create",
    actionType: "worker_key_created",
    targetType: "claude_worker_api_key",
    targetId: id,
    inputJson: JSON.stringify({ name, keyPrefix: prefix, scopes: CLAUDE_WORKER_DEFAULT_SCOPES }),
    outputJson: null,
    approvalStatus: "not_required",
  });

  return NextResponse.json({
    ok: true,
    key: {
      id,
      name,
      rawKey: raw,
      keyPrefix: prefix,
      scopes: [...CLAUDE_WORKER_DEFAULT_SCOPES],
      ownerAdminUserId: adminUserId,
      createdAt: new Date().toISOString(),
    },
    warning: "Save this key now. You will not be able to see it again.",
  });
}
