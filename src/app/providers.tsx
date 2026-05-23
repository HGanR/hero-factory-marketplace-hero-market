"use client";

import { wagmiConfig } from "@/config/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { MarketplaceSessionAnalytics } from "@/components/analytics/MarketplaceSessionAnalytics";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MarketplaceSessionAnalytics />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}


