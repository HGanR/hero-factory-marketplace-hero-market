"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import type { JarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";
import { jarvaDocumentAssemblyHintsHaveSignals } from "@/lib/jarva/jarva-document-assembly-hints";
import { JARVA_ASSEMBLY_READINESS_ROWS } from "@/lib/jarva/jarva-document-assembly-destinations";
import { cn } from "@/lib/utils";

export type JarvaDocumentAssemblyReadinessPanelProps = {
  trustId: string;
  hints: JarvaDocumentAssemblyHints;
  className?: string;
};

/**
 * Compact advisory block: only booleans that are true, plus optional API lines.
 * Does not generate documents or imply counsel approval.
 */
export function JarvaDocumentAssemblyReadinessPanel({
  trustId,
  hints,
  className,
}: JarvaDocumentAssemblyReadinessPanelProps) {
  const trueRows = useMemo(
    () => JARVA_ASSEMBLY_READINESS_ROWS.filter((r) => hints[r.key]),
    [hints]
  );

  if (!jarvaDocumentAssemblyHintsHaveSignals(hints)) return null;

  return (
    <div
      className={cn(
        "rounded border border-violet-500/35 bg-violet-950/25 p-2 text-[11px] leading-snug text-slate-300",
        className
      )}
      data-testid="jarva-document-assembly-readiness"
    >
      <p className="font-semibold text-violet-100/95">Draft assembly &amp; review assembly readiness</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Advisory only — DRAFT — not legal advice; not counsel approval; not auto-generated files.
      </p>
      {trueRows.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {trueRows.map((row) => {
            const href = row.href(trustId);
            return (
              <li key={row.key} className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-2">
                <div className="flex min-w-0 flex-1 gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400/90" aria-hidden />
                  <span className="text-slate-300">{row.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 sm:pl-0">
                  <Link
                    href={href}
                    className="text-[10px] font-medium text-violet-300/95 underline-offset-2 hover:underline"
                  >
                    {row.primaryLinkLabel}
                  </Link>
                  <span className="text-[9px] text-slate-500">{row.secondaryActionLabel}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {hints.lines.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-violet-500/20 pt-2 text-[10px] text-slate-400">
          {hints.lines.slice(0, 6).map((line, i) => (
            <li key={i} className="leading-relaxed">
              {stripMarkdownBold(line)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function stripMarkdownBold(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1");
}
