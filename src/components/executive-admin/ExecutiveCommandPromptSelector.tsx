"use client";

import {
  EXECUTIVE_COMMAND_CATEGORY_LABEL,
  EXECUTIVE_COMMAND_PROMPTS,
  executiveCommandPromptLabel,
  executiveCommandPromptsByCategory,
  type ExecutiveCommandPromptId,
} from "@/lib/executive-agent/executive-command-prompts";

type Props = {
  value: ExecutiveCommandPromptId | null;
  onChange: (id: ExecutiveCommandPromptId) => void;
};

export function ExecutiveCommandPromptSelector({ value, onChange }: Props) {
  const grouped = executiveCommandPromptsByCategory();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#00A3FF]/25 bg-[#000814]/90 px-3 py-2 shadow-[inset_0_0_24px_rgba(0,163,255,0.05)]">
      <label className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#00A3FF]/80">
        Executive command prompts
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value as ExecutiveCommandPromptId;
          if (v) onChange(v);
        }}
        className="min-w-[12rem] flex-1 rounded-lg border border-[#00A3FF]/30 bg-[#00050A] px-2 py-1.5 text-[11px] font-medium text-[#00A3FF] outline-none focus:border-[#00A3FF]/60"
      >
        <option value="">Select a command module…</option>
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => (
          <optgroup key={cat} label={EXECUTIVE_COMMAND_CATEGORY_LABEL[cat]}>
            {grouped[cat].map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="hidden text-[10px] text-slate-500 sm:inline">
        {value
          ? EXECUTIVE_COMMAND_PROMPTS.find((p) => p.id === value)?.description
          : "Choose a module or speak to Skipper"}
      </span>
      {value ? (
        <span className="rounded-full border border-[#00A3FF]/30 bg-[#00A3FF]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#00A3FF]">
          {executiveCommandPromptLabel(value)}
        </span>
      ) : null}
    </div>
  );
}
