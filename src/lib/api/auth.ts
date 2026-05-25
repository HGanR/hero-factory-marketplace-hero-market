import { cookies } from "next/headers";
import { marketplaceUserIdFromSessionCookiePair } from "@/lib/auth";

/**
 * Marketplace session user id for API ownership (clients, Revenue OS hub, etc.).
 * Prefers a valid platform-admin `admin-token` when present; otherwise `auth-token`.
 */
export async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  return marketplaceUserIdFromSessionCookiePair(
    cookieStore.get("auth-token")?.value ?? "",
    cookieStore.get("admin-token")?.value ?? "",
  );
}



