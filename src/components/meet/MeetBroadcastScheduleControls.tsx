"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BroadcastScheduleSummary } from "@/hooks/useMeetBroadcast";
import type { BroadcastCountdownConfig, BroadcastScheduledAction, BroadcastScheduleState } from "@/lib/meet/broadcast-schedule";
import { BroadcastCountdownEditor } from "./BroadcastCountdownEditor";
import { BroadcastScheduledActionsEditor } from "./BroadcastScheduledActionsEditor";

function isScheduleState(v: unknown): v is BroadcastScheduleState {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.broadcastSessionId === "number" && typeof o.automationEnabled === "boolean" && o.countdown != null;
}

export function MeetBroadcastScheduleControls({
  broadcastSessionId,
  hostWalletAddress: _hostWalletAddress,
  templateActive,
  scheduleSummary,
  fetchScheduleState,
  updateScheduleState,
  resetScheduleState,
  realtimeSyncKey = 0,
}: {
  broadcastSessionId: number;
  hostWalletAddress: string;
  templateActive: boolean;
  scheduleSummary?: BroadcastScheduleSummary | null;
  realtimeSyncKey?: number;
  fetchScheduleState: (id: number) => Promise<{
    ok: boolean;
    state?: Record<string, unknown>;
    summary?: BroadcastScheduleSummary;
    persisted?: boolean;
    error?: string;
    code?: string;
  }>;
  updateScheduleState: (
    id: number,
    patch: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string; code?: string }>;
  resetScheduleState: (id: number) => Promise<{ ok: boolean; error?: string; code?: string }>;
}) {
  void _hostWalletAddress;
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [countdown, setCountdown] = useState<BroadcastCountdownConfig>({
    visible: false,
    position: "top_right",
  });
  const [actions, setActions] = useState<BroadcastScheduledAction[]>([]);
  const [lastSummary, setLastSummary] = useState<BroadcastScheduleSummary | null>(null);

  const syncFromServer = useCallback(async () => {
    const r = await fetchScheduleState(broadcastSessionId);
    if (!r.ok || !r.state || !isScheduleState(r.state)) return;
    const s = r.state;
    setAutomationEnabled(s.automationEnabled);
    setCountdown({ ...s.countdown });
    setActions([...s.actions]);
    if (r.summary) setLastSummary(r.summary);
  }, [broadcastSessionId, fetchScheduleState]);

  useEffect(() => {
    if (templateActive && broadcastSessionId) void syncFromServer();
  }, [templateActive, broadcastSessionId, syncFromServer, realtimeSyncKey]);

  useEffect(() => {
    if (scheduleSummary) setLastSummary(scheduleSummary);
  }, [scheduleSummary]);

  const onSaveCountdownAndAutomation = async () => {
    setBusy(true);
    setLocalErr(null);
    const r = await updateScheduleState(broadcastSessionId, {
      automationEnabled,
      countdown,
    });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Save failed");
    else await syncFromServer();
    setBusy(false);
  };

  const onSaveActions = async () => {
    setBusy(true);
    setLocalErr(null);
    const r = await updateScheduleState(broadcastSessionId, { actions });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Save failed");
    else await syncFromServer();
    setBusy(false);
  };

  const onReset = async () => {
    if (!confirm("Reset schedule state? Future automation stops; live scene and overlays are unchanged.")) return;
    setBusy(true);
    setLocalErr(null);
    const r = await resetScheduleState(broadcastSessionId);
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Reset failed");
    else await syncFromServer();
    setBusy(false);
  };

  if (!templateActive) {
    return (
      <div
        className="mt-3 rounded border border-slate-800 bg-slate-950/40 px-2 py-2 text-[11px] text-slate-500"
        data-testid="meet-broadcast-schedule-disabled"
      >
        Schedule, countdown, and timed automation are V2-only and require the rendered compositor template to be
        active.
      </div>
    );
  }

  const sum = lastSummary ?? scheduleSummary;

  return (
    <div
      className="mt-3 rounded border border-slate-700 bg-slate-950/50 px-2 py-2 space-y-2"
      data-testid="meet-broadcast-schedule-controls"
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Schedule & countdown (V2)</div>
      {sum ? (
        <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[10px] text-slate-400 space-y-0.5">
          <div>
            Automation:{" "}
            <span className={sum.automationEnabled ? "text-emerald-400" : "text-slate-500"}>
              {sum.automationEnabled ? "enabled" : "disabled"}
            </span>
          </div>
          <div>
            Countdown: {sum.countdownVisible ? "visible" : "hidden"}
            {sum.countdownTargetIso ? (
              <span className="text-slate-500"> · target {new Date(sum.countdownTargetIso).toLocaleString()}</span>
            ) : null}
          </div>
          <div>
            Next action:{" "}
            {sum.nextScheduledActionAt ? (
              <>
                <span className="text-slate-300">{sum.nextScheduledActionType}</span> @{" "}
                {new Date(sum.nextScheduledActionAt).toLocaleString()}
              </>
            ) : (
              <span className="text-slate-600">—</span>
            )}
          </div>
          <div>
            Last executed id:{" "}
            <span className="font-mono text-slate-300">{sum.lastExecutedActionId ?? "—"}</span>
          </div>
        </div>
      ) : null}
      {localErr ? <p className="text-[11px] text-red-300">{localErr}</p> : null}

      <label className="flex items-center gap-2 text-[11px] text-slate-200">
        <input
          type="checkbox"
          checked={automationEnabled}
          disabled={busy}
          onChange={(e) => setAutomationEnabled(e.target.checked)}
        />
        Enable timed automation (server evaluates on poll)
      </label>

      <BroadcastCountdownEditor
        value={countdown}
        disabled={busy}
        onChange={(patch) => setCountdown((c) => ({ ...c, ...patch }))}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded bg-violet-700 px-2 py-1 text-[11px] text-white hover:bg-violet-600 disabled:opacity-40"
          onClick={() => void onSaveCountdownAndAutomation()}
        >
          Save countdown & automation
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          onClick={() => void syncFromServer()}
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-red-800/60 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40 disabled:opacity-40"
          onClick={() => void onReset()}
        >
          Reset schedule
        </button>
      </div>

      <BroadcastScheduledActionsEditor actions={actions} disabled={busy} onChange={setActions} />
      <button
        type="button"
        disabled={busy}
        className="w-full rounded bg-slate-700 py-1 text-[11px] text-white hover:bg-slate-600 disabled:opacity-40"
        onClick={() => void onSaveActions()}
      >
        Save actions
      </button>
    </div>
  );
}
