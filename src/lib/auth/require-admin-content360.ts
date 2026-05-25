import "server-only";

import type { NextRequest } from "next/server";
import { verifyToken, jwtPayloadIndicatesPlatformAdmin } from "@/lib/auth";

export class Content360AdminAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "Content360AdminAuthError";
    this.status = status;
  }
}

/**
 * Platform-admin session required for Content360 platform API routes
 * (central API key, test connection, admin dashboard panel, admin-only publish).
 */
export function requireAdminContent360Session(request: NextRequest): Record<string, unknown> {
  const token = request.cookies.get("admin-token")?.value?.trim();
  if (!token) {
    throw new Content360AdminAuthError(401, "Admin session required (admin-token cookie).");
  }
  const payload = verifyToken(token);
  if (!payload || typeof payload !== "object" || !jwtPayloadIndicatesPlatformAdmin(payload)) {
    throw new Content360AdminAuthError(403, "Forbidden — platform administrator role required for Content360 platform operations.");
  }
  return payload as Record<string, unknown>;
}
