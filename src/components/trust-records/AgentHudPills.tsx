"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { FloatingNPCChat } from "@/components/npc/FloatingNPCChat";
import type { NPCChatContext } from "@/components/npc/FloatingNPCChat";

const AGENTS = [
  {
    id: "jarva" as const,
    npcId: "trust-advisor",
    name: "Jarva",
    title: "Trust Structuring Aid",
    avatarPlaceholder: "📋",
    panelTitle: "Jarva · Your Trust Structuring Aid",
    inputPlaceholder: "Ask Jarva...",
    initialGreeting:
      "I'm Jarva. I aid you, the consultant, in trust structuring—prompting you to ask clients the right questions and guiding you through the platform. What would you like to work on today?",
  },
  {
    id: "eleanor" as const,
    npcId: "gt-eleanor-voss",
    name: "Eleanor",
    title: "CFO · Finance",
    avatarPlaceholder: "💹",
    panelTitle: "Eleanor Voss · CFO",
    inputPlaceholder: "Ask Eleanor...",
    initialGreeting:
      "Eleanor Voss, CFO. I oversee currency reporting, negotiable instruments, trust securities issuance, and brokerage deposit procedures. What financial matter can I address?",
  },
] as const;

export interface AgentHudPillsProps {
  context?: NPCChatContext | null;
  /** Position: bottom-right (default), bottom-left */
  position?: "bottom-right" | "bottom-left";
  className?: string;
}

export function AgentHudPills({
  context,
  position = "bottom-right",
  className,
}: AgentHudPillsProps) {
  const [activeId, setActiveId] = useState<"jarva" | "eleanor" | null>(null);

  const positionClasses =
    position === "bottom-right"
      ? "bottom-6 right-6"
      : "bottom-6 left-6";

  return (
    <div
      className={cn(
        "fixed z-[1200] flex flex-col items-end gap-2",
        positionClasses,
        className
      )}
    >
      {/* Chat panels - render above pills when active */}
      {AGENTS.map((agent) => (
        <FloatingNPCChat
          key={agent.id}
          npcId={agent.npcId}
          context={context}
          hideTrigger
          open={activeId === agent.id}
          onOpenChange={(open) => !open && setActiveId(null)}
          panelTitle={agent.panelTitle}
          inputPlaceholder={agent.inputPlaceholder}
          initialGreeting={agent.initialGreeting}
          className={cn(
            "!bottom-28",
            position === "bottom-right" ? "!right-6 !left-auto" : "!left-6 !right-auto"
          )}
        />
      ))}

      {/* Pill buttons */}
      <div className="flex flex-col gap-2">
        {AGENTS.map((agent) => {
          const isActive = activeId === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => setActiveId(isActive ? null : agent.id)}
              className={cn(
                "flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur transition-all",
                "border-slate-600/80 bg-slate-900/95 hover:border-cyan-500/50 hover:bg-slate-800/95",
                isActive && "border-cyan-500/60 bg-slate-800/95 ring-2 ring-cyan-500/30"
              )}
              aria-label={`Open ${agent.name}`}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-600/80 bg-slate-800/80 text-lg"
                aria-hidden
              >
                {agent.avatarPlaceholder}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium text-slate-200">{agent.name}</span>
                <span className="text-xs text-slate-500">{agent.title}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
