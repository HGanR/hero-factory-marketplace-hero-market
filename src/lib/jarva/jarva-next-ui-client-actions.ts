import { appendJarvaHandoffParams } from "@/lib/jarva/jarva-handoff";
import type { JarvaNextUiAction } from "@/lib/jarva/jarva-next-ui-actions";
import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/** Dispatched when chat or strip requests an Issue Security wizard step (A–F). */
export const JARVA_NEXT_UI_FOCUS_STEP_EVENT = "jarva-next-ui-focus-step";

export type JarvaNextUiFocusStepDetail = { step: string };

export type ApplyJarvaNextUiActionResult =
  | { kind: "navigated" }
  | { kind: "scrolled" }
  | { kind: "dispatched" }
  | { kind: "noop"; reason?: "tab_conflict" | "no_trust" | "server" };

/**
 * Shared browser handler for `JarvaNextUiAction` — used by JarvaNextActionStrip and FloatingNPCChat.
 * Does not mutate legal content; tab navigation respects existing user tab selection on Trust Records.
 */
export function applyJarvaNextUiActionInBrowser(
  action: JarvaNextUiAction,
  opts: {
    pathname: string;
    searchParams: URLSearchParams;
    push: (href: string) => void;
    replace: (href: string) => void;
    trustId?: string | null;
    lane?: JarvaWorkflowPath | null;
    onFocusStep?: (stepLetter: string) => void;
  }
): ApplyJarvaNextUiActionResult {
  if (typeof window === "undefined") return { kind: "noop", reason: "server" };

  if (action.kind === "select_tab") {
    const path = opts.pathname || "";
    if (path.startsWith("/trust-records")) {
      const cur = (opts.searchParams.get("tab") || "").trim();
      if (cur && cur !== action.target) return { kind: "noop", reason: "tab_conflict" };
      const next = new URLSearchParams(opts.searchParams.toString());
      next.set("tab", action.target);
      const q = next.toString();
      opts.replace(q ? `${path}?${q}` : path);
      return { kind: "navigated" };
    }
    const tid = (opts.trustId || "").trim();
    if (tid) {
      let href = `/trust-records?trustId=${encodeURIComponent(tid)}&tab=${encodeURIComponent(action.target)}`;
      if (opts.lane) href = appendJarvaHandoffParams(href, opts.lane);
      opts.push(href);
      return { kind: "navigated" };
    }
    return { kind: "noop", reason: "no_trust" };
  }

  if (action.kind === "focus_step") {
    if (opts.onFocusStep) {
      opts.onFocusStep(action.target);
      return { kind: "dispatched" };
    }
    window.dispatchEvent(
      new CustomEvent<JarvaNextUiFocusStepDetail>(JARVA_NEXT_UI_FOCUS_STEP_EVENT, {
        detail: { step: action.target },
      })
    );
    return { kind: "dispatched" };
  }

  if (action.kind === "highlight_action") {
    document.querySelector(`[data-jarva-target="${action.target}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return { kind: "scrolled" };
  }

  return { kind: "noop" };
}
