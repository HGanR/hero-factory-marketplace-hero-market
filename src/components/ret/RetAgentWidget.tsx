"use client";

import { useEffect, useRef, useState } from "react";
import { buildRetMaaniaSnapshot } from "@/lib/maania/build-maania-snapshot";
import { getOrCreateRetClientSessionId } from "@/lib/ret/client-session";
import type { RetAgentDraft } from "@/lib/ret/types";

type Win = Window & {
  TROO_AGENT_CONFIG?: { widgetKey: string; context: Record<string, unknown> };
};

const CONTEXT_DEBOUNCE_MS = 400;
const SAVE_DEBOUNCE_MS = 1500;
const LS_SESSION = "ret_draft_session_id";

function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function buildWidgetContext(draft: RetAgentDraft, retSessionId: string | null): Record<string, unknown> {
  return {
    pageType: "ret",
    source: "ret_page",
    retClientSessionId: getOrCreateRetClientSessionId(),
    ...(retSessionId ? { retSessionId } : {}),
    retSnapshot: buildRetMaaniaSnapshot(draft, {}),
  };
}

/**
 * Loads the same AI widget as Site Builder; passes live RET intake as context via
 * window.TROO_AGENT_CONFIG + troo-agent-context events (see public/widget/loader.js).
 *
 * When signed in, drafts autosave to POST /api/ret/session and pass retSessionId for authoritative snapshots.
 */
export function RetAgentWidget({ draft }: { draft: RetAgentDraft }) {
  const scriptInjected = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [retSessionId, setRetSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(LS_SESSION)?.trim() || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const widgetKey = process.env.NEXT_PUBLIC_RET_WIDGET_KEY?.trim();
    if (!widgetKey) return;

    const apply = () => {
      const context = buildWidgetContext(draft, retSessionId);
      const w = window as Win;
      w.TROO_AGENT_CONFIG = { widgetKey, context };

      if (!scriptInjected.current) {
        scriptInjected.current = true;
        const s = document.createElement("script");
        s.src = `${appOrigin()}/widget/loader.js`;
        s.async = true;
        s.dataset.widgetKey = widgetKey;
        document.body.appendChild(s);
        return;
      }

      window.dispatchEvent(new CustomEvent("troo-agent-context", { detail: context }));
    };

    if (!scriptInjected.current) {
      apply();
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(apply, CONTEXT_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [draft, retSessionId]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/ret/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft, sessionId: retSessionId ?? undefined }),
        });
        if (r.status === 401) return;
        const j = await r.json().catch(() => ({}));
        if (typeof j?.sessionId === "string" && j.sessionId) {
          setRetSessionId(j.sessionId);
          try {
            localStorage.setItem(LS_SESSION, j.sessionId);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* offline or error */
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, retSessionId]);

  if (!process.env.NEXT_PUBLIC_RET_WIDGET_KEY?.trim()) {
    return (
      <p className="text-xs text-amber-400/90 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
        RET AI widget: set{" "}
        <code className="text-amber-200">NEXT_PUBLIC_RET_WIDGET_KEY</code> to your Agency widget key (same agent
        as your Site Builder site). Allow this app origin in the widget&apos;s allowed domains. See{" "}
        <code className="text-amber-200">docs/ret-agent-widget.md</code>.
      </p>
    );
  }

  return null;
}
