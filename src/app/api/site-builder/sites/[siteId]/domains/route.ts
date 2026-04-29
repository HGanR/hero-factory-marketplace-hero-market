import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { createOrUpdateDomainConnection } from "@/lib/site-builder/domain-connection-orchestrate";
import { mergeDomainConnectionIntoCurrentSiteVersion } from "@/lib/site-builder/domain-connection-schema-sync";
import {
  DeploymentTargetSchema,
  DomainProviderSchema,
  DomainTypeSchema,
} from "@/lib/site-builder/domain-connection-shared";
import {
  assertClientMatchesSite,
  getSiteDomainConnectionForOwner,
} from "@/lib/site-builder/site-domain-connections-repository";
import { ensureSiteBuilderTables, ensureSiteDomainConnectionsTable, getOwnedSite } from "@/lib/site-builder/db";

const PostBodySchema = z.object({
  domain: z.string().min(1).max(255),
  domainType: DomainTypeSchema,
  /** Registrar / path — we may still set provider to `vercel` if the Vercel API ran. */
  provider: DomainProviderSchema,
  deploymentTarget: DeploymentTargetSchema,
  targetUrl: z.string().min(1).max(2000),
});

export async function GET(_req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    await ensureSiteDomainConnectionsTable(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const row = await getSiteDomainConnectionForOwner(db, userId, siteId);
    return NextResponse.json({ connection: row, siteClientId: site.clientId ?? null });
  } catch (e) {
    console.error("domains GET", e);
    return NextResponse.json({ error: "Failed to load domain connection" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    await ensureSiteDomainConnectionsTable(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const siteClientId = site.clientId != null && String(site.clientId).trim() ? String(site.clientId).trim() : null;

    const { row, requiredPayload } = await createOrUpdateDomainConnection({
      db,
      ownerUserId: userId,
      siteId: site.id,
      siteClientId,
      domain: parsed.data.domain,
      domainType: parsed.data.domainType,
      providerHint: parsed.data.provider,
      deploymentTarget: parsed.data.deploymentTarget,
      targetUrlRaw: parsed.data.targetUrl,
    });

    if (siteClientId) {
      if (!assertClientMatchesSite(siteClientId, row.clientId)) {
        return NextResponse.json({ error: "Client scope mismatch" }, { status: 403 });
      }
    }

    await mergeDomainConnectionIntoCurrentSiteVersion(db, userId, site.id, row);

    return NextResponse.json({
      connection: row,
      requiredPayload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (/not allowed|Invalid|required/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("domains POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
