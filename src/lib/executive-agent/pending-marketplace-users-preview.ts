import "server-only";

import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { marketplaceUsers } from "@/lib/db/schema";
import {
  mapPendingMarketplaceUserRowFull,
  mapPendingMarketplaceUserRowSafe,
  type PendingMarketplaceUserFullRow,
  type PendingMarketplaceUserSafeRow,
} from "@/lib/executive-agent/pending-marketplace-users-preview-masking";

export type {
  PendingMarketplaceUserFullRow,
  PendingMarketplaceUserSafeRow,
} from "@/lib/executive-agent/pending-marketplace-users-preview-masking";

export type PendingMarketplaceUsersPreviewContext = {
  db: MySql2Database<typeof schema>;
};

export type PendingMarketplaceUsersPreviewOptions = {
  includeFullPii?: boolean;
};

export async function fetchPendingMarketplaceUsersPreview(
  ctx: PendingMarketplaceUsersPreviewContext,
  limit = 30,
  options: PendingMarketplaceUsersPreviewOptions = {},
): Promise<Array<PendingMarketplaceUserFullRow | PendingMarketplaceUserSafeRow>> {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const rows = await ctx.db
    .select({
      id: marketplaceUsers.id,
      email: marketplaceUsers.email,
      username: marketplaceUsers.username,
      createdAt: marketplaceUsers.createdAt,
    })
    .from(marketplaceUsers)
    .where(eq(marketplaceUsers.isApproved, false))
    .orderBy(desc(marketplaceUsers.createdAt))
    .limit(cap);

  if (options.includeFullPii) {
    return rows.map((row) => mapPendingMarketplaceUserRowFull(row));
  }

  return rows.map((row, index) => mapPendingMarketplaceUserRowSafe(row, index + 1));
}
