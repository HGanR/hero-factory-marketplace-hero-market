import { assertMarketplaceRevenueOsAccess } from "@/lib/revenue-os-access-server";

export default async function RevenueOsSliLayout({ children }: { children: React.ReactNode }) {
  await assertMarketplaceRevenueOsAccess("/revenue-os/social-lead-intelligence");
  return children;
}
