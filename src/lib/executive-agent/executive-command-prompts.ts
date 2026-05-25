/**
 * Executive command prompt registry — drives HUD module selection from UI and voice.
 */

import type { VoiceOperationalQueryKind } from "@/lib/executive-agent/executive-voice-operational-phrases";

export type ExecutiveCommandPromptCategory =
  | "intelligence"
  | "operations"
  | "subject"
  | "fulfillment"
  | "platform";

export type ExecutiveCommandPromptId =
  | "analytics"
  | "agent_activity"
  | "inbox_signals"
  | "new_registrations"
  | "agent_network"
  | "subject_workspace"
  | "decision_queue"
  | "task_queue"
  | "gps"
  | "threads"
  | "operational_thread"
  | "command_center"
  | "command_agent_chat"
  | "operations_briefing"
  | "kpi_forecasting"
  | "operators_delegation"
  | "simulation_intelligence"
  | "planning"
  | "incidents_governance"
  | "automation"
  | "multi_agent_workflows"
  | "operational_memory"
  | "website_fulfillment"
  | "trust_fulfillment"
  | "revenue_os_smart_trust"
  | "conversations_signals"
  | "system_voice"
  | "executive_briefing"
  | "executive_posture"
  | "revenue_overview"
  | "bentley_campaign"
  | "pending_approvals";

export type ExecutiveCommandPrompt = {
  id: ExecutiveCommandPromptId;
  label: string;
  category: ExecutiveCommandPromptCategory;
  description: string;
  voicePhrases: string[];
  /** Maps operational voice short-circuit kinds to this HUD module. */
  operationalKind?: VoiceOperationalQueryKind;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export const EXECUTIVE_COMMAND_PROMPTS: ExecutiveCommandPrompt[] = [
  {
    id: "analytics",
    label: "Analytics",
    category: "intelligence",
    description: "Traffic, accounts, conversions, and attribution rollups.",
    voicePhrases: ["show site analytics", "site analytics", "open analytics", "show analytics", "site traffic"],
    operationalKind: "site_analytics",
  },
  {
    id: "revenue_overview",
    label: "Revenue Overview",
    category: "intelligence",
    description: "Derived account value and live site performance.",
    voicePhrases: [
      "revenue overview",
      "show revenue",
      "account value",
      "what is the revenue overview",
      "potential earnings",
      "monthly recurring revenue",
    ],
    operationalKind: "revenue_overview",
  },
  {
    id: "agent_activity",
    label: "Agent Activity",
    category: "intelligence",
    description: "Jarva, Reality, and desk activity summaries.",
    voicePhrases: ["jarva activity", "open jarva activity", "show jarva", "reality activity", "smart trust activity"],
    operationalKind: "jarva_activity",
  },
  {
    id: "inbox_signals",
    label: "Inbox Signals",
    category: "operations",
    description: "Executive inbox messages and attachment controls.",
    voicePhrases: ["executive inbox", "show executive inbox", "check inbox", "inbox signals", "my inbox"],
    operationalKind: "executive_inbox",
  },
  {
    id: "new_registrations",
    label: "New Registrations",
    category: "operations",
    description: "Today's sign-ups and onboarding follow-up.",
    voicePhrases: ["new registrations", "show new registrations", "check new registrations", "new sign-ups"],
    operationalKind: "new_registrations",
  },
  {
    id: "agent_network",
    label: "Agent Network",
    category: "platform",
    description: "Live agent status and activity feed.",
    voicePhrases: ["agent network", "show agents", "agent status"],
  },
  {
    id: "subject_workspace",
    label: "Subject Workspace",
    category: "subject",
    description: "Scope, orders, and read-only subject context.",
    voicePhrases: ["subject workspace", "open workspace"],
  },
  {
    id: "decision_queue",
    label: "Decision Queue",
    category: "subject",
    description: "Human-only owner decisions awaiting action.",
    voicePhrases: ["decision queue", "open decisions"],
  },
  {
    id: "task_queue",
    label: "Task Queue",
    category: "subject",
    description: "Human-coordinated operational tasks.",
    voicePhrases: ["task queue", "open tasks"],
  },
  {
    id: "gps",
    label: "GPS",
    category: "subject",
    description: "Fulfillment case scope and positioning.",
    voicePhrases: ["gps", "fulfillment gps", "case scope"],
  },
  {
    id: "threads",
    label: "Threads",
    category: "subject",
    description: "Internal ops thread list.",
    voicePhrases: ["threads", "open threads"],
  },
  {
    id: "operational_thread",
    label: "Operational Thread",
    category: "subject",
    description: "Selected thread discussion.",
    voicePhrases: ["operational thread", "open thread"],
  },
  {
    id: "command_center",
    label: "Command Center",
    category: "platform",
    description: "Live monitoring — no autonomous execution.",
    voicePhrases: ["command center", "open command center"],
  },
  {
    id: "command_agent_chat",
    label: "Command Agent Chat",
    category: "subject",
    description: "Subject-scoped Skipper dialogue.",
    voicePhrases: ["agent chat", "skipper chat", "talk to skipper"],
  },
  {
    id: "executive_briefing",
    label: "Today's Executive Briefing",
    category: "intelligence",
    description: "Daily priorities, risks, and approvals.",
    voicePhrases: ["executive briefing", "today's briefing", "daily briefing"],
  },
  {
    id: "executive_posture",
    label: "Executive Posture",
    category: "intelligence",
    description: "Chief-of-staff posture, entities, and session timeline.",
    voicePhrases: ["executive posture", "chief of staff", "session timeline"],
  },
  {
    id: "operations_briefing",
    label: "Operations Briefing",
    category: "operations",
    description: "Urgent desk actions and cross-dept signals.",
    voicePhrases: ["operations briefing"],
  },
  {
    id: "kpi_forecasting",
    label: "KPI & Forecasting",
    category: "intelligence",
    description: "Advisory KPI metrics and fulfillment forecasts.",
    voicePhrases: ["kpi forecasting", "show kpi", "kpi forecast", "forecasting"],
  },
  {
    id: "operators_delegation",
    label: "Operators & Delegation",
    category: "operations",
    description: "Registry, workload, and escalation paths.",
    voicePhrases: ["operators", "delegation"],
  },
  {
    id: "simulation_intelligence",
    label: "Simulation & Intelligence",
    category: "intelligence",
    description: "What-if, knowledge graph, and strategic memory.",
    voicePhrases: ["simulation", "intelligence graph"],
  },
  {
    id: "planning",
    label: "Planning",
    category: "operations",
    description: "Recovery, staffing, and initiative planning.",
    voicePhrases: ["planning", "open planning"],
  },
  {
    id: "incidents_governance",
    label: "Incidents & Governance",
    category: "operations",
    description: "Live feed, alerts, and crisis coordination.",
    voicePhrases: ["incidents", "governance"],
  },
  {
    id: "automation",
    label: "Automation",
    category: "operations",
    description: "Approval-gated execution and rollback.",
    voicePhrases: ["automation", "show automation"],
  },
  {
    id: "multi_agent_workflows",
    label: "Multi-Agent & Workflows",
    category: "platform",
    description: "Coordination, routing, and persistent fabric.",
    voicePhrases: ["workflows", "multi agent"],
  },
  {
    id: "operational_memory",
    label: "Operational Memory",
    category: "intelligence",
    description: "Learning from desk history — read-only.",
    voicePhrases: ["operational memory", "desk memory"],
  },
  {
    id: "website_fulfillment",
    label: "Website Fulfillment",
    category: "fulfillment",
    description: "Site Builder queue and payment confirm.",
    voicePhrases: ["website fulfillment", "site builder fulfillment"],
  },
  {
    id: "trust_fulfillment",
    label: "Trust Fulfillment",
    category: "fulfillment",
    description: "Legal review packets — no trust apply.",
    voicePhrases: ["trust fulfillment"],
  },
  {
    id: "revenue_os_smart_trust",
    label: "Revenue OS & Smart Trust",
    category: "fulfillment",
    description: "Campaign and governance desks.",
    voicePhrases: ["smart trust", "open smart trust", "revenue os", "show smart trust"],
    operationalKind: "smart_trust_activity",
  },
  {
    id: "conversations_signals",
    label: "Conversations & Signals",
    category: "operations",
    description: "Recent threads, follow-ups, and Bentley readiness.",
    voicePhrases: ["conversations", "follow-up signals"],
  },
  {
    id: "system_voice",
    label: "System & Voice",
    category: "platform",
    description: "Health checks and voice diagnostics.",
    voicePhrases: ["system voice", "voice diagnostics", "system health"],
  },
  {
    id: "bentley_campaign",
    label: "Bentley Campaign Mode",
    category: "fulfillment",
    description:
      "Conversational campaign orchestration — real Bentley intake, pipeline stages, approval-gated launch.",
    voicePhrases: [
      "bentley campaign",
      "bentley campaign mode",
      "create a campaign",
      "start a campaign",
      "afternoon campaign",
      "open bentley",
      "revenue os campaign",
    ],
  },
  {
    id: "pending_approvals",
    label: "Pending Approvals",
    category: "operations",
    description: "Explicit approve / reject queue.",
    voicePhrases: ["pending approvals", "approval queue"],
  },
];

export const EXECUTIVE_COMMAND_PROMPT_BY_ID = Object.fromEntries(
  EXECUTIVE_COMMAND_PROMPTS.map((p) => [p.id, p]),
) as Record<ExecutiveCommandPromptId, ExecutiveCommandPrompt>;

export function executiveCommandPromptLabel(id: ExecutiveCommandPromptId | null): string {
  if (!id) return "No module selected";
  return EXECUTIVE_COMMAND_PROMPT_BY_ID[id]?.label ?? id;
}

export function resolveExecutiveCommandPromptFromVoice(input: string): ExecutiveCommandPromptId | null {
  let t = norm(input);
  t = t.replace(/^skipper[,.\s!-]+/, "").trim();
  if (!t) return null;

  for (const prompt of EXECUTIVE_COMMAND_PROMPTS) {
    for (const phrase of prompt.voicePhrases) {
      const p = norm(phrase);
      if (t.includes(p) || t === p) return prompt.id;
    }
  }

  if (/\b(show|open|check|display)\s+(the\s+)?(.+)/.test(t)) {
    const rest = t.replace(/^(show|open|check|display)\s+(the\s+)?/, "");
    for (const prompt of EXECUTIVE_COMMAND_PROMPTS) {
      if (norm(prompt.label).includes(rest) || rest.includes(norm(prompt.label))) {
        return prompt.id;
      }
    }
  }

  return null;
}

export function executiveCommandPromptForOperationalKind(
  kind: VoiceOperationalQueryKind,
): ExecutiveCommandPromptId | null {
  const match = EXECUTIVE_COMMAND_PROMPTS.find((p) => p.operationalKind === kind);
  return match?.id ?? null;
}

export function executiveCommandPromptsByCategory(): Record<
  ExecutiveCommandPromptCategory,
  ExecutiveCommandPrompt[]
> {
  const out: Record<ExecutiveCommandPromptCategory, ExecutiveCommandPrompt[]> = {
    intelligence: [],
    operations: [],
    subject: [],
    fulfillment: [],
    platform: [],
  };
  for (const p of EXECUTIVE_COMMAND_PROMPTS) {
    out[p.category].push(p);
  }
  return out;
}

export const EXECUTIVE_COMMAND_CATEGORY_LABEL: Record<ExecutiveCommandPromptCategory, string> = {
  intelligence: "Intelligence",
  operations: "Operations",
  subject: "Subject desk",
  fulfillment: "Fulfillment",
  platform: "Platform",
};
