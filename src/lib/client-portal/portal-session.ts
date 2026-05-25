import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientAccounts, clientPortalUsers } from "@/lib/db/schema";
import type { ClientAccountRow } from "@/lib/revenue-os/client-hub-types";
import { createClientPortalToken, type ClientPortalJwtPayload, verifyClientPortalToken } from "./portal-token";
import { cookieHostFromRequest, sessionCookieBase } from "@/lib/auth-cookie-options";

export type PortalUserRow = typeof clientPortalUsers.$inferSelect;

export type ClientPortalSessionState = {
  tokenPayload: ClientPortalJwtPayload;
  client: ClientAccountRow;
  portalUser: PortalUserRow;
};

export async function getClientPortalSession(): Promise<ClientPortalSessionState | null> {
  const store = await cookies();
  const token = store.get("client-portal-token")?.value;
  const payload = verifyClientPortalToken(token);
  if (!payload) return null;
  await ensureClientPortalTables();
  const db = await getDb();
  const [u] = await db
    .select()
    .from(clientPortalUsers)
    .where(
      and(
        eq(clientPortalUsers.id, payload.portalUserId),
        eq(clientPortalUsers.clientId, payload.clientId),
        eq(clientPortalUsers.ownerUserId, payload.ownerUserId),
      ),
    )
    .limit(1);
  if (!u || u.status !== "active") return null;
  const [c] = await db
    .select()
    .from(clientAccounts)
    .where(and(eq(clientAccounts.id, u.clientId), eq(clientAccounts.ownerUserId, u.ownerUserId)))
    .limit(1);
  if (!c) return null;
  return { tokenPayload: payload, client: c as ClientAccountRow, portalUser: u };
}

export async function setClientPortalAuthCookie(jwt: string) {
  const h = await headers();
  const b = sessionCookieBase(cookieHostFromRequest({ headers: h }));
  const store = await cookies();
  store.set("client-portal-token", jwt, { ...b, maxAge: 7 * 24 * 60 * 60, httpOnly: true });
}

export async function clearClientPortalAuthCookie() {
  const h = await headers();
  const b = sessionCookieBase(cookieHostFromRequest({ headers: h }));
  const store = await cookies();
  store.set("client-portal-token", "", { ...b, maxAge: 0 });
}

export { createClientPortalToken, verifyClientPortalToken };

/**
 * @throws if no valid active portal session
 */
export async function requireClientPortalSession(): Promise<ClientPortalSessionState> {
  const s = await getClientPortalSession();
  if (!s) {
    const err = new Error("UNAUTHORIZED_PORTAL");
    (err as { code?: string }).code = "UNAUTHORIZED_PORTAL";
    throw err;
  }
  return s;
}
