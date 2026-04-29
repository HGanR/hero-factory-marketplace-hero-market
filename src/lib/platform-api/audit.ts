/**
 * Platform API Audit
 * Updates lastUsedAt on API keys; future: log to platform_api_audit table
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { developerApiKeys } from "@/lib/db/schema";

export async function recordApiKeyUsage(apiKeyId: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .update(developerApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(developerApiKeys.id, apiKeyId));
  } catch {
    // Don't fail request if audit fails
  }
}
