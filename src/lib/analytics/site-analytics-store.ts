import "server-only";

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { siteAnalyticsEvents } from "@/lib/db/schema";

type Db = MySql2Database<typeof schema>;

export type SiteEventInsert = {
  id: string;
  sessionId: string;
  visitorId: string;
  path: string;
  eventType: (typeof schema.siteAnalyticsEvents.$inferInsert)["eventType"];
  source: string;
  medium: string;
  campaign: string;
  referrer: string | null;
  userAgent: string | null;
  metadataJson: string | null;
};

export async function insertSiteAnalyticsEvent(db: Db, row: SiteEventInsert) {
  await db.insert(siteAnalyticsEvents).values({
    id: row.id,
    sessionId: row.sessionId.slice(0, 64),
    visitorId: row.visitorId.slice(0, 64),
    path: row.path.slice(0, 512),
    eventType: row.eventType,
    source: row.source.slice(0, 64),
    medium: row.medium.slice(0, 64),
    campaign: row.campaign.slice(0, 128),
    referrer: row.referrer,
    userAgent: row.userAgent,
    metadataJson: row.metadataJson,
  });
}

export type LandingCtaRow = {
  eventName: string;
  label: string;
  targetHref: string | null;
  clicks: number;
};

export type SiteAnalyticsDailyPoint = {
  date: string;
  visitors: number;
  pageViews: number;
  conversions: number;
};

export type SiteAnalyticsRollup = {
  windowStart: string;
  windowEnd: string;
  landingPath: string;
  /** Distinct visitors with ≥1 landing `page_view` in window. */
  landingPageVisitors: number;
  joinCommunityClicks: number;
  outboundPayPalClicks: number;
  pageViewsOnLanding: number;
  trafficBySource: Array<{
    source: string;
    visitors: number;
    share: number;
    joinCommunityClicks: number;
    outboundPayPalClicks: number;
    potentialRevenue: number | null;
  }>;
  topPaths: Array<{ path: string; visitors: number }>;
  /** Landing home CTA / link clicks grouped by stable eventName metadata. */
  landingCtas: LandingCtaRow[];
  /** Daily buckets for executive trend sparklines (UTC dates). */
  dailyTrend: SiteAnalyticsDailyPoint[];
  /** Share of sessions with only one page view — bounce proxy when session data exists. */
  singlePageVisitRate: number | null;
};

function communityPriceForRevenue(): number | null {
  const env = process.env.NEXT_PUBLIC_COMMUNITY_PRICE;
  if (env == null) return 155;
  const raw = env.trim();
  if (raw === "" || raw === "0" || raw.toLowerCase() === "off") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function rollupSiteAnalyticsForExecutive(
  db: Db,
  opts: { landingPath?: string; since: Date; until?: Date },
): Promise<SiteAnalyticsRollup | null> {
  const landingPath = (opts.landingPath ?? "/").trim() || "/";
  const until = opts.until ?? new Date();
  const since = opts.since;
  try {
    const [pvLanding] = await db
      .select({ n: count() })
      .from(siteAnalyticsEvents)
      .where(
        and(
          eq(siteAnalyticsEvents.eventType, "page_view"),
          eq(siteAnalyticsEvents.path, landingPath),
          gte(siteAnalyticsEvents.createdAt, since),
          sql`${siteAnalyticsEvents.createdAt} <= ${until}`,
        ),
      );

    const visLandRows = (await db.execute(sql`
      SELECT COUNT(DISTINCT visitorId) AS c
      FROM site_analytics_events
      WHERE eventType = 'page_view'
        AND path = ${landingPath}
        AND createdAt >= ${since}
        AND createdAt <= ${until}
    `)) as unknown as { c: number }[];
    const landingVisitors = Number(visLandRows[0]?.c ?? 0);

    const [joinRows] = await db
      .select({ n: count() })
      .from(siteAnalyticsEvents)
      .where(
        and(
          inArray(siteAnalyticsEvents.eventType, ["button_click", "conversion_intent"]),
          gte(siteAnalyticsEvents.createdAt, since),
          sql`${siteAnalyticsEvents.createdAt} <= ${until}`,
          sql`(JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.button')) IN ('join_community','join community')
               OR JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.action')) IN ('join_community','join_community_click'))`,
        ),
      );

    const [paypalRows] = await db
      .select({ n: count() })
      .from(siteAnalyticsEvents)
      .where(
        and(
          eq(siteAnalyticsEvents.eventType, "outbound_paypal"),
          gte(siteAnalyticsEvents.createdAt, since),
          sql`${siteAnalyticsEvents.createdAt} <= ${until}`,
        ),
      );

    const price = communityPriceForRevenue();
    const joinClicks = Number(joinRows?.n ?? 0);
    const paypalClicks = Number(paypalRows?.n ?? 0);

    const sourceAgg = await db.execute<{ source: string; visitors: number; jc: number; pc: number }>(sql`
      SELECT LOWER(TRIM(source)) AS source,
        COUNT(DISTINCT CASE WHEN eventType = 'page_view' THEN visitorId END) AS visitors,
        SUM(CASE WHEN eventType IN ('button_click','conversion_intent')
              AND (JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.button')) IN ('join_community','join community')
                   OR JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.action')) IN ('join_community','join_community_click'))
            THEN 1 ELSE 0 END) AS jc,
        SUM(CASE WHEN eventType = 'outbound_paypal' THEN 1 ELSE 0 END) AS pc
      FROM site_analytics_events
      WHERE createdAt >= ${since} AND createdAt <= ${until}
      GROUP BY LOWER(TRIM(source))
      ORDER BY visitors DESC
      LIMIT 24
    `);

    const rows = sourceAgg as unknown as { source: string; visitors: number; jc: number; pc: number }[];
    const totalVisitors = rows.reduce((s, r) => s + Number(r.visitors ?? 0), 0) || 1;

    const trafficBySource = rows.map((r) => {
      const v = Number(r.visitors ?? 0);
      const jc = Number(r.jc ?? 0);
      const pc = Number(r.pc ?? 0);
      return {
        source: r.source || "unknown",
        visitors: v,
        share: v / totalVisitors,
        joinCommunityClicks: jc,
        outboundPayPalClicks: pc,
        potentialRevenue: price == null ? null : pc * price,
      };
    });

    const topPathsRows = await db.execute<{ path: string; visitors: number }>(sql`
      SELECT path, COUNT(DISTINCT visitorId) AS visitors
      FROM site_analytics_events
      WHERE eventType = 'page_view' AND createdAt >= ${since} AND createdAt <= ${until}
      GROUP BY path
      ORDER BY visitors DESC
      LIMIT 12
    `);
    const topPaths = (topPathsRows as unknown as { path: string; visitors: number }[]).map((r) => ({
      path: r.path,
      visitors: Number(r.visitors ?? 0),
    }));

    const ctaRows = await db.execute<{ eventName: string; label: string; targetHref: string | null; clicks: number }>(sql`
      SELECT
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.eventName')), ''), 'unknown') AS eventName,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.label')), ''), 'Link') AS label,
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.targetHref')), '') AS targetHref,
        COUNT(*) AS clicks
      FROM site_analytics_events
      WHERE createdAt >= ${since} AND createdAt <= ${until}
        AND eventType IN ('button_click', 'conversion_intent', 'outbound_paypal', 'agent_interaction')
        AND metadataJson IS NOT NULL
      GROUP BY eventName, label, targetHref
      ORDER BY clicks DESC
      LIMIT 24
    `);
    const landingCtas = (ctaRows as unknown as { eventName: string; label: string; targetHref: string | null; clicks: number }[]).map(
      (r) => ({
        eventName: r.eventName || "unknown",
        label: r.label || "Link",
        targetHref: r.targetHref?.trim() ? r.targetHref.trim() : null,
        clicks: Number(r.clicks ?? 0),
      }),
    );

    const dailyRows = await db.execute<{ day: string; visitors: number; pageViews: number; conversions: number }>(sql`
      SELECT DATE(createdAt) AS day,
        COUNT(DISTINCT CASE WHEN eventType = 'page_view' THEN visitorId END) AS visitors,
        SUM(CASE WHEN eventType = 'page_view' THEN 1 ELSE 0 END) AS pageViews,
        SUM(CASE WHEN eventType IN ('button_click','conversion_intent')
              AND (JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.button')) IN ('join_community','join community')
                   OR JSON_UNQUOTE(JSON_EXTRACT(metadataJson, '$.action')) IN ('join_community','join_community_click'))
            THEN 1 ELSE 0 END) AS conversions
      FROM site_analytics_events
      WHERE createdAt >= ${since} AND createdAt <= ${until}
      GROUP BY DATE(createdAt)
      ORDER BY day ASC
      LIMIT 14
    `);
    const dailyTrend = (dailyRows as unknown as { day: string; visitors: number; pageViews: number; conversions: number }[]).map(
      (r) => ({
        date: String(r.day),
        visitors: Number(r.visitors ?? 0),
        pageViews: Number(r.pageViews ?? 0),
        conversions: Number(r.conversions ?? 0),
      }),
    );

    const bounceRows = await db.execute<{ singlePage: number; total: number }>(sql`
      SELECT
        SUM(CASE WHEN pv_count = 1 THEN 1 ELSE 0 END) AS singlePage,
        COUNT(*) AS total
      FROM (
        SELECT sessionId, COUNT(*) AS pv_count
        FROM site_analytics_events
        WHERE eventType = 'page_view'
          AND createdAt >= ${since}
          AND createdAt <= ${until}
        GROUP BY sessionId
      ) AS session_counts
    `);
    const singlePage = Number((bounceRows as unknown as { singlePage: number; total: number }[])[0]?.singlePage ?? 0);
    const sessionTotal = Number((bounceRows as unknown as { singlePage: number; total: number }[])[0]?.total ?? 0);
    const singlePageVisitRate =
      sessionTotal > 0 ? Math.min(1, Math.max(0, singlePage / sessionTotal)) : null;

    return {
      windowStart: since.toISOString(),
      windowEnd: until.toISOString(),
      landingPath,
      landingPageVisitors: landingVisitors,
      joinCommunityClicks: joinClicks,
      outboundPayPalClicks: paypalClicks,
      pageViewsOnLanding: Number(pvLanding?.n ?? 0),
      trafficBySource,
      topPaths,
      landingCtas,
      dailyTrend,
      singlePageVisitRate,
    };
  } catch {
    return null;
  }
}
