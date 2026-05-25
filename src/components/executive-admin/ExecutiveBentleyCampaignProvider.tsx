"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AiRevenueOsSharedStateProvider, useAiRevenueOsBentleyActions } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { BentleyPersistedSnapshotHydration } from "@/components/ai-revenue-os/BentleyPersistedSnapshotHydration";
import { createBentleyActionRunner } from "@/lib/revenue-os/bentley-action-runner";
import { emitBentleyPipelineProgress } from "@/lib/revenue-os/bentley-pipeline-progress";
import { setBentleyStorageScope, BENTLEY_SCOPE_DEFAULT_CLIENT } from "@/lib/revenue-os/bentley-storage-scope";
import { persistExecutiveBentleySnapshot } from "@/lib/revenue-os/executive-bentley-campaign-memory";
import {
  readExecutiveBentleySession,
  startExecutiveBentleySession,
  touchExecutiveBentleySession,
} from "@/lib/revenue-os/executive-bentley-session";
import {
  tryExecutiveBentleyClientVoiceTurn,
  type ExecutiveBentleyVoiceTurnResult,
} from "@/lib/revenue-os/executive-bentley-voice-orchestrator";
import {
  setExecutiveBentleyPipelineRunner,
  setExecutiveBentleyVoiceHandler,
} from "@/lib/revenue-os/executive-bentley-voice-bridge";
import { getResolvedUserIdFromStorage } from "@/lib/revenue-os/bentley-user-session";

type ExecutiveBentleyCampaignContextValue = {
  campaignModeActive: boolean;
  intakeActive: boolean;
  pipelineBusy: boolean;
  activateCampaignMode: () => void;
  handleVoiceTurn: (transcript: string) => ExecutiveBentleyVoiceTurnResult;
  runPipeline: () => Promise<void>;
};

const ExecutiveBentleyCampaignCtx = createContext<ExecutiveBentleyCampaignContextValue | null>(null);

function ExecutiveBentleyScopeSync({
  adminUserId,
  clientId,
}: {
  adminUserId: string;
  clientId: string;
}) {
  useEffect(() => {
    const cid = clientId.trim() || BENTLEY_SCOPE_DEFAULT_CLIENT;
    setBentleyStorageScope({ userId: adminUserId, clientId: cid });
  }, [adminUserId, clientId]);
  return null;
}

function ExecutiveBentleyCampaignInner({
  children,
  adminUserId,
  clientId,
  pendingApprovals,
  content360Configured,
  campaignModeActive,
  setCampaignModeActive,
}: {
  children: ReactNode;
  adminUserId: string;
  clientId: string;
  pendingApprovals?: number | null;
  content360Configured?: boolean;
  campaignModeActive: boolean;
  setCampaignModeActive: (v: boolean) => void;
}) {
  const { getBentleySnapshot, applyBentleyPatch } = useAiRevenueOsBentleyActions();
  const [intakeActive, setIntakeActive] = useState(false);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const getSnapRef = useRef(getBentleySnapshot);
  getSnapRef.current = getBentleySnapshot;
  const applyRef = useRef(applyBentleyPatch);
  applyRef.current = applyBentleyPatch;

  useEffect(() => {
    const session = readExecutiveBentleySession();
    if (session) {
      setIntakeActive(session.intakeActive);
    }
  }, [campaignModeActive]);

  const activateCampaignMode = useCallback(() => {
    setCampaignModeActive(true);
    startExecutiveBentleySession({
      adminUserId,
      clientId: clientId.trim() || BENTLEY_SCOPE_DEFAULT_CLIENT,
      intakeActive: true,
    });
    setIntakeActive(true);
  }, [adminUserId, clientId, setCampaignModeActive]);

  const runPipeline = useCallback(async () => {
    if (pipelineBusy) return;
    setPipelineBusy(true);
    touchExecutiveBentleySession({ mode: "pipeline", intakeActive: false });
    setIntakeActive(false);
    try {
      const runner = createBentleyActionRunner({
        getSnapshot: () => getSnapRef.current(),
        applyPatch: (patch, q) => applyRef.current(patch, q),
        userId: adminUserId,
        clientId: clientId.trim() || undefined,
        onPipelineProgress: (detail) => emitBentleyPipelineProgress(detail),
      });
      emitBentleyPipelineProgress({
        mode: "running",
        activePhase: "research",
        completedPhases: [],
        statusLine: "Executive desk — running Bentley pipeline…",
      });
      const result = await runner.runFullPipeline();
      const completedPhases = result.workflow?.completed
        ? (Object.keys(result.workflow.completed).filter(
            (k) => result.workflow!.completed![k as keyof typeof result.workflow.completed],
          ) as import("@/lib/revenue-os/bentley-workflow").BentleyWorkflowPhaseId[])
        : [];
      emitBentleyPipelineProgress({
        mode: result.ok ? "complete" : "failed",
        activePhase: null,
        completedPhases,
        statusLine: result.ok
          ? "Pipeline complete — review campaign outputs and approval queue."
          : `Pipeline stopped: ${result.reason ?? "unknown error"}`,
        failedPhase: result.ok ? undefined : result.workflow?.lastFailedPhase ?? undefined,
        errorMessage: result.reason,
      });
      persistExecutiveBentleySnapshot(getSnapRef.current());
      touchExecutiveBentleySession({ mode: "review" });
    } finally {
      setPipelineBusy(false);
    }
  }, [adminUserId, clientId, pipelineBusy]);

  const handleVoiceTurn = useCallback(
    (transcript: string): ExecutiveBentleyVoiceTurnResult => {
      const result = tryExecutiveBentleyClientVoiceTurn({
        transcript,
        getSnapshot: () => getSnapRef.current(),
        adminUserId,
        clientId: clientId.trim() || BENTLEY_SCOPE_DEFAULT_CLIENT,
        intakeActive,
        campaignModeActive,
        pendingApprovals,
        content360Configured,
      });
      if (result.activateCampaignMode) setCampaignModeActive(true);
      if (result.patch) {
        applyRef.current(result.patch, result.questionnairePatch);
        persistExecutiveBentleySnapshot(getSnapRef.current());
      }
      if (result.requestPipelineRun) {
        void runPipeline();
      }
      if (result.handled) {
        const session = readExecutiveBentleySession();
        if (session) setIntakeActive(session.intakeActive);
      }
      return result;
    },
    [
      adminUserId,
      clientId,
      intakeActive,
      campaignModeActive,
      pendingApprovals,
      content360Configured,
      runPipeline,
      setCampaignModeActive,
    ],
  );

  useEffect(() => {
    setExecutiveBentleyVoiceHandler(handleVoiceTurn);
    setExecutiveBentleyPipelineRunner(runPipeline);
    return () => {
      setExecutiveBentleyVoiceHandler(null);
      setExecutiveBentleyPipelineRunner(null);
    };
  }, [handleVoiceTurn, runPipeline]);

  const value = useMemo(
    () => ({
      campaignModeActive,
      intakeActive,
      pipelineBusy,
      activateCampaignMode,
      handleVoiceTurn,
      runPipeline,
    }),
    [campaignModeActive, intakeActive, pipelineBusy, activateCampaignMode, handleVoiceTurn, runPipeline],
  );

  return (
    <ExecutiveBentleyCampaignCtx.Provider value={value}>
      <ExecutiveBentleyScopeSync adminUserId={adminUserId} clientId={clientId} />
      <BentleyPersistedSnapshotHydration />
      {children}
    </ExecutiveBentleyCampaignCtx.Provider>
  );
}

export function ExecutiveBentleyCampaignProvider({
  children,
  adminUserId,
  clientId,
  pendingApprovals,
  content360Configured,
  campaignModeActive,
  setCampaignModeActive,
}: {
  children: ReactNode;
  adminUserId: string;
  clientId: string;
  pendingApprovals?: number | null;
  content360Configured?: boolean;
  campaignModeActive: boolean;
  setCampaignModeActive: (v: boolean) => void;
}) {
  const uid = adminUserId.trim() || getResolvedUserIdFromStorage();

  return (
    <AiRevenueOsSharedStateProvider>
      <ExecutiveBentleyCampaignInner
        adminUserId={uid}
        clientId={clientId}
        pendingApprovals={pendingApprovals}
        content360Configured={content360Configured}
        campaignModeActive={campaignModeActive}
        setCampaignModeActive={setCampaignModeActive}
      >
        {children}
      </ExecutiveBentleyCampaignInner>
    </AiRevenueOsSharedStateProvider>
  );
}

export function useExecutiveBentleyCampaign(): ExecutiveBentleyCampaignContextValue {
  const ctx = useContext(ExecutiveBentleyCampaignCtx);
  if (!ctx) {
    return {
      campaignModeActive: false,
      intakeActive: false,
      pipelineBusy: false,
      activateCampaignMode: () => {},
      handleVoiceTurn: () => ({ handled: false, answer: "" }),
      runPipeline: async () => {},
    };
  }
  return ctx;
}
