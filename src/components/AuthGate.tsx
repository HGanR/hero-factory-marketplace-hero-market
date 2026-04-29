"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/hooks/useAuthStatus";

export type AuthGateProps = {
  children: ReactNode;
  /** App path (may include query) to send back to after sign-in (`/?returnTo=…`). */
  redirectTo?: string;
  /** Reserved for wallet / SIWE fallback; currently unused by callers. */
  showWalletAuth?: boolean;
};

export function AuthGate({ children, redirectTo = "/", showWalletAuth: _showWalletAuth = false }: AuthGateProps) {
  const router = useRouter();
  const { authed, loading } = useAuthStatus();

  useEffect(() => {
    if (loading || authed) return;
    const path = (redirectTo ?? "/").trim() || "/";
    const dest = path.startsWith("/") ? `/?returnTo=${encodeURIComponent(path)}` : "/";
    router.replace(dest);
  }, [loading, authed, router, redirectTo]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-200">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        <p className="text-sm text-slate-400">Checking sign-in…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-200">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        <p className="text-sm text-slate-400">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
