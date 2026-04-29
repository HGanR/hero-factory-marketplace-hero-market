import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialAccounts, socialAccountCapabilities } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { mapSocialAccountRowToPublicApi } from "@/lib/social/social-account-public";
import { deriveSocialAccountCapabilityFlags, type SocialAccountCapabilityFlags } from "@/lib/social/social-account-capability-flags";

/**
 * GET /api/revenue-os/social-studio/connection-summary?clientId=
 * Connected accounts with publish capability flags (no token material).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId")?.trim() || "";

    const db = await getDb();
    const rows = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.userId, String(userId)), eq(socialAccounts.clientId, clientId)));

    const capIds = rows.map((r) => r.id);
    const capById: Record<string, (typeof socialAccountCapabilities.$inferSelect) | undefined> = {};
    if (capIds.length) {
      const caps = await db
        .select()
        .from(socialAccountCapabilities)
        .where(inArray(socialAccountCapabilities.socialAccountId, capIds));
      for (const c of caps) capById[c.socialAccountId] = c;
    }

    const accounts = rows.map((r) => {
      const base = mapSocialAccountRowToPublicApi({
        id: r.id,
        platform: r.platform,
        displayName: r.displayName,
        externalAccountId: r.externalAccountId,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      });
      const exp = r.expiresAt ? new Date(r.expiresAt as Date) : null;
      const expired = exp != null && !Number.isNaN(exp.getTime()) && exp.getTime() < Date.now();
      const ovr = (capById[r.id]?.flagsJson as Partial<SocialAccountCapabilityFlags> | null) ?? null;
      const derived = deriveSocialAccountCapabilityFlags(r.platform, ovr);
      return {
        ...base,
        status: expired ? "expired" : "connected",
        tokenExpiresAt: base.expiresAt,
        capabilities: derived.flags,
        capabilityNotes: derived.notes,
        directOrganicPublishAvailable: derived.directOrganicPublishAvailable,
        defaultDestination: capById[r.id]?.defaultDestination ?? null,
        lastCapabilitySyncAt: capById[r.id]?.lastCapabilitySyncAt ?? null,
      };
    });

    return NextResponse.json({ accounts });
  } catch (e) {
    console.error("[revenue-os/social-studio/connection-summary]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
