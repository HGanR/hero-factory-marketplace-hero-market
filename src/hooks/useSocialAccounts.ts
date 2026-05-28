"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import type { SocialAccountLite } from "@/lib/social/social-account-public";

async function fetchSocialAccounts(clientId: unknown): Promise<SocialAccountLite[]> {
  const cid = coerceTrimmedString(clientId);
  if (!cid) return [];
  const r = await fetch(`/api/social/accounts?clientId=${encodeURIComponent(cid)}`);
  if (!r.ok) throw new Error("Failed to load social accounts");
  const j = (await r.json()) as { accounts?: SocialAccountLite[] };
  return Array.isArray(j.accounts) ? j.accounts : [];
}

const STALE_MS = 1000 * 60 * 5;

/**
 * Session-friendly cache for GET /api/social/accounts (shared via React Query).
 */
export function useSocialAccounts(clientId: unknown) {
  const cid = coerceTrimmedString(clientId);
  return useQuery({
    queryKey: ["social-accounts", cid],
    queryFn: () => fetchSocialAccounts(cid),
    enabled: cid.length > 0,
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
