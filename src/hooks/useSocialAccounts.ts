"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SocialAccountLite } from "@/lib/social/social-account-public";

async function fetchSocialAccounts(clientId: string): Promise<SocialAccountLite[]> {
  const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "?clientId=";
  const r = await fetch(`/api/social/accounts${qs}`);
  if (!r.ok) throw new Error("Failed to load social accounts");
  const j = (await r.json()) as { accounts?: SocialAccountLite[] };
  return Array.isArray(j.accounts) ? j.accounts : [];
}

const STALE_MS = 1000 * 60 * 5;

/**
 * Session-friendly cache for GET /api/social/accounts (shared via React Query).
 */
export function useSocialAccounts(clientId: string) {
  return useQuery({
    queryKey: ["social-accounts", clientId],
    queryFn: () => fetchSocialAccounts(clientId),
    staleTime: STALE_MS,
    gcTime: 1000 * 60 * 30,
  });
}

export function useInvalidateSocialAccounts() {
  const qc = useQueryClient();
  return useCallback(
    (clientId: string) => {
      void qc.invalidateQueries({ queryKey: ["social-accounts", clientId] });
    },
    [qc]
  );
}
