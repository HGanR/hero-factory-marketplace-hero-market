"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PreAccountingProfile } from "@/lib/accounting/pre-accounting/types";
import {
  defaultPreAccountingProfile,
  loadPreAccountingProfile,
  savePreAccountingProfile,
  readTransactionSnapshotFromLocalStorage,
} from "@/lib/accounting/pre-accounting/profile-storage";
import {
  fetchPreAccountingWorkspace,
  savePreAccountingWorkspace,
  type PreAccountingWorkspaceResponse,
} from "@/lib/accounting/pre-accounting/api-client";

export type AccountingWorkspaceSection =
  | "overview"
  | "ledger"
  | "documents"
  | "quarterly"
  | "reports"
  | "forms"
  | "review_queue"
  | "handoff";

type Ctx = {
  profile: PreAccountingProfile;
  setProfile: React.Dispatch<React.SetStateAction<PreAccountingProfile>>;
  patchProfile: (patch: Partial<PreAccountingProfile>) => void;
  refreshProfile: () => void;
  workspaceSection: AccountingWorkspaceSection;
  setWorkspaceSection: (s: AccountingWorkspaceSection) => void;
  serverWorkspace: PreAccountingWorkspaceResponse | null;
  syncStatus: "idle" | "loading" | "saving" | "error";
  lastServerError: string | null;
  reloadFromServer: () => Promise<void>;
};

const AccountingPreAccountingContext = createContext<Ctx | null>(null);

export function AccountingPreAccountingProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PreAccountingProfile>(() => {
    if (typeof window === "undefined") return defaultPreAccountingProfile();
    return loadPreAccountingProfile();
  });
  const [workspaceSection, setWorkspaceSection] = useState<AccountingWorkspaceSection>("overview");
  const [serverWorkspace, setServerWorkspace] = useState<PreAccountingWorkspaceResponse | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [lastServerError, setLastServerError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadFromServer = useCallback(async () => {
    setSyncStatus("loading");
    setLastServerError(null);
    try {
      const data = await fetchPreAccountingWorkspace(profile.taxYear);
      if (data?.ok && data.profile) {
        setProfile(data.profile);
        savePreAccountingProfile(data.profile);
        setServerWorkspace(data);
      } else if (data?.ok) {
        setServerWorkspace(data);
      } else {
        setLastServerError("Could not load workspace (sign in or try again).");
        setSyncStatus("error");
        return;
      }
      setSyncStatus("idle");
    } catch {
      setLastServerError("Network error loading workspace.");
      setSyncStatus("error");
    }
  }, [profile.taxYear]);

  useEffect(() => {
    void reloadFromServer();
  }, [reloadFromServer]);

  useEffect(() => {
    savePreAccountingProfile(profile);
  }, [profile]);

  const patchProfile = useCallback((patch: Partial<PreAccountingProfile>) => {
    setProfile((p) => ({ ...p, ...patch, updatedAt: new Date().toISOString() }));
  }, []);

  const refreshProfile = useCallback(() => {
    setProfile(loadPreAccountingProfile());
  }, []);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setSyncStatus("saving");
        setLastServerError(null);
        const ledger = readTransactionSnapshotFromLocalStorage();
        const res = await savePreAccountingWorkspace(profile, ledger);
        if (res?.ok) {
          setServerWorkspace(res);
          setLastServerError(null);
          setSyncStatus("idle");
        } else if (res && res.ok === false && "gate" in res && res.gate) {
          setLastServerError(res.error ?? "Readiness gate not satisfied — resolve blockers or add an override note.");
          setSyncStatus("error");
        } else {
          setLastServerError("Could not save to server (cached locally).");
          setSyncStatus("error");
        }
      })();
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [profile]);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      patchProfile,
      refreshProfile,
      workspaceSection,
      setWorkspaceSection,
      serverWorkspace,
      syncStatus,
      lastServerError,
      reloadFromServer,
    }),
    [
      profile,
      patchProfile,
      refreshProfile,
      workspaceSection,
      serverWorkspace,
      syncStatus,
      lastServerError,
      reloadFromServer,
    ]
  );

  return (
    <AccountingPreAccountingContext.Provider value={value}>{children}</AccountingPreAccountingContext.Provider>
  );
}

export function useAccountingPreAccounting() {
  const x = useContext(AccountingPreAccountingContext);
  if (!x) throw new Error("useAccountingPreAccounting requires AccountingPreAccountingProvider");
  return x;
}

export function useOptionalAccountingPreAccounting(): Ctx | null {
  return useContext(AccountingPreAccountingContext);
}

export function useAccountingWorkspaceSection(): AccountingWorkspaceSection {
  return useOptionalAccountingPreAccounting()?.workspaceSection ?? "overview";
}
