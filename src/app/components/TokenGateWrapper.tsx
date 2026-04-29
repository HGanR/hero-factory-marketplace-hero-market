"use client";

import { useEffect, useState } from "react";

/**
 * Simple client-only wrapper to prevent hydration flicker on token-gated pages.
 * (Keeps the UI stable: renders children only after the component mounts once.)
 */
export function TokenGateWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}


