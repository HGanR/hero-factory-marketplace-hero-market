"use client";

import React, { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applyJarvaNextUiActionInBrowser } from "@/lib/jarva/jarva-next-ui-client-actions";
import {
  getResolvedJarvaNextUiActionsForContext,
  pickPrimaryJarvaNextUiAction,
  type JarvaNextUiAction,
  type JarvaNextUiActionBundle,
} from "@/lib/jarva/jarva-next-ui-actions";
import { isJarvaWorkflowPath, type JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  inferWizardStepLetter,
  isJarvaFocusStepAligned,
  jarvaHandoffLaneMatchesBundle,
  JARVA_NEXT_UI_COPY,
} from "@/lib/jarva/jarva-next-ui-alignment";

export type JarvaChatNextUiActionsProps = {
  bundle: JarvaNextUiActionBundle | null;
  trustId?: string | null;
  /** Issue Security wizard step (A–F) when known — enables “Already aligned” for focus_step. */
  wizardStepLetter?: string | null;
  /** Current pathname (pass from `usePathname`) for Issue Security step inference when `wizardStepLetter` omitted. */
  pathnameOverride?: string;
  /** Optional context for inferring wizard step when pathname includes issue-security. */
  wizardContext?: { currentStep?: string | null; stepFocus?: string | null } | null;
  /** Prefill / drafting lane — advisory only. */
  onAppendAdvisoryLine?: (text: string) => void;
};

function shortActionLabel(a: JarvaNextUiAction): string {
  if (a.kind === "prefill_mode") return "Drafting note";
  if (a.kind === "focus_step") return `Step ${a.target}`;
  if (a.kind === "highlight_action") return "Show in page";
  if (a.kind === "select_tab") return "Open tab";
  const t = a.label;
  return t.length > 36 ? `${t.slice(0, 34)}…` : t;
}

export function JarvaChatNextUiActions({
  bundle,
  trustId,
  wizardStepLetter: wizardStepLetterProp,
  pathnameOverride,
  wizardContext,
  onAppendAdvisoryLine,
}: JarvaChatNextUiActionsProps) {
  const pathnameFromHook = usePathname() ?? "";
  const pathname = pathnameOverride ?? pathnameFromHook;
  const sp = useSearchParams();
  const router = useRouter();

  const lane: JarvaWorkflowPath | null = isJarvaWorkflowPath(bundle?.lane) ? bundle!.lane : null;

  const resolved = useMemo(() => {
    return getResolvedJarvaNextUiActionsForContext(pathname, new URLSearchParams(sp?.toString() ?? ""), lane);
  }, [lane, pathname, sp]);

  const primary = useMemo(() => pickPrimaryJarvaNextUiAction(resolved), [resolved]);

  const wizardStepLetter =
    (wizardStepLetterProp ?? "").trim() || inferWizardStepLetter(pathname, wizardContext ?? undefined) || null;

  const tabCurrent = (sp.get("tab") || "").trim();
  const onTrustRecords = pathname.startsWith("/trust-records");
  const onIssueSecurity = pathname.includes("/issue-security");
  const primaryTabAligned = primary?.kind === "select_tab" && tabCurrent === primary.target.trim();
  const primaryFocusAligned =
    primary?.kind === "focus_step" && isJarvaFocusStepAligned(primary, wizardStepLetter);
  const handoffLaneMatches = jarvaHandoffLaneMatchesBundle(new URLSearchParams(sp?.toString() ?? ""), lane);

  const apply = useCallback(
    (a: JarvaNextUiAction) => {
      if (a.kind === "prefill_mode") {
        onAppendAdvisoryLine?.(
          `**Jarva (drafting lane — DRAFT)**\n${a.label}\nContinue in the Smart Trust / Jarva workspace. This chat does not change entity selection automatically.`
        );
        return;
      }
      applyJarvaNextUiActionInBrowser(a, {
        pathname,
        searchParams: new URLSearchParams(sp?.toString() ?? ""),
        push: (href) => router.push(href),
        replace: (href) => router.replace(href),
        trustId,
        lane,
      });
    },
    [lane, onAppendAdvisoryLine, pathname, router, sp, trustId]
  );

  if (!bundle || !lane || resolved.length === 0) return null;

  const show = resolved.slice(0, 4);

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2.5 text-[11px] text-amber-50/95"
      role="region"
      aria-label="Jarva next actions"
    >
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Next actions</div>
      {bundle.advisoryLine ? <p className="mb-2 text-[11px] leading-snug text-slate-300">{bundle.advisoryLine}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {show.map((a, i) => {
          const tabConflict = a.kind === "select_tab" && onTrustRecords && tabCurrent !== "" && tabCurrent !== a.target;
          const tabThisAligned = a.kind === "select_tab" && onTrustRecords && tabCurrent === a.target.trim();
          const focusThisAligned = a.kind === "focus_step" && isJarvaFocusStepAligned(a, wizardStepLetter);
          const primarySelectTabAligned =
            primary?.kind === "select_tab" && a === primary && primaryTabAligned;
          const disabled = Boolean(tabConflict || primarySelectTabAligned || focusThisAligned);

          let label: string;
          if (tabThisAligned) label = "Already aligned";
          else if (a.kind === "focus_step" && focusThisAligned) label = "Already aligned";
          else if (a.kind === "select_tab" && !onTrustRecords && trustId) {
            label = "Continue in Trust Records";
          } else if (a.kind === "focus_step" && onIssueSecurity && wizardStepLetter && !focusThisAligned) {
            label = "Focus this step";
          } else label = shortActionLabel(a);

          return (
            <Button
              key={`${a.kind}-${a.target}-${i}`}
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              className={cn(
                "h-7 max-w-[220px] truncate border-amber-500/35 bg-amber-900/40 text-[10px] text-amber-50 hover:bg-amber-800/50",
                disabled && "opacity-50"
              )}
              title={a.label}
              onClick={() => apply(a)}
            >
              {label}
            </Button>
          );
        })}
      </div>
      {primary?.kind === "select_tab" && onTrustRecords && primaryTabAligned ? (
        <p className="mt-2 text-[10px] text-emerald-400/90">{JARVA_NEXT_UI_COPY.tabAlreadyAlignedLine}</p>
      ) : null}
      {primaryFocusAligned ? (
        <p className="mt-2 text-[10px] text-emerald-400/90">{JARVA_NEXT_UI_COPY.focusStepAlreadyAlignedLine}</p>
      ) : null}
      {handoffLaneMatches && onIssueSecurity && lane && !primaryFocusAligned ? (
        <p className="mt-2 text-[10px] text-slate-400/90">{JARVA_NEXT_UI_COPY.handoffLaneMatchesLine}</p>
      ) : null}
    </div>
  );
}
