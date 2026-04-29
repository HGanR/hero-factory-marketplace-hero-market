import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { RequiredRecordsPayload } from "@/lib/site-builder/domain-connection-shared";
import type { DomainConnectionStatus, DomainProvider, DomainType } from "@/lib/site-builder/domain-connection-shared";
import { mysqlRows } from "@/lib/site-builder/db";

export type SiteDomainConnectionsDb = Awaited<ReturnType<typeof getDb>>;

export type SiteDomainConnectionRow = {
  id: string;
  siteId: string;
  clientId: string | null;
  ownerUserId: number;
  domain: string;
  domainType: DomainType;
  provider: DomainProvider;
  targetUrl: string;
  vercelProjectId: string | null;
  vercelDeploymentUrl: string | null;
  status: DomainConnectionStatus;
  verificationMethod: string | null;
  requiredRecordsJson: string | null;
  lastCheckedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function rowFromRaw(r: Record<string, unknown>): SiteDomainConnectionRow {
  return {
    id: String(r.id),
    siteId: String(r.siteId),
    clientId: r.clientId != null ? String(r.clientId) : null,
    ownerUserId: Number(r.ownerUserId),
    domain: String(r.domain),
    domainType: r.domainType as DomainType,
    provider: r.provider as DomainProvider,
    targetUrl: String(r.targetUrl),
    vercelProjectId: r.vercelProjectId != null ? String(r.vercelProjectId) : null,
    vercelDeploymentUrl: r.vercelDeploymentUrl != null ? String(r.vercelDeploymentUrl) : null,
    status: r.status as DomainConnectionStatus,
    verificationMethod: r.verificationMethod != null ? String(r.verificationMethod) : null,
    requiredRecordsJson: r.requiredRecordsJson != null ? String(r.requiredRecordsJson) : null,
    lastCheckedAt: r.lastCheckedAt as Date | string | null,
    createdAt: r.createdAt as Date | string,
    updatedAt: r.updatedAt as Date | string,
  };
}

export async function getSiteDomainConnectionForOwner(
  db: SiteDomainConnectionsDb,
  userId: number,
  siteId: string,
): Promise<SiteDomainConnectionRow | null> {
  const raw = await db.execute(sql`
    SELECT *
    FROM site_domain_connections
    WHERE siteId = ${siteId} AND ownerUserId = ${userId}
    LIMIT 1
  `);
  const rows = mysqlRows(raw);
  const r = rows[0];
  return r ? rowFromRaw(r) : null;
}

export async function listSiteDomainConnectionsForSiteIds(
  db: SiteDomainConnectionsDb,
  userId: number,
  siteIds: string[],
): Promise<SiteDomainConnectionRow[]> {
  if (siteIds.length === 0) return [];
  const raw = await db.execute(sql`
    SELECT *
    FROM site_domain_connections
    WHERE ownerUserId = ${userId} AND siteId IN (${sql.join(
      siteIds.map((id) => sql`${id}`),
      sql`, `,
    )})
  `);
  return mysqlRows(raw).map(rowFromRaw);
}

export type UpsertSiteDomainConnectionInput = {
  siteId: string;
  clientId: string | null;
  ownerUserId: number;
  domain: string;
  domainType: DomainType;
  provider: DomainProvider;
  targetUrl: string;
  vercelProjectId: string | null;
  vercelDeploymentUrl: string | null;
  status: DomainConnectionStatus;
  verificationMethod: string | null;
  requiredRecords: RequiredRecordsPayload | null;
  lastCheckedAt: Date | null;
};

export async function upsertSiteDomainConnection(
  db: SiteDomainConnectionsDb,
  input: UpsertSiteDomainConnectionInput,
): Promise<SiteDomainConnectionRow> {
  const existing = await getSiteDomainConnectionForOwner(db, input.ownerUserId, input.siteId);
  const id = existing?.id ?? randomUUID();
  const reqJson = input.requiredRecords ? JSON.stringify(input.requiredRecords) : null;
  const lastChecked =
    input.lastCheckedAt != null
      ? input.lastCheckedAt.toISOString().slice(0, 19).replace("T", " ")
      : null;

  if (existing) {
    await db.execute(sql`
      UPDATE site_domain_connections SET
        clientId = ${input.clientId},
        domain = ${input.domain},
        domainType = ${input.domainType},
        provider = ${input.provider},
        targetUrl = ${input.targetUrl},
        vercelProjectId = ${input.vercelProjectId},
        vercelDeploymentUrl = ${input.vercelDeploymentUrl},
        status = ${input.status},
        verificationMethod = ${input.verificationMethod},
        requiredRecordsJson = ${reqJson},
        lastCheckedAt = ${lastChecked}
      WHERE siteId = ${input.siteId} AND ownerUserId = ${input.ownerUserId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO site_domain_connections (
        id, siteId, clientId, ownerUserId, domain, domainType, provider, targetUrl,
        vercelProjectId, vercelDeploymentUrl, status, verificationMethod, requiredRecordsJson, lastCheckedAt
      ) VALUES (
        ${id},
        ${input.siteId},
        ${input.clientId},
        ${input.ownerUserId},
        ${input.domain},
        ${input.domainType},
        ${input.provider},
        ${input.targetUrl},
        ${input.vercelProjectId},
        ${input.vercelDeploymentUrl},
        ${input.status},
        ${input.verificationMethod},
        ${reqJson},
        ${lastChecked}
      )
    `);
  }

  const row = await getSiteDomainConnectionForOwner(db, input.ownerUserId, input.siteId);
  if (!row) throw new Error("upsert site_domain_connections failed");
  return row;
}

export async function updateSiteDomainConnectionStatus(
  db: SiteDomainConnectionsDb,
  userId: number,
  siteId: string,
  patch: {
    status: DomainConnectionStatus;
    verificationMethod?: string | null;
    lastCheckedAt?: Date | null;
  },
): Promise<SiteDomainConnectionRow | null> {
  const cur = await getSiteDomainConnectionForOwner(db, userId, siteId);
  if (!cur) return null;
  const nextMethod = patch.verificationMethod !== undefined ? patch.verificationMethod : cur.verificationMethod;
  if (patch.lastCheckedAt !== undefined) {
    const lastChecked = patch.lastCheckedAt
      ? patch.lastCheckedAt.toISOString().slice(0, 19).replace("T", " ")
      : null;
    await db.execute(sql`
      UPDATE site_domain_connections
      SET
        status = ${patch.status},
        verificationMethod = ${nextMethod},
        lastCheckedAt = ${lastChecked}
      WHERE siteId = ${siteId} AND ownerUserId = ${userId}
    `);
  } else {
    await db.execute(sql`
      UPDATE site_domain_connections
      SET
        status = ${patch.status},
        verificationMethod = ${nextMethod}
      WHERE siteId = ${siteId} AND ownerUserId = ${userId}
    `);
  }

  return getSiteDomainConnectionForOwner(db, userId, siteId);
}

/** Enforce: if site has clientId, it must match row (use site’s client when persisting). */
export function assertClientMatchesSite(siteClientId: string | null | undefined, rowClientId: string | null): boolean {
  const s = siteClientId?.trim() || null;
  if (!s) return true;
  if (!rowClientId) return false;
  return s === rowClientId;
}
