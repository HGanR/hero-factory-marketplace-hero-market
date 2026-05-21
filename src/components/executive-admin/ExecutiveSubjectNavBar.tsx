"use client";

import {
  BarChart3,
  Bot,
  LayoutDashboard,
  ListTodo,
  Mail,
  Pencil,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  EXECUTIVE_SUBJECTS,
  type ExecutiveSubjectConfig,
  type ExecutiveSubjectId,
} from "@/lib/executive-agent/executive-subject-nav";

const ICONS: Record<ExecutiveSubjectId, typeof LayoutDashboard> = {
  command_center: LayoutDashboard,
  crm_intelligence: Users,
  ai_agents: Bot,
  site_builder: Pencil,
  analytics: BarChart3,
  inbox: Mail,
  tasks: ListTodo,
  trust_jarva: Shield,
  revenue_os: TrendingUp,
  settings: Settings,
  new_command: Sparkles,
};

type Props = {
  activeSubjectId: ExecutiveSubjectId;
  onSelectSubject: (subject: ExecutiveSubjectConfig) => void;
};

export function ExecutiveSubjectNavBar({ activeSubjectId, onSelectSubject }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#00e5ff]/22 bg-[#030a12]/96 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      aria-label="Executive desk subjects"
    >
      <div className="mx-auto max-w-[1920px] px-2 py-2 sm:px-4">
        <div className="flex items-end gap-1 overflow-x-auto pb-0.5 scrollbar-thin sm:gap-2">
          {EXECUTIVE_SUBJECTS.map((subject) => {
            const Icon = ICONS[subject.id];
            const active = activeSubjectId === subject.id;
            const primarySlot = subject.agentSlots[0];
            const secondarySlot = subject.agentSlots[1];

            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => onSelectSubject(subject)}
                className={`group flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-xl border px-2 py-2 transition sm:min-w-[5.5rem] sm:px-3 ${
                  active
                    ? "border-[#00e5ff]/50 bg-[#00e5ff]/12 shadow-[0_0_20px_rgba(0,229,255,0.15)]"
                    : "border-transparent bg-transparent hover:border-[#00e5ff]/20 hover:bg-[#050b13]/80"
                }`}
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#00e5ff]/25 bg-[#02070d]/90">
                  <Icon
                    className={`h-4 w-4 ${active ? "text-[#00e5ff]" : "text-slate-400 group-hover:text-[#00b7ff]"}`}
                    aria-hidden
                  />
                  {subject.taskBadge != null && subject.taskBadge > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {subject.taskBadge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-1.5 max-w-[5.5rem] truncate text-center text-[8px] font-bold uppercase tracking-[0.12em] sm:text-[9px] ${
                    active ? "text-[#00e5ff]" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                >
                  {subject.shortLabel}
                </span>
                {primarySlot ? (
                  <span className="mt-0.5 max-w-[5.5rem] truncate text-center text-[7px] font-semibold uppercase tracking-[0.14em] text-violet-300/90 sm:text-[8px]">
                    {primarySlot.displayName}
                  </span>
                ) : null}
                {primarySlot ? (
                  <span
                    className={`max-w-[5.5rem] truncate text-center text-[7px] uppercase tracking-[0.16em] ${
                      active ? "text-[#00b7ff]/80" : "text-slate-600"
                    }`}
                  >
                    {primarySlot.domainLabel}
                  </span>
                ) : null}
                {secondarySlot && subject.id === "ai_agents" ? (
                  <span className="mt-0.5 hidden text-[7px] text-slate-600 sm:block">
                    +{subject.agentSlots.length - 1} agents
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-1 hidden text-center text-[9px] text-slate-600 sm:block">
          Skipper nexus · select a subject to open agent chat · admin only
        </p>
      </div>
    </nav>
  );
}
