"use client";

import { useMemo, useState } from "react";
import { PenLine, Sparkles } from "lucide-react";

const ACCENT = "#00D1FF";

export function isBentleyPipelineNotesBlob(notes: string): boolean {
  const t = notes.trim();
  if (t.length < 80) return false;
  return (
    t.includes("## Context (Bentley pipeline)") ||
    t.includes("## Market Intelligence Sweep") ||
    (t.includes("## Research highlights") && t.includes("## Trend signals"))
  );
}

function splitMarkdownSections(md: string): { title: string; body: string }[] {
  const lines = md.split("\n");
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) {
        sections.push({ title: current.title, body: current.lines.join("\n").trim() });
      }
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    sections.push({ title: current.title, body: current.lines.join("\n").trim() });
  }
  return sections;
}

type Props = {
  notes: string;
  onEditRaw: () => void;
};

/**
 * Read-only structured view of Bentley-assembled campaign intelligence (not manual-only paste).
 */
export function CampaignIntelligenceNotesPanel({ notes, onEditRaw }: Props) {
  const sections = useMemo(() => splitMarkdownSections(notes), [notes]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (sections.length === 0) {
    return (
      <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/70 p-4 text-sm text-slate-400">
        Intelligence is still assembling — notes will appear here when Bentley merges pipeline output.
      </div>
    );
  }

  const toggle = (title: string) => {
    setOpen((o) => ({ ...o, [title]: !o[title] }));
  };

  return (
    <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/70 overflow-hidden shadow-lg shadow-cyan-500/5">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-cyan-500/25 bg-slate-900/50">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="h-5 w-5 shrink-0 mt-0.5" style={{ color: ACCENT }} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-cyan-200">Market intelligence (auto)</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Bentley merged intake, research, trends, market sweep, and synthesis. Open a section or edit the raw
              bundle below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEditRaw}
          className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded-lg px-3 py-1.5 hover:bg-cyan-500/10"
        >
          <PenLine className="h-3.5 w-3.5" />
          Edit raw notes
        </button>
      </div>
      <div className="max-h-[min(520px,55vh)] overflow-y-auto divide-y divide-cyan-500/15">
        {sections.map((sec) => {
          const isOpen = open[sec.title] ?? sec.title.length < 40;
          return (
            <div key={sec.title} className="px-4 py-3">
              <button
                type="button"
                onClick={() => toggle(sec.title)}
                className="w-full text-left text-sm font-medium text-cyan-300/95 hover:text-cyan-200 flex justify-between gap-2"
              >
                {sec.title}
                <span className="text-slate-500 text-xs font-normal">{isOpen ? "Hide" : "Show"}</span>
              </button>
              {isOpen ? (
                <pre className="mt-2 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {sec.body || "—"}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
