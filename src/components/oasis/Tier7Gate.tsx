"use client";

import React, { useEffect, useState } from "react";
import { useTier7Access } from "@/hooks/useTier7Access";
import MobileWalletButton from "@/components/MobileWalletButton";

type Tier7GateProps = {
  children: React.ReactNode;
};

export function Tier7Gate({ children }: Tier7GateProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { passesTier7, isLoading, isWalletConnected, onPolygon, error } = useTier7Access();

  useEffect(() => {
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => r.ok && r.json().then((j) => j.isAdmin))
      .then((ok) => setIsAdmin(!!ok))
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === true) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-8">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent" />
        <p className="text-slate-300">Checking Tier 7 access…</p>
      </div>
    );
  }

  if (passesTier7) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 md:p-8">
      <h3 className="text-lg font-semibold text-amber-200">Tier 7 Exclusive</h3>
      <p className="mt-2 text-sm text-slate-300">
        The AI World Generator is exclusive to Tier 7 holders. Connect your wallet with a Tier 7 Hero NFT to access.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {!isWalletConnected ? (
          <MobileWalletButton />
        ) : !onPolygon ? (
          <p className="text-sm text-amber-200">Please switch to Polygon network.</p>
        ) : error ? (
          <p className="text-sm text-red-300">Failed to verify. Try again.</p>
        ) : (
          <p className="text-sm text-slate-400">You need a Tier 7 Hero NFT (token ID 7) to access this feature.</p>
        )}
      </div>
    </div>
  );
}
