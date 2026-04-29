import type { NextRequest } from "next/server";
import { createToken, verifyToken } from "@/lib/auth";

const TYP = "client_portal" as const;

export type ClientPortalJwtPayload = {
  typ: typeof TYP;
  portalUserId: string;
  clientId: string;
  ownerUserId: number;
  role: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function createClientPortalToken(payload: Omit<ClientPortalJwtPayload, "typ">): string {
  return createToken({ ...payload, typ: TYP });
}

export function verifyClientPortalToken(token: string | undefined | null): ClientPortalJwtPayload | null {
  if (!token || !token.trim()) return null;
  const decoded = verifyToken(token) as unknown;
  if (!isRecord(decoded)) return null;
  if (decoded.typ !== TYP) return null;
  if (typeof decoded.portalUserId !== "string" || !decoded.portalUserId) return null;
  if (typeof decoded.clientId !== "string" || !decoded.clientId) return null;
  const own = Number(decoded.ownerUserId);
  if (!Number.isFinite(own)) return null;
  if (typeof decoded.role !== "string" || !decoded.role) return null;
  return {
    typ: TYP,
    portalUserId: decoded.portalUserId,
    clientId: decoded.clientId,
    ownerUserId: own,
    role: decoded.role,
  };
}

export function getClientPortalTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get("client-portal-token")?.value ?? null;
}
