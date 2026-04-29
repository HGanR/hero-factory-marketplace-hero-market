/**
 * Platform API Authentication
 * Supports: API key (Bearer), session (cookie)
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { developerApiKeys } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { resolveScopes, type Scope } from "./scopes";

export interface PlatformApiContext {
  userId: number;
  scopes: Scope[];
  authType: "api_key" | "session";
  apiKeyId?: string;
}

export async function getPlatformApiContext(req: NextRequest): Promise<PlatformApiContext | null> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (bearer) {
    const hash = crypto.createHash("sha256").update(bearer).digest("hex");
    const db = await getDb();
    const [key] = await db
      .select()
      .from(developerApiKeys)
      .where(eq(developerApiKeys.keyHash, hash))
      .limit(1);
    if (key) {
      const scopes = resolveScopes(key.scopes);
      return {
        userId: key.userId,
        scopes,
        authType: "api_key",
        apiKeyId: key.id,
      };
    }
  }

  const userId = await getAuthedUserId();
  if (userId) {
    return {
      userId,
      scopes: [
        "read:trusts",
        "write:trusts",
        "read:assets",
        "write:assets",
        "read:instruments",
        "write:instruments",
        "read:events",
        "read:workflows",
        "write:workflows",
        "read:accounting",
        "write:accounting",
        "read:worlds",
        "write:worlds",
        "read:apps",
        "write:apps",
        "read:commerce",
        "write:commerce",
      ],
      authType: "session",
    };
  }

  return null;
}
