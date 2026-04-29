/**
 * Developer API Keys
 * GET: List keys for current user
 * POST: Create new API key (returns raw key once)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { developerApiKeys } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

const KEY_PREFIX = "hf_live_";
const KEY_BYTES = 24; // 32 chars base64

function generateKey(): { raw: string; prefix: string; hash: string } {
  const raw = KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString("base64url").slice(0, 32);
  const prefix = raw.slice(0, 12) + "…";
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const keys = await db
    .select({
      id: developerApiKeys.id,
      name: developerApiKeys.name,
      keyPrefix: developerApiKeys.keyPrefix,
      lastUsedAt: developerApiKeys.lastUsedAt,
      createdAt: developerApiKeys.createdAt,
    })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.userId, userId))
    .orderBy(desc(developerApiKeys.createdAt));

  return NextResponse.json({
    ok: true,
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      lastUsedAt: k.lastUsedAt?.toISOString(),
      createdAt: k.createdAt?.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; scopes?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { raw, prefix, hash } = generateKey();
  const defaultScopes = ["read:trusts", "read:assets", "read:instruments", "read:events", "read:workflows"];
  const scopes = Array.isArray(body.scopes) && body.scopes.length > 0
    ? body.scopes.filter((s) => typeof s === "string")
    : defaultScopes;
  const id = uuidv4();

  const db = await getDb();
  await db.insert(developerApiKeys).values({
    id,
    userId,
    name,
    keyPrefix: prefix,
    keyHash: hash,
    scopes: JSON.stringify(scopes),
  });

  return NextResponse.json({
    ok: true,
    key: {
      id,
      name,
      rawKey: raw,
      keyPrefix: prefix,
      scopes,
      createdAt: new Date().toISOString(),
    },
    warning: "Save this key now. You will not be able to see it again.",
  });
}
