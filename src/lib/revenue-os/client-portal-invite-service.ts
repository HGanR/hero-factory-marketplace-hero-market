import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientPortalInvites } from "@/lib/db/schema";
import { logClientPortalActivity } from "@/lib/client-portal/portal-activity";
import { generateRawInviteToken, hashInviteToken } from "@/lib/client-portal/invite-token";
import { getAppOriginForClientPortal } from "@/lib/revenue-os/client-portal-app-origin";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";

type Db = Awaited<ReturnType<typeof getDb>>;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE = new Set(["owner", "manager", "viewer"]);

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export type CreatePortalInviteResult =
  | { ok: true; inviteId: string; inviteLink: string; expiresAt: string; email: string; role: string }
  | { ok: false; error: string; status?: number };

/**
 * Creates a portal invite for a client the operator owns. Used by HTTP route and Site Builder actions.
 */
export async function createPortalInviteForOperator(
  db: Db,
  userId: number,
  clientId: string,
  emailRaw: string,
  roleRaw = "manager",
): Promise<CreatePortalInviteResult> {
  try {
    assertValidClientId(clientId);
  } catch {
    return { ok: false, error: "Invalid client id", status: 400 };
  }
  const acc = await getOwnedClientRow(userId, clientId);
  if (!acc) {
    return { ok: false, error: "Not found", status: 404 };
  }
  const email = normalizeEmail(emailRaw);
  if (!email || !email.includes("@") || email.length > 320) {
    return { ok: false, error: "Valid email required", status: 400 };
  }
  const roleStr = String(roleRaw).trim() || "manager";
  if (!ROLE.has(roleStr)) {
    return { ok: false, error: "Invalid role", status: 400 };
  }
  const role = roleStr as "owner" | "manager" | "viewer";

  await ensureClientPortalTables();

  const rawToken = generateRawInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db
    .update(clientPortalInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(clientPortalInvites.clientId, clientId),
        eq(clientPortalInvites.email, email),
        isNull(clientPortalInvites.acceptedAt),
        isNull(clientPortalInvites.revokedAt),
      ),
    );

  await db.insert(clientPortalInvites).values({
    id,
    clientId,
    ownerUserId: acc.ownerUserId,
    email,
    tokenHash,
    role,
    expiresAt,
    acceptedAt: null,
    revokedAt: null,
  });
  await logClientPortalActivity(clientId, null, "portal_invite_sent", { email, inviteId: id });

  const base = getAppOriginForClientPortal();
  const inviteLink = `${base}/client-portal/invite/${encodeURIComponent(rawToken)}`;

  return {
    ok: true,
    inviteId: id,
    inviteLink,
    expiresAt: expiresAt.toISOString(),
    email,
    role,
  };
}
