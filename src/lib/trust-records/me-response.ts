import { and, desc, eq } from "drizzle-orm";
import { getDb, withDbTimeout } from "@/lib/db";
import { clients, marketplaceUsers, trustRecordRoles, trusts } from "@/lib/db/schema";

export type TrustRecordsMeResult =
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: 401 | 500; body: Record<string, unknown> };

/**
 * Shared Trust Records “me” payload (App Router route delegates here; Pages API uses this too).
 */
export async function buildTrustRecordsMeResponse(userId: number): Promise<TrustRecordsMeResult> {
  try {
    const db = await withDbTimeout(getDb(), 5000, "getDb");

    let metaSource: "db_last_active_explicit" | "db_last_used" = "db_last_used";

    const userPrefs = await withDbTimeout(
      db
        .select({ lastActiveTrustId: marketplaceUsers.lastActiveTrustId })
        .from(marketplaceUsers)
        .where(eq(marketplaceUsers.id, userId))
        .limit(1),
      5000,
      "trust-records me user prefs"
    );

    const explicitTrustId = userPrefs[0]?.lastActiveTrustId ?? null;

    let activeTrust:
      | {
          id: string;
          publicId: string | null;
          clientId: string | null;
          name: string | null;
          trustType: string | null;
        }
      | null = null;

    if (explicitTrustId) {
      const explicitRows = await withDbTimeout(
        db
          .select({
            id: trusts.id,
            publicId: trusts.publicId,
            clientId: trusts.clientId,
            name: trusts.name,
            trustType: trusts.trustType,
          })
          .from(trusts)
          .where(and(eq(trusts.id, explicitTrustId), eq(trusts.userId, userId)))
          .limit(1),
        8000,
        "trust-records me explicit trust"
      );
      if (explicitRows[0]) {
        activeTrust = explicitRows[0];
        metaSource = "db_last_active_explicit";
      }
    }

    if (!activeTrust) {
      const trustRows = await withDbTimeout(
        db
          .select({
            id: trusts.id,
            publicId: trusts.publicId,
            clientId: trusts.clientId,
            name: trusts.name,
            trustType: trusts.trustType,
          })
          .from(trusts)
          .where(eq(trusts.userId, userId))
          .orderBy(desc(trusts.updatedAt))
          .limit(1),
        8000,
        "trust-records me fallback trust"
      );

      activeTrust = trustRows[0] || null;
    }

    let clientInfo = null;
    if (activeTrust?.clientId) {
      const clientRows = await withDbTimeout(
        db.select().from(clients).where(eq(clients.id, activeTrust.clientId)).limit(1),
        5000,
        "trust-records me client"
      );
      if (clientRows[0]) {
        const clientPublicId = `CID-2026-${String(clientRows[0].id).slice(-4).toUpperCase()}`;
        clientInfo = {
          clientId: clientRows[0].id,
          clientPublicId,
        };
      }
    }

    const roleRows = await withDbTimeout(
      db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1),
      5000,
      "trust-records me role"
    );
    const role = (roleRows[0]?.role ?? "Manager") as
      | "grantor"
      | "trustee"
      | "admin"
      | "counsel"
      | "viewer"
      | "unknown";

    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        active: {
          clientId: clientInfo?.clientId ?? null,
          clientPublicId: clientInfo?.clientPublicId ?? null,
          entityId: null,
          entityPublicId: activeTrust?.publicId ?? null,
          trustId: activeTrust?.id ?? null,
          trustPublicId: activeTrust?.publicId ?? null,
          role,
        },
        meta: {
          source: metaSource,
          updatedAt: activeTrust ? new Date().toISOString() : null,
        },
      },
    };
  } catch (error) {
    console.error("Trust records me error:", error);
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: { code: "INTERNAL", message: "Failed to load trust context" },
      },
    };
  }
}
