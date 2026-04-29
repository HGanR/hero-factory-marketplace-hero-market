import { assertMarketplaceRevenueOsAccess } from "@/lib/revenue-os-access-server";

export default async function RevenueOsDashboardLayout({ children }: { children: React.ReactNode }) {
  await assertMarketplaceRevenueOsAccess("/revenue-os/dashboard");
  return children;
}
