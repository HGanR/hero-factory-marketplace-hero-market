import type { NextRequest } from 'next/server';
import { verifyNpcAdminJwt, npcJwtPayloadIsAdmin } from '@/lib/admin/admin-session-jwt';

export class EngineAccessError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export type EngineRouteActor = { userId: number; admin: boolean };

/** Existing HS256 session verification; production missing-secret errors fail closed. */
export async function engineRouteActor(req: NextRequest): Promise<EngineRouteActor> {
  for (const name of ['admin-token', 'auth-token'] as const) {
    const token = req.cookies.get(name)?.value;
    if (!token) continue;
    const payload = await verifyNpcAdminJwt(token);
    if (!payload) continue;
    const value = payload.userId;
    if (!(typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value)))) continue;
    const userId = Number(value);
    if (!Number.isSafeInteger(userId) || userId <= 0) continue;
    const admin = npcJwtPayloadIsAdmin(payload);
    if (name === 'admin-token' && !admin) continue;
    return { userId, admin };
  }
  throw new EngineAccessError('Unauthorized', 401);
}

export function requireSameOrigin(req: NextRequest) {
  if (req.headers.get('origin') !== new URL(req.url).origin) {
    throw new EngineAccessError('Same-origin request required', 403);
  }
}

/** A mutable profile wallet is not proof; use only an already verified identity link. */
export const VERIFIED_CERTIFICATE_WALLET_SQL = `SELECT links.id
FROM troo_wallet_links AS links
INNER JOIN troo_identities AS identity_row ON identity_row.id = links.identityId
WHERE identity_row.userId = ? AND links.chain = 'evm'
AND LOWER(links.address) = ? AND links.verifiedAt IS NOT NULL
LIMIT 1`;
