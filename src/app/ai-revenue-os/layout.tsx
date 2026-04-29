import { assertMarketplaceRevenueOsAccess } from "@/lib/revenue-os-access-server";

export default async function AiRevenueOsLayout({ children }: { children: React.ReactNode }) {
  await assertMarketplaceRevenueOsAccess("/ai-revenue-os");
  return children;
}
