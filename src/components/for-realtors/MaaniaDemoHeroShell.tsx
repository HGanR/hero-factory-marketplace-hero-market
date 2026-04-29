"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  MAANIA_BUYER_DEMO_STORAGE_KEY,
  MAANIA_RET_DEMO_STORAGE_KEY,
} from "@/lib/maania/maania-demo-storage";
import { BuyerDemoHeroShell } from "@/components/for-realtors/BuyerDemoHeroShell";
import { RetDemoHeroShell } from "@/components/for-realtors/RetDemoHeroShell";

/**
 * Buyer session preview takes precedence over RET when both keys exist (rare).
 */
export function MaaniaDemoHeroShell({ fallback }: { fallback: ReactNode }) {
  const [mode, setMode] = useState<"buyer" | "ret" | "none">("none");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(MAANIA_BUYER_DEMO_STORAGE_KEY)) {
        setMode("buyer");
        return;
      }
      if (sessionStorage.getItem(MAANIA_RET_DEMO_STORAGE_KEY)) {
        setMode("ret");
        return;
      }
      setMode("none");
    } catch {
      setMode("none");
    }
  }, []);

  if (mode === "buyer") return <BuyerDemoHeroShell fallback={fallback} />;
  if (mode === "ret") return <RetDemoHeroShell fallback={fallback} />;
  return <>{fallback}</>;
}
