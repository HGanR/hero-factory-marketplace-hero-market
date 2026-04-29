"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { getMockAdvisorSuggestions, type AdvisorContext } from "./mockAi";

type Props = {
  context: AdvisorContext;
};

export function AIAdvisorPanel({ context }: Props) {
  const suggestions = useMemo(() => getMockAdvisorSuggestions(context), [context]);

  return (
    <aside className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/50 to-slate-950/80 p-4 h-fit sticky top-4">
      <div className="flex items-center gap-2 text-violet-200 mb-3">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">AI Advisor</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 ml-auto">Simulated</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Context-aware hints based on your current step and inputs. Will connect to internal AI services later.
      </p>
      <ul className="space-y-2">
        {suggestions.map((line, i) => (
          <li
            key={i}
            className="text-sm text-slate-200 leading-relaxed pl-3 border-l-2 border-violet-500/40"
          >
            {line}
          </li>
        ))}
      </ul>
    </aside>
  );
}
