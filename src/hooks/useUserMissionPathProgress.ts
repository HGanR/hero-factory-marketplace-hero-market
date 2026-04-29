"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserMissionPathApiResponse } from "@/lib/user-mission-path/mission-path-types";

export const USER_MISSION_PATH_QUERY_KEY = ["user-mission-path"] as const;

async function fetchUserMissionPath(): Promise<UserMissionPathApiResponse> {
  const res = await fetch("/api/user/mission-path", { credentials: "include", cache: "no-store" });
  if (res.status === 401) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to load mission path");
  }
  return res.json() as Promise<UserMissionPathApiResponse>;
}

/**
 * Server-backed user Mission Path. Scoped to the authenticated session; not localStorage.
 * Multiple mount points share the same React Query cache.
 */
export function useUserMissionPathProgress() {
  return useQuery({
    queryKey: USER_MISSION_PATH_QUERY_KEY,
    queryFn: fetchUserMissionPath,
    staleTime: 60_000,
    retry: 1,
  });
}
