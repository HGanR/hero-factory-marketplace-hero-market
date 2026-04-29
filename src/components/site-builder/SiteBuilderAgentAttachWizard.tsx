"use client";

import Link from "next/link";
import { Bot, X } from "lucide-react";
import { useMemo } from "react";

export type WizardAgentRow = {
  id: string;
  name: string;
  status: string;
  workspaceId?: string | null;
};

type WidgetBindingRow = {
  agentId: string;
  clientId?: string | null;
  isActive: boolean;
  agentName: string;
};

type Props = {
  open: boolean;
  onDismiss: () => void;
  siteClientId: string | null;
  agents: WizardAgentRow[];
  bindings: WidgetBindingRow[];
  workspaceClientPairs: Array<{ id: string; clientId: string | null }>;
  widgetInSchema: boolean;
  busy: boolean;
  onAttach: (agentId: string) => void | Promise<void>;
  onSkip: () => void;
};

function agentPriority(
  a: WizardAgentRow,
  siteClientId: string | null,
  bindings: WidgetBindingRow[],
  workspaceClientPairs: Array<{ id: string; clientId: string | null }>,
): number {
  const sc = siteClientId?.trim() || "";
  if (!sc) return 0;
  const bound = bindings.find((b) => b.agentId === a.id && b.isActive);
  if (bound?.clientId && bound.clientId === sc) return 3;
  const ws = a.workspaceId?.trim();
  if (ws && workspaceClientPairs.some((w) => w.id === ws && w.clientId === sc)) return 2;
  if (bound?.clientId == null && bound) return 1;
  return 0;
}

export function SiteBuilderAgentAttachWizard({
  open,
  onDismiss,
  siteClientId,
  agents,
  bindings,
  workspaceClientPairs,
  widgetInSchema,
  busy,
  onAttach,
  onSkip,
}: Props) {
  const sorted = useMemo(() => {
    const copy = [...agents];
    copy.sort((a, b) => {
      const pa = agentPriority(a, siteClientId, bindings, workspaceClientPairs);
      const pb = agentPriority(b, siteClientId, bindings, workspaceClientPairs);
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [agents, bindings, siteClientId, workspaceClientPairs]);

  if (!open) return null;

  const primaryBinding = bindings.find((b) => b.isActive);

  return (
    <div
      className="fixed bottom-[5.5rem] left-0 right-0 z-[92] px-4 sm:px-6"
      role="dialog"
      aria-labelledby="site-builder-agent-wizard-title"
    >
      <div className="mx-auto max-w-lg rounded-xl border border-violet-500/25 bg-slate-950/95 p-4 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p id="site-builder-agent-wizard-title" className="text-sm font-semibold text-slate-100">
              Attach an AI agent to capture leads?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Bind your agency widget to this site so visitors can chat; the key is saved in schema metadata for export
              and preview.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onDismiss}
            className="rounded-lg border border-white/[0.08] p-1 text-slate-400 transition-colors hover:border-white/[0.14] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(widgetInSchema || primaryBinding) && (
          <p className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1.5 text-[11px] text-emerald-100/90">
            <Bot className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span>
              Widget status:{" "}
              <span className="font-medium text-emerald-50/95">
                {widgetInSchema ? "embed metadata in schema" : "binding saved"}
                {primaryBinding ? ` · ${primaryBinding.agentName}` : ""}
              </span>
            </span>
          </p>
        )}

        <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-white/[0.06] bg-slate-900/50">
          {sorted.length ? (
            <ul className="divide-y divide-white/[0.05] text-xs">
              {sorted.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="min-w-0 truncate text-slate-300">
                    {a.name}
                    <span className="ml-1 text-slate-600">({a.status})</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAttach(a.id)}
                    className="shrink-0 rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-100 transition-colors hover:bg-violet-500/25 disabled:opacity-40"
                  >
                    Attach
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2.5 py-3 text-xs text-slate-500">No agents yet — create one in AI Agency, then return here.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/app/agents"
            className="inline-flex items-center justify-center rounded-full border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
          >
            Create agent
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200 disabled:opacity-40"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
