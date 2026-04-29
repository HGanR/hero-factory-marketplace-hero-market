import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { evaluateRevenueOsSession } from "@/lib/revenue-os-session";

/**
 * Server-only: require a session that may use Revenue OS product routes.
 * Admins bypass. Marketplace users need auth-token and revenueOsAccess !== false.
 */
export async function assertMarketplaceRevenueOsAccess(returnPath: string) {
  const cookieStore = await cookies();
  const verdict = await evaluateRevenueOsSession((name) => cookieStore.get(name)?.value);
  if (verdict === "allow") return;
  if (verdict === "deny") redirect("/ros-access-denied");
  redirect(`/?returnTo=${encodeURIComponent(returnPath)}`);
}
