import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import {
  ptCanAccessProperty,
  ptGetProperty,
  ptValidatePublicShare,
} from "@/lib/property-twin/queries";

export async function propertyTwinRequireAuth(): Promise<
  { userId: number } | NextResponse
> {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId };
}

/**
 * Presentation bundle: session + property access, or valid `share` token (read-only).
 */
export async function propertyTwinResolvePresentationAccess(
  propertyId: number,
  shareToken: string | null | undefined
): Promise<{ kind: "session"; userId: number } | { kind: "share" } | NextResponse> {
  const prop = await ptGetProperty(propertyId);
  if (!prop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await getAuthedUserId();
  if (userId) {
    const ok = await ptCanAccessProperty(propertyId, userId);
    if (ok) return { kind: "session", userId };
  }

  const trimmed = shareToken?.trim() ?? null;
  if (trimmed && (await ptValidatePublicShare(propertyId, trimmed))) {
    return { kind: "share" };
  }

  if (userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
