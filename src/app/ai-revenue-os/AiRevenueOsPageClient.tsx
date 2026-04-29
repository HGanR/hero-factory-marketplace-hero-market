"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardParticleBackground } from "@/components/dashboard/DashboardParticleBackground";
import { AiRevenueOsSharedStateProvider } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { BentleyAiRevenueOsScopeSync } from "@/components/ai-revenue-os/BentleyAiRevenueOsScopeSync";
import { BentleyPersistedSnapshotHydration } from "@/components/ai-revenue-os/BentleyPersistedSnapshotHydration";
import { getResolvedUserIdFromStorage } from "@/lib/revenue-os/bentley-user-session";
import { AiRevenueOsDebugListeners } from "./AiRevenueOsDebugListeners";

const AiRevenueOsMainBody = dynamic(
  () => import("./AiRevenueOsMainBody").then((m) => m.AiRevenueOsMainBody),
  {
    ssr: false,
    loading: () => <div className="min-h-[40vh] bg-slate-950" aria-hidden />,
  }
);

const AiRevenueOsFooterWidgets = dynamic(
  () => import("./AiRevenueOsFooterWidgets").then((m) => m.AiRevenueOsFooterWidgets),
  { ssr: false, loading: () => null }
);

export default function AIRevenueOSLandingPage() {
  const [resolvedUserId, setResolvedUserId] = useState(() => getResolvedUserIdFromStorage());

  useEffect(() => {
    setResolvedUserId(getResolvedUserIdFromStorage());
  }, []);

  useEffect(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const connected = params?.get("connected");
    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected`);
      window.history.replaceState({}, "", "/ai-revenue-os");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white relative">
      <AiRevenueOsDebugListeners />
      <DashboardParticleBackground />
      <AiRevenueOsSharedStateProvider>
        <Suspense fallback={null}>
          <BentleyAiRevenueOsScopeSync userId={resolvedUserId} />
        </Suspense>
        <BentleyPersistedSnapshotHydration />
        <div className="relative z-10">
          <AiRevenueOsMainBody />
          <AiRevenueOsFooterWidgets />
        </div>
      </AiRevenueOsSharedStateProvider>
    </div>
  );
}
