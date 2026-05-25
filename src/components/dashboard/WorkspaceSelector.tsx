"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchTrustRecordsMeActive,
  invalidateTrustRecordsMeActiveCache,
  type TrustRecordsMeActive as ServerActiveSnapshot,
} from "@/lib/trust-records-me-client";
import {
  CRM_ONLY_WORKSPACE_PREFIX,
  SMART_TRUST_PLATFORM_BINDING_KEY,
  SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT,
  isCrmOnlyWorkspaceId,
  loadSmartTrustPlatformBinding as loadBinding,
  saveSmartTrustPlatformBinding as saveBinding,
  workspaceLabelFromList,
  type SmartTrustPlatformBinding as Binding,
} from "@/lib/smart-trust-platform-binding";
import { getSelectedClientId, setSelectedClientId } from "@/lib/client-context/selected-client";

type Workspace = {
  id: string;
  name: string;
  kind?: "trust" | "crm_client" | "hub_account" | string;
  trustType?: string | null;
  jurisdictionState?: string | null;
  clientId?: string | null;
  workspaceStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function WorkspaceSelector() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState<Binding>(() => loadBinding());
  const [pendingSwitch, setPendingSwitch] = useState<Workspace | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  /** `null` = not loaded yet; object = last GET /api/trust-records/me active payload */
  const [serverSnapshot, setServerSnapshot] = useState<ServerActiveSnapshot | null>(null);
  const [serverMeLoaded, setServerMeLoaded] = useState(false);
  const [coherenceBusy, setCoherenceBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetWorkspace, setDeleteTargetWorkspace] = useState<Workspace | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const refreshBinding = useCallback(() => {
    setBinding(loadBinding());
  }, []);

  const refetchServerSnapshot = useCallback(
    async (opts?: { force?: boolean }): Promise<ServerActiveSnapshot | null> => {
      try {
        const snap = await fetchTrustRecordsMeActive(opts?.force ? { force: true } : undefined);
        setServerSnapshot(snap);
        setServerMeLoaded(true);
        return snap;
      } catch {
        setServerSnapshot(null);
        setServerMeLoaded(true);
        return null;
      }
    },
    []
  );

  const reloadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/trust-records/workspaces", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.workspaces)) setWorkspaces(data.workspaces);
      }
    } catch {
      /* keep list */
    }
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!pickerOpen) return;
      if (pickerRef.current && e.target instanceof Node && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pickerOpen]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadingTimeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 7000);
    async function fetchWorkspaces() {
      try {
        const res = await fetch("/api/trust-records/workspaces", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) {
          if (!cancelled) setWorkspaces([]);
          void refetchServerSnapshot();
          return;
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data.workspaces)) {
          setWorkspaces(data.workspaces);
        }
        if (!cancelled && res.ok) {
          const snap = await Promise.race([
            refetchServerSnapshot(),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
          ]);
          const b = loadBinding();
          if (!b.trustId && snap?.trustId) {
            saveBinding({
              trustId: snap.trustId,
              clientId: snap.clientId,
            });
            refreshBinding();
            void refetchServerSnapshot();
          }
        }
      } catch {
        if (!cancelled) setWorkspaces([]);
        void refetchServerSnapshot();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchWorkspaces();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(loadingTimeout);
    };
  }, [refetchServerSnapshot, refreshBinding]);

  useEffect(() => {
    const onClientCreated = () => {
      void (async () => {
        await reloadWorkspaces();
        invalidateTrustRecordsMeActiveCache({ notify: true });
      })();
    };
    window.addEventListener("hf-clients-created", onClientCreated);
    return () => window.removeEventListener("hf-clients-created", onClientCreated);
  }, [reloadWorkspaces]);

  useEffect(() => {
    refreshBinding();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SMART_TRUST_PLATFORM_BINDING_KEY || e.key === null) refreshBinding();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, refreshBinding);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, refreshBinding);
    };
  }, [refreshBinding]);

  useEffect(() => {
    const b = loadBinding();
    const cid = b.clientId?.trim() || "";
    if (cid && !getSelectedClientId()) setSelectedClientId(cid);
  }, []);

  function handleSelect(value: string) {
    setPickerOpen(false);
    const workspace = workspaces.find((w) => w.id === value);
    if (!workspace) return;

    const hasCurrentWorkspace = !!binding.trustId;
    const isSameWorkspace = binding.trustId === workspace.id;
    if (isSameWorkspace) return;

    if (hasCurrentWorkspace) {
      setPendingSwitch(workspace);
      setConfirmOpen(true);
    } else {
      void applySwitch(workspace);
    }
  }

  async function confirmDeleteCrmClient() {
    const w = deleteTargetWorkspace;
    const cid = w?.clientId;
    if (!w || !cid || !isCrmFileWorkspace(w)) return;
    setDeleteBusy(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(cid)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setSyncError(t || `Delete failed (${res.status})`);
        return;
      }
      setDeleteConfirmOpen(false);
      setDeleteTargetWorkspace(null);
      setDeleteTargetId(null);
      const b = loadBinding();
      if (b.clientId === cid && b.trustId === w.id) {
        saveBinding({ clientId: null, trustId: null });
        refreshBinding();
      }
      await reloadWorkspaces();
      await refetchServerSnapshot({ force: true });
    } catch {
      setSyncError("Network error while deleting client file.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function isCrmFileWorkspace(w: Workspace): boolean {
    return w.kind === "crm_client" || w.id.startsWith(CRM_ONLY_WORKSPACE_PREFIX);
  }

  async function applySwitch(workspace: Workspace) {
    setSyncError(null);
    setSwitchBusy(true);
    try {
      if (isCrmFileWorkspace(workspace) && workspace.clientId) {
        saveBinding({
          clientId: workspace.clientId,
          trustId: workspace.id,
        });
        invalidateTrustRecordsMeActiveCache();
        refreshBinding();
        setPendingSwitch(null);
        setConfirmOpen(false);
        await refetchServerSnapshot({ force: true });
        return;
      }

      const res = await fetch("/api/trust-records/active", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustId: workspace.id,
          ...(workspace.clientId ? { clientId: workspace.clientId } : {}),
          source: "dashboard",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || data.ok !== true) {
        setSyncError(data?.error?.message ?? "Could not set active workspace on the server.");
        return;
      }
      invalidateTrustRecordsMeActiveCache();
      saveBinding({
        clientId: workspace.clientId ?? null,
        trustId: workspace.id,
      });
      refreshBinding();
      setPendingSwitch(null);
      setConfirmOpen(false);
      await refetchServerSnapshot({ force: true });
    } catch {
      setSyncError("Network error while setting active workspace.");
    } finally {
      setSwitchBusy(false);
    }
  }

  async function alignBrowserWithServerActiveTrust() {
    if (!serverSnapshot?.trustId) return;
    setCoherenceBusy(true);
    setSyncError(null);
    try {
      saveBinding({
        trustId: serverSnapshot.trustId,
        clientId: serverSnapshot.clientId,
      });
      refreshBinding();
      await refetchServerSnapshot({ force: true });
    } finally {
      setCoherenceBusy(false);
    }
  }

  async function keepLocalSelectionAsServerActive() {
    const tid = binding.trustId;
    if (!tid || isCrmOnlyWorkspaceId(tid)) return;
    const workspace = workspaces.find((w) => w.id === tid);
    setCoherenceBusy(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/trust-records/active", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustId: tid,
          ...(workspace?.clientId ? { clientId: workspace.clientId } : {}),
          source: "dashboard",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || data.ok !== true) {
        setSyncError(data?.error?.message ?? "Could not align server with this workspace.");
        return;
      }
      invalidateTrustRecordsMeActiveCache();
      await refetchServerSnapshot({ force: true });
    } catch {
      setSyncError("Network error while updating server active workspace.");
    } finally {
      setCoherenceBusy(false);
    }
  }

  const trustCoherenceMismatch =
    !isCrmOnlyWorkspaceId(binding.trustId) &&
    serverMeLoaded &&
    serverSnapshot !== null &&
    (() => {
      const loc = binding.trustId ?? "";
      const srv = serverSnapshot.trustId ?? "";
      if (loc === srv) return false;
      if (!loc && !srv) return false;
      return true;
    })();

  function handleCancelSwitch() {
    setPendingSwitch(null);
    setConfirmOpen(false);
  }

  function handleGoToTrustRecords() {
    setConfirmOpen(false);
    setPendingSwitch(null);
    const tid = binding.trustId;
    if (isCrmOnlyWorkspaceId(tid) && binding.clientId) {
      window.location.href = `/clients/${encodeURIComponent(binding.clientId)}`;
      return;
    }
    window.location.href = tid
      ? `/trust-records?trustId=${encodeURIComponent(tid!)}&tab=settings`
      : "/trust-records?tab=settings";
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="workspace-select" className="text-sm text-slate-400 whitespace-nowrap">
          Workspace:
        </label>
        <div className="relative z-20" ref={pickerRef}>
          <Button
            type="button"
            id="workspace-select"
            variant="outline"
            disabled={loading || switchBusy || coherenceBusy}
            onClick={() => setPickerOpen((o) => !o)}
            className="w-[min(100vw,260px)] h-9 justify-between border-cyan-500/30 bg-white/[0.05] backdrop-blur-xl px-3 font-normal text-slate-200 hover:bg-white/[0.08]"
            style={{ boxShadow: "0 0 0 1px rgba(0,209,255,0.15)" }}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            {loading ? (
              <span className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              <span className="truncate text-left text-sm">
                {workspaceLabelFromList(workspaces, binding.trustId) ?? "Select workspace…"}
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
          {pickerOpen && !loading ? (
            <ul
              className="absolute left-0 top-full z-50 mt-1 w-[min(100vw,26rem)] rounded-md border border-cyan-500/25 bg-slate-950/98 p-0 shadow-xl max-h-80 overflow-y-auto"
              role="listbox"
            >
              {workspaces.length === 0 ? (
                <li className="px-3 py-4 text-sm text-slate-400 text-center">No workspaces yet</li>
              ) : (
                workspaces.map((w) => {
                  const isCrm = w.kind === "crm_client" && w.clientId;
                  return (
                    <li
                      key={w.id}
                      className="flex items-center gap-1.5 border-b border-white/[0.06] px-2 py-1.5 last:border-0"
                    >
                      {isCrm ? (
                        <input
                          type="radio"
                          name="ws-delete-arm"
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-cyan-500"
                          checked={deleteTargetId === w.id}
                          onChange={() => setDeleteTargetId(w.id)}
                          onClick={(e) => e.stopPropagation()}
                          title="Select to enable Delete for this client file"
                          aria-label="Select for delete"
                        />
                      ) : (
                        <span className="w-3.5 shrink-0" aria-hidden />
                      )}
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-sm text-slate-200 hover:bg-white/[0.06] hover:text-cyan-200"
                        onClick={() => handleSelect(w.id)}
                      >
                        {w.name}
                      </button>
                      {isCrm ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-rose-400/95 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
                          disabled={deleteTargetId !== w.id || deleteBusy}
                          title={
                            deleteTargetId !== w.id
                              ? "Select the radio next to this row to enable delete"
                              : "Delete client file"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (deleteTargetId !== w.id) return;
                            setDeleteTargetWorkspace(w);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="h-7 w-7 shrink-0" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
        {workspaces.length === 0 && !loading && (
          <Link
            href="/trust-records?tab=settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Create workspace
          </Link>
        )}
        {binding.trustId ? (
          <div className="flex flex-wrap items-center gap-2 border-l border-white/10 pl-3 ml-1">
            {!isCrmOnlyWorkspaceId(binding.trustId) ? (
              <>
                <Link
                  href={`/trust-records?trustId=${encodeURIComponent(binding.trustId)}&tab=settings`}
                  className="text-xs font-medium text-slate-300 underline-offset-2 hover:text-cyan-300 hover:underline"
                >
                  Trust Records
                </Link>
                <span className="text-slate-600">·</span>
                <Link
                  href={`/trust-records/jarva?trustId=${encodeURIComponent(binding.trustId)}`}
                  className="text-xs font-medium text-emerald-300/90 underline-offset-2 hover:text-emerald-200 hover:underline"
                >
                  Jarva
                </Link>
                {binding.clientId ? <span className="text-slate-600">·</span> : null}
              </>
            ) : (
              <span className="text-[10px] text-slate-500 max-w-[140px]">
                Client file (add a trust anytime from the client profile) ·
              </span>
            )}
            {binding.clientId ? (
              <Link
                href={`/clients/${encodeURIComponent(binding.clientId)}`}
                className="text-xs font-medium text-slate-300 underline-offset-2 hover:text-cyan-300 hover:underline"
              >
                Open client
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {serverMeLoaded && !trustCoherenceMismatch && serverSnapshot !== null && binding.trustId && serverSnapshot.trustId ? (
        <p className="mt-1 max-w-xl text-[10px] text-slate-500">
          Browser workspace matches server active trust.
        </p>
      ) : null}

      {trustCoherenceMismatch ? (
        <div
          className={cn(
            "mt-2 max-w-xl rounded-md border border-sky-500/25 bg-sky-950/30 px-3 py-2 text-[11px] leading-snug text-sky-100/90"
          )}
          role="status"
        >
          <p className="font-medium text-sky-200/95">Workspace selection differs from server</p>
          <p className="mt-1 text-sky-200/75">
            <span className="text-sky-400/80">This browser:</span>{" "}
            {workspaceLabelFromList(workspaces, binding.trustId) ?? "(none)"}{" "}
            <span className="font-mono text-[10px] text-slate-400">
              {binding.trustId ? `(${binding.trustId.slice(0, 8)}…)` : ""}
            </span>
          </p>
          <p className="mt-0.5 text-sky-200/75">
            <span className="text-sky-400/80">Server active:</span>{" "}
            {workspaceLabelFromList(workspaces, serverSnapshot?.trustId ?? null) ?? "(none)"}{" "}
            <span className="font-mono text-[10px] text-slate-400">
              {serverSnapshot?.trustId ? `(${serverSnapshot.trustId.slice(0, 8)}…)` : ""}
            </span>
          </p>
          <p className="mt-1.5 text-sky-300/70">
            Trust Records, Jarva, and Smart Trust links use your browser selection above. Choose how to align.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={coherenceBusy || !serverSnapshot?.trustId}
              className="h-7 border-sky-600/50 bg-sky-900/50 text-[11px] text-sky-100 hover:bg-sky-800/60"
              onClick={() => void alignBrowserWithServerActiveTrust()}
            >
              {coherenceBusy ? "Updating…" : "Use server active trust"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={coherenceBusy || !binding.trustId || isCrmOnlyWorkspaceId(binding.trustId)}
              className="h-7 border-sky-500/40 bg-transparent text-[11px] text-sky-200 hover:bg-sky-950/80"
              onClick={() => void keepLocalSelectionAsServerActive()}
            >
              {coherenceBusy ? "Updating…" : "Keep local selection (update server)"}
            </Button>
          </div>
        </div>
      ) : null}

      {syncError ? <p className="text-xs text-amber-400/90">{syncError}</p> : null}

      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmOpen(false);
            setDeleteTargetWorkspace(null);
          }
        }}
      >
        <DialogContent
          className="border-slate-800 bg-slate-950/95 backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(244,63,94,0.25), 0 0 40px rgba(0,0,0,0.5)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">Delete this client file?</DialogTitle>
            <DialogDescription className="text-slate-400">
              This removes the CRM client record
              {deleteTargetWorkspace?.name ? ` “${deleteTargetWorkspace.name}”` : ""} and its Client Hub row. Trust
              workspaces are not deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteTargetWorkspace(null);
              }}
              className="border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteCrmClient()}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && handleCancelSwitch()}>
        <DialogContent
          className="border-slate-800 bg-slate-950/95 backdrop-blur-xl"
          style={{
            boxShadow: "0 0 0 1px rgba(0,209,255,0.2), 0 0 40px rgba(0,0,0,0.5)",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Save before switching?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Switching workspaces will change your active context. Any unsaved work in Trust
              Records, Site Builder, AI Agents, or other apps may be lost. Save your work in
              Trust Records first, or continue to switch anyway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelSwitch}
              className="border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGoToTrustRecords}
              className="border-cyan-500/50 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
            >
              Go to Trust Records
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={switchBusy}
              onClick={() => pendingSwitch && void applySwitch(pendingSwitch)}
              className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              {switchBusy ? "Switching…" : "Switch anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
