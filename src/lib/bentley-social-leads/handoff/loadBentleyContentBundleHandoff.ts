/**
 * Server-only: load a persisted handoff by id with ownership check (userId).
 */

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { bentleyContentBundleHandoffs } from "@/lib/db/schema.bentley-social-leads";
import type { BentleyContentBundleHandoff } from "./contentBundleHandoffTypes";
import { isBentleyContentBundleHandoffPayload } from "./validateContentBundleHandoffPayload";

export async function loadBentleyContentBundleHandoff(args: {
  userId: number;
  handoffId: string;
}): Promise<BentleyContentBundleHandoff | null> {
  const id = args.handoffId.trim();
  if (!id) return null;

  const db = await getDb();
  const [row] = await db
    .select({ payloadJson: bentleyContentBundleHandoffs.payloadJson })
    .from(bentleyContentBundleHandoffs)
    .where(and(eq(bentleyContentBundleHandoffs.id, id), eq(bentleyContentBundleHandoffs.userId, args.userId)))
    .limit(1);

  if (!row?.payloadJson) return null;
  const payload = row.payloadJson as unknown;
  if (!isBentleyContentBundleHandoffPayload(payload)) return null;
  return payload;
}
