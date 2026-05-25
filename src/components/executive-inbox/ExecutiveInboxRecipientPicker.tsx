"use client";

import { useMemo } from "react";

export type ExecutiveInboxRecipient = { id: number; username: string; email: string };

type Props = {
  recipients: ExecutiveInboxRecipient[];
  broadcast: boolean;
  onBroadcastChange: (broadcast: boolean) => void;
  target: number | "";
  onTargetChange: (target: number | "") => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  className?: string;
};

export function ExecutiveInboxRecipientPicker({
  recipients,
  broadcast,
  onBroadcastChange,
  target,
  onTargetChange,
  filter,
  onFilterChange,
  className = "",
}: Props) {
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = recipients;
    if (q) {
      list = recipients.filter(
        (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    if (typeof target === "number") {
      const selected = recipients.find((u) => u.id === target);
      if (selected && !list.some((u) => u.id === selected.id)) {
        list = [selected, ...list];
      }
    }
    return list;
  }, [recipients, filter, target]);

  return (
    <div className={`space-y-2 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 ${className}`}>
      <div className="text-xs font-semibold text-amber-200/90">Executive send — choose audience</div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={broadcast}
          onChange={(e) => {
            const on = e.target.checked;
            onBroadcastChange(on);
            if (on) {
              onFilterChange("");
              onTargetChange("");
            }
          }}
        />
        Broadcast to all approved accounts
      </label>
      {!broadcast ? (
        <>
          <p className="text-[10px] text-slate-500">
            Direct message to one approved, active account ({recipients.length} in list).
          </p>
          <input
            type="search"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter by username or email…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm placeholder:text-slate-600"
            autoComplete="off"
          />
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={target === "" ? "" : String(target)}
            onChange={(e) => onTargetChange(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select recipient…</option>
            {filtered.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.email}) — id {u.id}
              </option>
            ))}
          </select>
          {filter.trim() && filtered.length === 0 ? (
            <p className="text-[10px] text-amber-300/90">No accounts match that filter.</p>
          ) : null}
          {target === "" ? (
            <p className="text-[10px] text-amber-300/80">Select a recipient before sending a direct message.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
