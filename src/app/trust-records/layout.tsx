"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthGate } from "@/components/AuthGate";
import { IdentityStrip } from "@/components/IdentityStrip";
import { AgentHudPills } from "@/components/trust-records/AgentHudPills";
import { buildStepFocus } from "@/components/smart-trust/AgentAssistPanel";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { JarvaHandoffStrip } from "@/components/jarva/JarvaHandoffStrip";
import { JarvaNextActionStrip } from "@/components/jarva/JarvaNextActionStrip";
import { TrustBindingCoherenceNotice } from "@/components/trust/TrustBindingCoherenceNotice";
import { TrustActiveServerProvider } from "@/context/TrustActiveServerContext";
import {
  type TrustRecordsMeActive,
  invalidateTrustRecordsMeActiveCache,
  subscribeTrustRecordsServerActiveUpdated,
} from "@/lib/trust-records-me-client";

// Minimal shapes (avoid importing backend types into UI shell)
type ClientMe = { clientId?: string | null };

type TrustRecordsMeResponse = {
  ok: true;
  active: {
    clientId: string | null;
    clientPublicId: string | null;
    entityId: string | null;
    entityPublicId: string | null;
    trustId: string | null;
    trustPublicId: string | null;
    role: "grantor" | "trustee" | "admin" | "counsel" | "viewer" | "unknown";
  };
  meta: {
    source: "session" | "wallet_map" | "db_last_used" | "db_last_active_explicit" | "none";
    updatedAt: string | null;
  };
};

type ApiError = {
  ok: false;
  error: { code: string; message: string };
};

type WorkspaceSummary = {
  trust?: {
    id?: string | null;
    workspaceStatus?: string | null;
  } | null;
  client?: {
    id?: string;
    fullName?: string;
    title?: string | null;
  } | null;
  counts?: {
    parties?: number;
    beneficiaries?: number;
    assets?: number;
  } | null;
  checklist?: {
    partiesAndRoles?: boolean;
    beneficiaries?: boolean;
    assetsAndFundingPlan?: boolean;
    generateDraftDocuments?: boolean;
  } | null;
};

async function safeGetJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(url, { method: "GET", credentials: "include" });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

async function safePostJson<TReq extends object, TRes>(
  url: string,
  body: TReq
): Promise<{ ok: true; data: TRes } | { ok: false; status: number; errorText: string }> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status, errorText: await res.text().catch(() => "") };
  return { ok: true, data: (await res.json()) as TRes };
}

function TrustRecordsLayoutContent({ children }: { children: React.ReactNode }) {
  const { authed } = useAuthStatus();
  const searchParams = useSearchParams();

  // Try to resolve trustId from URL first (works for /trust-records?trustId=... and any subpages that carry it)
  const trustIdFromUrl = searchParams?.get("trustId") || null;
  const currentTab = searchParams?.get("tab") || undefined;
  const [clientId, setClientId] = useState<string | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);

  // Unified active context from server
  const [active, setActive] = useState<TrustRecordsMeResponse["active"] | null>(null);
  const [trustMeResolved, setTrustMeResolved] = useState(false);
  const [trustMeLoading, setTrustMeLoading] = useState(false);
  const activeTrustId = trustIdFromUrl || active?.trustId || null;
  const effectiveClientId = active?.clientId ?? clientId ?? null;

  const refreshTrustRecordsMe = useCallback(async (): Promise<TrustRecordsMeActive | null> => {
    const tr = await safeGetJson<TrustRecordsMeResponse | ApiError>("/api/trust-records/me");
    if (tr.ok && (tr.data as any)?.ok === true) {
      const a = (tr.data as TrustRecordsMeResponse).active;
      setActive(a);
      return {
        trustId: a.trustId != null ? String(a.trustId) : null,
        clientId: a.clientId != null ? String(a.clientId) : null,
      };
    }
    setActive(null);
    return null;
  }, []);

  const trustServerContext = useMemo(() => {
    const serverSnapshot: TrustRecordsMeActive | null = active
      ? {
          trustId: active.trustId != null ? String(active.trustId) : null,
          clientId: active.clientId != null ? String(active.clientId) : null,
        }
      : null;
    return {
      serverSnapshot,
      activeTrustRole: active?.role != null ? String(active.role) : null,
      serverMeLoaded: trustMeResolved,
      serverMeLoading: trustMeLoading,
      refreshTrustRecordsMe,
    };
  }, [active, trustMeResolved, trustMeLoading, refreshTrustRecordsMe]);

  useEffect(() => {
    let mounted = true;

    if (!authed) {
      setClientId(null);
      setActive(null);
      setTrustMeResolved(false);
      setTrustMeLoading(false);
      return;
    }

    setTrustMeLoading(true);
    setTrustMeResolved(false);

    (async () => {
      // 1) Load CID (keep as-is)
      const me = await safeGetJson<ClientMe>("/api/clients/me");
      if (mounted && me.ok) setClientId(me.data.clientId ?? null);
      if (!mounted) return;

      // 2) If URL has trustId, bind it into server active context
      if (trustIdFromUrl) {
        const setRes = await safePostJson<
          { trustId: string; source: string },
          TrustRecordsMeResponse | ApiError
        >("/api/trust-records/active", { trustId: trustIdFromUrl, source: "deep-link" });

        if (mounted && setRes.ok && (setRes.data as any)?.ok === true) {
          setActive((setRes.data as TrustRecordsMeResponse).active);
          invalidateTrustRecordsMeActiveCache();
          setTrustMeResolved(true);
          setTrustMeLoading(false);
          return;
        }
        // If POST fails, fall through to GET /me as best effort
      }

      // 3) Hydrate from server authoritative context
      const tr = await safeGetJson<TrustRecordsMeResponse | ApiError>("/api/trust-records/me");
      if (!mounted) return;

      if (tr.ok && (tr.data as any)?.ok === true) {
        setActive((tr.data as TrustRecordsMeResponse).active);
      } else {
        setActive(null);
      }
      setTrustMeResolved(true);
      setTrustMeLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [authed, trustIdFromUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return subscribeTrustRecordsServerActiveUpdated(() => {
      void refreshTrustRecordsMe();
    });
  }, [refreshTrustRecordsMe]);

  useEffect(() => {
    let cancelled = false;

    if (!authed || !activeTrustId) {
      setWorkspaceSummary(null);
      return;
    }

    (async () => {
      try {
        const res = await safeGetJson<WorkspaceSummary>(
          `/api/trusts/${encodeURIComponent(activeTrustId)}/workspace/summary`
        );
        if (!cancelled) {
          setWorkspaceSummary(res.ok ? res.data : null);
        }
      } catch {
        if (!cancelled) setWorkspaceSummary(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, activeTrustId]);

  /** Jarva apply / auto-sync: refresh orchestration strip counts + Agent HUD without full navigation */
  useEffect(() => {
    const id = activeTrustId;
    if (!id || typeof window === "undefined") return;
    const onJarvaWorkspace = (ev: Event) => {
      const ce = ev as CustomEvent<{ trustId?: string; summary?: WorkspaceSummary }>;
      if (ce.detail?.trustId !== id) return;
      if (ce.detail.summary) {
        setWorkspaceSummary(ce.detail.summary);
        return;
      }
      void (async () => {
        const res = await safeGetJson<WorkspaceSummary>(`/api/trusts/${encodeURIComponent(id)}/workspace/summary`);
        if (res.ok) setWorkspaceSummary(res.data);
      })();
    };
    window.addEventListener("jarva-workspace-updated", onJarvaWorkspace as EventListener);
    return () => window.removeEventListener("jarva-workspace-updated", onJarvaWorkspace as EventListener);
  }, [activeTrustId]);

  const assistantContext = useMemo(() => {
    const checklist = workspaceSummary?.checklist ?? null;
    const checks = [
      checklist?.partiesAndRoles,
      checklist?.beneficiaries,
      checklist?.assetsAndFundingPlan,
      checklist?.generateDraftDocuments,
    ].filter((v) => typeof v === "boolean") as boolean[];
    const completionPct =
      checks.length > 0 ? Math.round((checks.filter(Boolean).length / checks.length) * 100) : undefined;

    const blockers: string[] = [];
    const advisories: string[] = [];

    if (!activeTrustId) blockers.push("Select or create a trust workspace");
    if (checklist && !checklist.partiesAndRoles) blockers.push("Complete grantor and trustee party records");
    if (checklist && !checklist.beneficiaries) blockers.push("Add at least one beneficiary");
    if (checklist && !checklist.assetsAndFundingPlan) blockers.push("Add initial trust assets/funding plan");

    const counts = workspaceSummary?.counts;
    if (counts) {
      advisories.push(
        `Workspace snapshot: ${counts.parties ?? 0} parties, ${counts.beneficiaries ?? 0} beneficiaries, ${counts.assets ?? 0} assets`
      );
    }

    return {
      source: "trust-records" as const,
      trustId: activeTrustId,
      workspaceId: activeTrustId,
      clientId: effectiveClientId,
      clientTitle: workspaceSummary?.client?.title ?? undefined,
      entityId: active?.entityId ?? null,
      currentStep: currentTab || "issue",
      stepFocus: buildStepFocus("trust-records", currentTab || "issue"),
      moduleType: "trust-workspace",
      completionPct,
      blockers,
      advisories,
      workspaceStatus: workspaceSummary?.trust?.workspaceStatus ?? undefined,
      workspaceCounts: counts ?? undefined,
    };
  }, [active?.entityId, activeTrustId, currentTab, effectiveClientId, workspaceSummary]);

  return (
    <TrustActiveServerProvider value={trustServerContext}>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <AgentHudPills context={assistantContext} position="bottom-right" />
        <IdentityStrip
          clientId={active?.clientId ?? clientId ?? undefined}
          trustId={active?.trustId ?? undefined}
          entityPublicId={active?.entityPublicId ?? active?.trustPublicId ?? undefined}
          isAuthenticated={authed}
          showWalletStatus={false}
        />
        {authed ? (
          <TrustBindingCoherenceNotice
            enabled={authed}
            activePostSource="trust-records"
            className="max-w-full"
          />
        ) : null}
        <JarvaHandoffStrip />
        <JarvaNextActionStrip />
        {activeTrustId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-4 py-3 text-sm">
            <span className="text-emerald-100/90">Orchestration</span>
            <Link
              href={`/trust-records/jarva?trustId=${encodeURIComponent(activeTrustId)}`}
              className="font-semibold text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline"
            >
              Build with Jarva
            </Link>
            <span className="text-slate-500">— structured intake → Smart Trust draft</span>
          </div>
        ) : null}
        {children}
      </div>
    </TrustActiveServerProvider>
  );
}

/** Preserve query (e.g. `tab=settings`, `trustId=`) when AuthGate sends users to `/?returnTo=`. */
function TrustRecordsAuthGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `/trust-records?${qs}` : "/trust-records";
  }, [searchParams]);

  return (
    <AuthGate redirectTo={redirectTo} showWalletAuth={false}>
      {children}
    </AuthGate>
  );
}

export default function TrustRecordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-white">Loading…</div>
        </div>
      }
    >
      <TrustRecordsAuthGate>
        <Suspense
          fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
              <div className="text-white">Loading…</div>
            </div>
          }
        >
          <TrustRecordsLayoutContent>{children}</TrustRecordsLayoutContent>
        </Suspense>
      </TrustRecordsAuthGate>
    </Suspense>
  );
}
