"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TrustRecordsMeActive } from "@/lib/trust-records-me-client";

export type TrustActiveServerContextValue = {
  serverSnapshot: TrustRecordsMeActive | null;
  /** Workspace role from last server active hydration (Trust Records layout); avoids extra GET /me for role. */
  activeTrustRole: string | null;
  serverMeLoaded: boolean;
  serverMeLoading: boolean;
  refreshTrustRecordsMe: () => Promise<TrustRecordsMeActive | null>;
};

const TrustActiveServerContext = createContext<TrustActiveServerContextValue | null>(null);

export function TrustActiveServerProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: TrustActiveServerContextValue;
}) {
  return <TrustActiveServerContext.Provider value={value}>{children}</TrustActiveServerContext.Provider>;
}

/** When inside Trust Records (or another shell that owns GET /me), coherence hooks reuse this instead of fetching again. */
export function useTrustActiveServerOptional(): TrustActiveServerContextValue | null {
  return useContext(TrustActiveServerContext);
}
