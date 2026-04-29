/**
 * Aggregates real DB state for the personal Mission Path (per marketplace userId).
 * Client Hub / clientAccounts are intentionally not used for these flags.
 */
import { and, count, eq, inArray, isNotNull, notLike, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import {
  aiAgentSiteBindings,
  aiAgents,
  campaigns,
  crm_contacts,
  entityOnboardings,
  trusts,
  web3Sites,
} from "@/lib/db/schema";
import type { MissionPathPrerequisites } from "./mission-path-types";

export async function queryMissionPathPrerequisites(userId: number): Promise<MissionPathPrerequisites> {
  const db = await getDb();

  const [trustN] = await db
    .select({ c: count() })
    .from(trusts)
    .where(eq(trusts.userId, userId));
  const [onboardN] = await db
    .select({ c: count() })
    .from(entityOnboardings)
    .where(
      and(eq(entityOnboardings.userId, userId), eq(entityOnboardings.isRevoked, false)),
    );
  const hasEntity = Number(trustN?.c) > 0 || Number(onboardN?.c) > 0;

  const [siteN] = await db
    .select({ c: count() })
    .from(web3Sites)
    .where(eq(web3Sites.userId, userId));
  const hasWebsite = Number(siteN?.c) > 0;

  const agentRows = await db
    .select({ b: aiAgentSiteBindings.id })
    .from(aiAgentSiteBindings)
    .innerJoin(web3Sites, eq(web3Sites.id, aiAgentSiteBindings.siteId))
    .innerJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
    .where(
      and(
        eq(web3Sites.userId, userId),
        eq(aiAgents.userId, userId),
        eq(aiAgentSiteBindings.isActive, true),
      ),
    )
    .limit(1);
  const hasAgentOnSite = agentRows.length > 0;

  const [campN] = await db
    .select({ c: count() })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.userId, String(userId)),
        inArray(campaigns.status, ["LIVE", "COMPLETED"]),
      ),
    );
  const hasLaunchedCampaign = Number(campN?.c) > 0;

  await ensureCrmTables();
  // Real lead: non-null userId, not synthetic webchat+ email, optional isTest in customFields not true
  const [leadN] = await db
    .select({ c: count() })
    .from(crm_contacts)
    .where(
      and(
        isNotNull(crm_contacts.userId),
        eq(crm_contacts.userId, userId),
        isNotNull(crm_contacts.email),
        notLike(crm_contacts.email, "webchat+%"),
        or(
          sql`JSON_EXTRACT(${crm_contacts.customFields}, '$.isTest') IS NULL`,
          sql`JSON_EXTRACT(${crm_contacts.customFields}, '$.isTest') = false`,
          sql`JSON_EXTRACT(${crm_contacts.customFields}, '$.isTest') = 0`,
        ),
      ),
    );
  const hasFirstRealLead = Number(leadN?.c) > 0;

  return {
    hasEntity,
    hasWebsite,
    hasAgentOnSite,
    hasLaunchedCampaign,
    hasFirstRealLead,
  };
}
