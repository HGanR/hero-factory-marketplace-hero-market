import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { securityCertificates, securityHolders, securityTransferRequests, trustControls, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const StatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional();

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  const url = new URL(request.url);
  const status = StatusSchema.safeParse(url.searchParams.get("status") || undefined).success
    ? (url.searchParams.get("status") as any)
    : undefined;
  const includeRaw = url.searchParams.get("include") || "";
  const includes = new Set(includeRaw.split(",").map((s) => s.trim()).filter(Boolean));
  const includeHolders = includes.has("holder") || includes.has("holders");
  const includeCertificates = includes.has("certificate") || includes.has("certificates");
  const includeCounts = includes.has("counts");

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const where = status
    ? and(eq(securityTransferRequests.trustId, trustId), eq(securityTransferRequests.status, status))
    : eq(securityTransferRequests.trustId, trustId);

  const rows = await db.select().from(securityTransferRequests).where(where).orderBy(sql`updatedAt desc`).limit(200);

  // Optional counts (for future tabbed inbox)
  let counts: Record<string, number> | undefined = undefined;
  if (includeCounts) {
    const grouped = await db
      .select({
        status: securityTransferRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(securityTransferRequests)
      .where(eq(securityTransferRequests.trustId, trustId))
      .groupBy(securityTransferRequests.status);
    counts = {};
    for (const g of grouped as any[]) counts[String(g.status)] = Number(g.count ?? 0);
  }

  if (!includeHolders && !includeCertificates) {
    return NextResponse.json(
      {
        trustId,
        status: status ?? null,
        counts,
        items: rows.map((r: any) => ({
          id: String(r.id),
          offeringId: String(r.offeringId),
          certificateId: String(r.certificateId),
          fromHolderId: String(r.fromHolderId),
          toHolderId: String(r.toHolderId),
          reason: r.reason ? String(r.reason) : null,
          effectiveDate: r.effectiveDate ? String(r.effectiveDate) : null,
          status: String(r.status),
          createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt as any).toISOString() : null,
        })),
      },
      { headers: { "Cache-Control": "private, max-age=10", Vary: "Cookie" } }
    );
  }

  const holderIds = new Set<string>();
  const certificateIds = new Set<string>();
  for (const r of rows as any[]) {
    if (includeHolders) {
      if (r.fromHolderId) holderIds.add(String(r.fromHolderId));
      if (r.toHolderId) holderIds.add(String(r.toHolderId));
    }
    if (includeCertificates) {
      if (r.certificateId) certificateIds.add(String(r.certificateId));
    }
  }

  const [holderRows, certRows] = await Promise.all([
    includeHolders && holderIds.size > 0
      ? db
          .select()
          .from(securityHolders)
          .where(and(eq(securityHolders.trustId, trustId), inArray(securityHolders.id, Array.from(holderIds))))
      : Promise.resolve([] as any[]),
    includeCertificates && certificateIds.size > 0
      ? db
          .select()
          .from(securityCertificates)
          .where(and(eq(securityCertificates.trustId, trustId), inArray(securityCertificates.id, Array.from(certificateIds))))
      : Promise.resolve([] as any[]),
  ]);

  const holderById: Record<string, any> = {};
  for (const h of holderRows as any[]) holderById[String(h.id)] = h;

  const certById: Record<string, any> = {};
  for (const c of certRows as any[]) certById[String(c.id)] = c;

  return NextResponse.json(
    {
      trustId,
      status: status ?? null,
      counts,
      items: (rows as any[]).map((r) => {
        const req = {
          id: String(r.id),
          offeringId: String(r.offeringId),
          certificateId: String(r.certificateId),
          fromHolderId: String(r.fromHolderId),
          toHolderId: String(r.toHolderId),
          reason: r.reason ? String(r.reason) : null,
          effectiveDate: r.effectiveDate ? String(r.effectiveDate) : null,
          status: String(r.status),
          createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt as any).toISOString() : null,
        };

        const fromH = includeHolders ? holderById[String(r.fromHolderId)] : null;
        const toH = includeHolders ? holderById[String(r.toHolderId)] : null;
        const cert = includeCertificates ? certById[String(r.certificateId)] : null;

        return {
          request: req,
          holders: includeHolders
            ? {
                from: fromH ? { id: String(fromH.id), displayName: String(fromH.displayName) } : null,
                to: toH ? { id: String(toH.id), displayName: String(toH.displayName) } : null,
              }
            : null,
          certificate: includeCertificates
            ? cert
              ? {
                  id: String(cert.id),
                  certificateNo: String(cert.certificateNo),
                  amount: String(cert.amount),
                  offeringId: String(cert.offeringId),
                }
              : null
            : null,
        };
      }),
    },
    { headers: { "Cache-Control": "private, max-age=10", Vary: "Cookie" } }
  );
}


