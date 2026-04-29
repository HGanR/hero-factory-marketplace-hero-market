"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FolderOpen, X } from "lucide-react";
import { isSessionStripVisible, hideSessionStrip, SESSION_STRIP_EVENT } from "@/lib/session-strip";

const BINDING_KEY = "smart_trust_platform_binding_v1";
const BINDING_EVENT = "smart_trust_platform_binding_updated";

type Binding = { clientId: string | null; trustId: string | null; lastUpdatedAt?: string | null };

function loadBinding(): Binding {
  if (typeof window === "undefined") return { clientId: null, trustId: null };
  try {
    const raw = window.localStorage.getItem(BINDING_KEY);
    if (!raw) return { clientId: null, trustId: null };
    const parsed = JSON.parse(raw) as Partial<Binding>;
    return {
      clientId: typeof parsed.clientId === "string" ? parsed.clientId : null,
      trustId: typeof parsed.trustId === "string" ? parsed.trustId : null,
      lastUpdatedAt: parsed.lastUpdatedAt ?? null,
    };
  } catch {
    return { clientId: null, trustId: null };
  }
}

export function ActiveTrustStrip() {
  const [binding, setBinding] = useState<Binding>(() => ({ clientId: null, trustId: null }));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const refresh = () => setBinding(loadBinding());
    refresh();
    setVisible(isSessionStripVisible());
    const onStorage = (e: StorageEvent) => {
      if (e.key === BINDING_KEY) refresh();
    };
    const onVisibility = () => setVisible(isSessionStripVisible());
    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_STRIP_EVENT, onVisibility);
    window.addEventListener(BINDING_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SESSION_STRIP_EVENT, onVisibility);
      window.removeEventListener(BINDING_EVENT, refresh);
    };
  }, []);

  // Only show when user has explicitly pinned it AND has a trust selected
  if (!binding.trustId || !visible) return null;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-700/50 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">Current session:</span>
          <span className="font-mono text-slate-200">
            Workspace ID: {binding.trustId.slice(0, 8)}...{binding.trustId.slice(-4)}
          </span>
          {binding.clientId && (
            <span className="text-slate-500">
              | Client: {binding.clientId.length > 12 ? `${binding.clientId.slice(0, 8)}...` : binding.clientId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/trusts/${encodeURIComponent(binding.trustId)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open Workspace
          </Link>
          <button
            type="button"
            onClick={hideSessionStrip}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
            title="Hide session bar"
            aria-label="Hide session bar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
