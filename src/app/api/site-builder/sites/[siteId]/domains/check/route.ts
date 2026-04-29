import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { verifyDomainResolution } from "@/lib/site-builder/domain-connection-verify";
import { mergeDomainConnectionIntoCurrentSiteVersion } from "@/lib/site-builder/domain-connection-schema-sync";
import { getSiteDomainConnectionForOwner, updateSiteDomainConnectionStatus } from "@/lib/site-builder/site-domain-connections-repository";
import { assertClientMatchesSite } from "@/lib/site-builder/site-domain-connections-repository";
import { ensureSiteBuilderTables, ensureSiteDomainConnectionsTable, getOwnedSite } from "@/lib/site-builder/db";
import type { DomainConnectionStatus } from "@/lib/site-builder/domain-connection-shared";

const BodySchema = z.object({
  manualConfirm: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    await ensureSiteDomainConnectionsTable(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const siteClientId = site.clientId != null && String(site.clientId).trim() ? String(site.clientId).trim() : null;

    const row = await getSiteDomainConnectionForOwner(db, userId, siteId);
    if (!row) {
      return NextResponse.json({ error: "No domain connection for this site yet" }, { status: 400 });
    }

    if (siteClientId) {
      if (!assertClientMatchesSite(siteClientId, row.clientId)) {
        return NextResponse.json({ error: "Client scope mismatch" }, { status: 403 });
      }
    }

    const manual =
      Boolean(parsed.data.manualConfirm) && (row.domainType === "freename_web3" || row.domainType === "other_web3");
    if (parsed.data.manualConfirm && !manual) {
      return NextResponse.json({ error: "Manual confirm is for Web3 domains only" }, { status: 400 });
    }

    const res = await verifyDomainResolution({
      domain: row.domain,
      domainType: row.domainType,
      targetUrl: row.targetUrl,
      manualWeb3Confirm: manual,
    });

    const nextStatus: DomainConnectionStatus =
      res.status === "connected" ? "connected" : res.status === "failed" ? "failed" : "pending_verification";

    const updated = await updateSiteDomainConnectionStatus(db, userId, siteId, {
      status: nextStatus,
      verificationMethod: res.method,
      lastCheckedAt: new Date(),
    });
    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await mergeDomainConnectionIntoCurrentSiteVersion(db, userId, site.id, updated);

    return NextResponse.json({
      status: res.status,
      nextConnectionStatus: nextStatus,
      detail: res.detail,
      method: res.method,
      connection: updated,
    });
  } catch (e) {
    console.error("domains/check", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check failed" },
      { status: 500 },
    );
  }
}
