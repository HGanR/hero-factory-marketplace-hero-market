import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { marketplaceUsers } from "@/lib/db/schema";

type Db = MySql2Database<typeof schema>;

export type ApprovedUserActivityRow = {
  userId: number;
  userLabel: string;
  lastLogin: string | null;
  isActive: boolean;
  eventsInWindow: number;
  lastEventPath: string | null;
  lastEventAt: string | null;
};

export type ApprovedUserActivityRollup = {
  windowStart: string;
  windowEnd: string;
  approvedActiveTotal: number;
  loginsInWindow: number;
  usersWithTrackedEvents: number;
  recentlyActive: ApprovedUserActivityRow[];
  unavailable: boolean;
  reason?: string;
};

function maskUsername(username: string): string {
  const t = username.trim();
  if (t.length <= 2) return "User …";
  return `${t.slice(0, 1)}…${t.slice(-1)}`;
}

export async function rollupApprovedUserActivity(
  db: Db,
  opts: { since: Date; until?: Date; limit?: number },
): Promise<ApprovedUserActivityRollup> {
  const until = opts.until ?? new Date();
  const since = opts.since;
  const limit = Math.min(Math.max(opts.limit ?? 16, 1), 40);

  try {
    const [activeRow] = await db
      .select({ n: sql<number>`count(*)` })
      .from(marketplaceUsers)
      .where(and(eq(marketplaceUsers.isApproved, true), eq(marketplaceUsers.isActive, true)));

    const [loginRow] = await db
      .select({ n: sql<number>`count(*)` })
      .from(marketplaceUsers)
      .where(
        and(
          eq(marketplaceUsers.isApproved, true),
          sql`${marketplaceUsers.lastLogin} IS NOT NULL`,
          gte(marketplaceUsers.lastLogin, since),
          sql`${marketplaceUsers.lastLogin} <= ${until}`,
        ),
      );

    const recentLogins = await db
      .select({
        id: marketplaceUsers.id,
        username: marketplaceUsers.username,
        lastLogin: marketplaceUsers.lastLogin,
        isActive: marketplaceUsers.isActive,
      })
      .from(marketplaceUsers)
      .where(
        and(
          eq(marketplaceUsers.isApproved, true),
          sql`${marketplaceUsers.lastLogin} IS NOT NULL`,
          gte(marketplaceUsers.lastLogin, since),
        ),
      )
      .orderBy(desc(marketplaceUsers.lastLogin))
      .limit(limit);

    const eventAgg = await db.execute<{ uid: string; events: number }>(sql`
      SELECT JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.marketplaceUserId')) AS uid,
        COUNT(*) AS events
      FROM site_analytics_events
      WHERE createdAt >= ${since} AND createdAt <= ${until}
        AND JSON_EXTRACT(metadataJson, '$.marketplaceUserId') IS NOT NULL
      GROUP BY uid
      ORDER BY events DESC
      LIMIT ${limit}
    `);
    const eventRows = eventAgg as unknown as { uid: string; events: number }[];
    const eventsByUser = new Map<number, number>();
    for (const r of eventRows) {
      const id = parseInt(String(r.uid), 10);
      if (Number.isFinite(id)) eventsByUser.set(id, Number(r.events ?? 0));
    }

    const userIdsFromEvents = [...eventsByUser.keys()];
    const usersById = new Map<number, (typeof recentLogins)[0]>();
    for (const u of recentLogins) usersById.set(u.id, u);

    if (userIdsFromEvents.length > 0) {
      const missing = userIdsFromEvents.filter((id) => !usersById.has(id));
      if (missing.length > 0) {
        const extra = await db
          .select({
            id: marketplaceUsers.id,
            username: marketplaceUsers.username,
            lastLogin: marketplaceUsers.lastLogin,
            isActive: marketplaceUsers.isActive,
          })
          .from(marketplaceUsers)
          .where(and(eq(marketplaceUsers.isApproved, true), inArray(marketplaceUsers.id, missing)));
        for (const u of extra) usersById.set(u.id, u);
      }
    }

    const lastEventByUser = new Map<number, { path: string; at: Date }>();
    if (userIdsFromEvents.length > 0) {
      for (const uid of userIdsFromEvents.slice(0, limit)) {
        const lastRows = await db.execute<{ path: string; createdAt: string }>(sql`
          SELECT path, createdAt
          FROM site_analytics_events
          WHERE createdAt >= ${since} AND createdAt <= ${until}
            AND JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.marketplaceUserId')) = ${String(uid)}
          ORDER BY createdAt DESC
          LIMIT 1
        `);
        const row = (lastRows as unknown as { path: string; createdAt: string }[])[0];
        if (row) {
          lastEventByUser.set(uid, {
            path: row.path,
            at: new Date(row.createdAt),
          });
        }
      }
    }

    const mergedIds = new Set<number>([
      ...recentLogins.map((u) => u.id),
      ...userIdsFromEvents,
    ]);

    const recentlyActive: ApprovedUserActivityRow[] = [...mergedIds]
      .map((id) => {
        const u = usersById.get(id);
        if (!u) return null;
        const lastEv = lastEventByUser.get(id);
        return {
          userId: id,
          userLabel: maskUsername(u.username),
          lastLogin: u.lastLogin ? new Date(u.lastLogin as unknown as string).toISOString() : null,
          isActive: u.isActive,
          eventsInWindow: eventsByUser.get(id) ?? 0,
          lastEventPath: lastEv?.path ?? null,
          lastEventAt: lastEv ? lastEv.at.toISOString() : null,
        };
      })
      .filter((r): r is ApprovedUserActivityRow => r != null)
      .sort((a, b) => {
        const aScore = (a.eventsInWindow > 0 ? 1000 : 0) + (a.lastLogin ? Date.parse(a.lastLogin) : 0);
        const bScore = (b.eventsInWindow > 0 ? 1000 : 0) + (b.lastLogin ? Date.parse(b.lastLogin) : 0);
        return bScore - aScore;
      })
      .slice(0, limit);

    return {
      windowStart: since.toISOString(),
      windowEnd: until.toISOString(),
      approvedActiveTotal: Number(activeRow?.n ?? 0),
      loginsInWindow: Number(loginRow?.n ?? 0),
      usersWithTrackedEvents: eventsByUser.size,
      recentlyActive,
      unavailable: false,
    };
  } catch {
    return {
      windowStart: since.toISOString(),
      windowEnd: until.toISOString(),
      approvedActiveTotal: 0,
      loginsInWindow: 0,
      usersWithTrackedEvents: 0,
      recentlyActive: [],
      unavailable: true,
      reason: "approved_user_activity_query_failed",
    };
  }
}
