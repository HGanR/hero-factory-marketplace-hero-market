"use client";

import type { FinancialReadinessAction } from "./state";
import { addDaysIso, snoozeFromDueOrToday, uniqTag } from "./followUpHelpers";

type Props = {
  variant: "document" | "case";
  id: string;
  followUpDueAt: string | null;
  tags: string[];
  dispatch: (a: FinancialReadinessAction) => void;
  today: string;
};

export function FollowUpPanel({ variant, id, followUpDueAt, tags, dispatch, today }: Props) {
  const title = variant === "document" ? "Follow-up (document)" : "Follow-up (matter)";

  const setDue = (v: string | null) => {
    if (variant === "document") {
      dispatch({ type: "documents/patch", id, patch: { followUpDueAt: v } });
    } else {
      dispatch({ type: "cases/patch", id, patch: { followUpDueAt: v } });
    }
  };

  const snooze = (days: number) => {
    setDue(snoozeFromDueOrToday(followUpDueAt, days, today));
  };

  const markComplete = () => {
    const nextTags = uniqTag(tags, "follow_up_done");
    if (variant === "document") {
      dispatch({
        type: "documents/patch",
        id,
        patch: { followUpDueAt: null, tags: nextTags },
      });
    } else {
      dispatch({
        type: "cases/patch",
        id,
        patch: { followUpDueAt: null, tags: nextTags },
      });
    }
  };

  const resetFromToday = () => {
    setDue(addDaysIso(today, 0));
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <label className="block text-xs text-slate-500">
        Follow-up date
        <input
          type="date"
          className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          value={followUpDueAt ?? ""}
          onChange={(e) => setDue(e.target.value || null)}
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] uppercase text-slate-500 w-full">Snooze</span>
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => snooze(d)}
            className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:border-cyan-500/35"
          >
            +{d}d
          </button>
        ))}
        <button
          type="button"
          onClick={resetFromToday}
          className="rounded-md border border-white/12 px-2 py-1 text-xs text-slate-400 hover:border-slate-500/40"
        >
          Today
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={markComplete}
          className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
        >
          Mark follow-up complete
        </button>
      </div>
    </div>
  );
}
