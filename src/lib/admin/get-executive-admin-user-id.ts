import type { NextRequest } from "next/server";
import { marketplaceUserIdFromJwtPayload } from "@/lib/auth";
import { npcJwtPayloadIsAdmin, verifyNpcAdminJwt } from "@/lib/admin/admin-session-jwt";

/**
 * Numeric admin user id for Executive Agent APIs (NPC admin JWT with `isAdmin: true`).
 */
export async function getExecutiveAdminUserId(request: NextRequest): Promise<number | null> {
  for (const name of ["admin-token", "auth-token"] as const) {
    const raw = request.cookies.get(name)?.value?.trim();
    if (!raw) continue;
    const payload = await verifyNpcAdminJwt(raw);
    if (!npcJwtPayloadIsAdmin(payload)) continue;
    const uid = marketplaceUserIdFromJwtPayload(payload);
    if (uid != null) return uid;
  }
  return null;
}
