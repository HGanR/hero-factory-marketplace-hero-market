"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { PublishApprovalReportSchedulePublic } from "@/lib/revenue-os/publish-approval-report-schedule";

type Props = {
  campaignId: string;
  /** From GET /api/campaigns/:id (null = never configured). */
  initialSchedule: PublishApprovalReportSchedulePublic | null;
  disabled?: boolean;
  /** Plan / entitlement gate — disables edits and API saves (Part 28). */
  planGated?: boolean;
  /** Parent can refetch campaign (e.g. bump workflow refresh nonce). */
  onDidMutate?: () => void;
};

export function PublishApprovalReportScheduleControls(props: Props) {
  const { campaignId, initialSchedule, disabled, planGated, onDidMutate } = props;
  const [enabled, setEnabled] = useState(initialSchedule?.enabled ?? false);
  const [frequency, setFrequency] = useState<"daily" | "weekly">(initialSchedule?.frequency ?? "weekly");
  const [format, setFormat] = useState<"json" | "csv">(initialSchedule?.format ?? "json");
  const [recipientMode, setRecipientMode] = useState<"owner_only" | "owner_and_admins">(
    initialSchedule?.recipientMode ?? "owner_only"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(initialSchedule?.enabled ?? false);
    setFrequency(initialSchedule?.frequency ?? "weekly");
    setFormat(initialSchedule?.format ?? "json");
    setRecipientMode(initialSchedule?.recipientMode ?? "owner_only");
  }, [campaignId, initialSchedule]);

  const formLocked = Boolean(disabled || planGated);

  const onSave = useCallback(async () => {
    if (!campaignId || formLocked) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          publishApprovalReportSchedule: {
            enabled,
            frequency,
            format,
            recipientMode,
          },
        }),
      });
      if (!res.ok) {
        toast.error("Could not save report schedule.");
        return;
      }
      toast.success("Report schedule saved.");
      onDidMutate?.();
    } finally {
      setSaving(false);
    }
  }, [campaignId, formLocked, enabled, frequency, format, recipientMode, onDidMutate]);

  const onClear = useCallback(async () => {
    if (!campaignId || formLocked) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publishApprovalReportSchedule: null }),
      });
      if (!res.ok) {
        toast.error("Could not clear report schedule.");
        return;
      }
      setEnabled(false);
      toast.success("Scheduled reports cleared.");
      onDidMutate?.();
    } finally {
      setSaving(false);
    }
  }, [campaignId, formLocked, onDidMutate]);

  if (!campaignId) return null;

  return (
    <div
      id="publish-approval-report-schedule"
      className="mt-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400"
      data-bentley-section="publish-approval-report-schedule"
    >
      <div className="font-medium text-slate-200">Scheduled compliance reports</div>
      {planGated ? (
        <p className="mt-1 text-[10px] text-amber-200/85" data-testid="publish-approval-report-schedule-plan-gated">
          Not available on the current plan. Available on higher plans.
        </p>
      ) : null}
      <p className="mt-0.5 text-[10px] text-slate-500">
        Sends an in-app reminder when a new report window opens (daily or weekly UTC). Export the file from the buttons
        above or the report API.
      </p>
      {initialSchedule?.lastDeliveredAt ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Last reminder: {new Date(initialSchedule.lastDeliveredAt).toLocaleString()}
        </p>
      ) : null}
      <label className="mt-2 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={formLocked || saving}
          className="rounded border-slate-600"
        />
        <span>Enable scheduled reminders</span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="flex items-center gap-1">
          <span className="text-slate-500">Frequency</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
            disabled={formLocked || saving}
            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-200"
          >
            <option value="daily">Daily (UTC day)</option>
            <option value="weekly">Weekly (UTC week)</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-slate-500">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "json" | "csv")}
            disabled={formLocked || saving}
            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-200"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-slate-500">Recipients</span>
          <select
            value={recipientMode}
            onChange={(e) => setRecipientMode(e.target.value as "owner_only" | "owner_and_admins")}
            disabled={formLocked || saving}
            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-200"
          >
            <option value="owner_only">Owner only</option>
            <option value="owner_and_admins">Owner + assigned reviewers</option>
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={formLocked || saving}
          className="rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
        <button
          type="button"
          onClick={() => void onClear()}
          disabled={formLocked || saving}
          className="rounded-md border border-slate-800 px-2 py-1 text-[10px] text-slate-500 hover:border-slate-600 hover:text-slate-300 disabled:opacity-50"
        >
          Clear schedule
        </button>
      </div>
    </div>
  );
}
