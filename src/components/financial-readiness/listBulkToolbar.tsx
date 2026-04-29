"use client";

type VaultProps = {
  variant: "vault";
  selectedCount: number;
  filteredCount: number;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onMarkCompleted: () => void;
  onSnooze7: () => void;
  onAddTag: () => void;
  onExport: () => void;
  onUndo?: () => void;
  undoAvailable?: boolean;
  matterOptions: { id: string; label: string }[];
  assignCaseId: string;
  onAssignCaseIdChange: (id: string) => void;
  onAssignToMatter: () => void;
};

type CasesProps = {
  variant: "cases";
  selectedCount: number;
  filteredCount: number;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onMarkCompleted: () => void;
  onSnooze7: () => void;
  onAddTag: () => void;
  onExport: () => void;
  onUndo?: () => void;
  undoAvailable?: boolean;
};

export function ListBulkToolbar(props: VaultProps | CasesProps) {
  const undoOnly =
    props.selectedCount === 0 && Boolean(props.onUndo) && Boolean(props.undoAvailable);

  if (props.selectedCount === 0 && !undoOnly) return null;

  if (undoOnly && props.onUndo) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-950/30 px-3 py-2 text-xs">
        <span className="text-slate-400">Last bulk action can be undone.</span>
        <button
          type="button"
          className="rounded-md border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-violet-100"
          onClick={props.onUndo}
        >
          Undo last bulk
        </button>
      </div>
    );
  }

  const base = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-xs">
      <span className="text-slate-300 font-medium">
        {props.selectedCount} selected{props.filteredCount ? ` · ${props.filteredCount} visible` : ""}
      </span>
      <button
        type="button"
        className="rounded-md border border-white/15 px-2 py-1 text-slate-300 hover:border-cyan-500/40"
        onClick={props.onSelectAllFiltered}
      >
        Select visible
      </button>
      <button
        type="button"
        className="rounded-md border border-white/15 px-2 py-1 text-slate-400 hover:border-white/30"
        onClick={props.onClearSelection}
      >
        Clear
      </button>
      <span className="text-slate-600">|</span>
      <button
        type="button"
        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-100"
        onClick={props.onMarkCompleted}
      >
        Mark completed
      </button>
      <button
        type="button"
        className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-100"
        onClick={props.onSnooze7}
      >
        Snooze +7d
      </button>
      <button
        type="button"
        className="rounded-md border border-white/15 px-2 py-1 text-slate-200"
        onClick={props.onAddTag}
      >
        Add tag…
      </button>
      <button
        type="button"
        className="rounded-md border border-white/15 px-2 py-1 text-slate-200"
        onClick={props.onExport}
      >
        Export selected
      </button>
      {props.onUndo && props.undoAvailable && (
        <button
          type="button"
          className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-100"
          onClick={props.onUndo}
        >
          Undo last bulk
        </button>
      )}
    </div>
  );

  if (props.variant === "cases") {
    return base;
  }

  const v = props as VaultProps;
  return (
    <div className="space-y-2">
      {base}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="text-slate-500 flex items-center gap-2">
          Assign to matter
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
            value={v.assignCaseId}
            onChange={(e) => v.onAssignCaseIdChange(e.target.value)}
          >
            <option value="">Choose matter…</option>
            {v.matterOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!v.assignCaseId}
          className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-cyan-100 disabled:opacity-40"
          onClick={v.onAssignToMatter}
        >
          Assign
        </button>
      </div>
    </div>
  );
}
