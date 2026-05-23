import type { ExecutiveAgentKey } from "@/lib/executive-agent/agent-intelligence-bus";
import type { ExecutiveDashboardMode } from "@/lib/executive-agent/executive-agent-chat-request";
import type { SubjectWorkspaceKind } from "@/lib/executive-agent/subject-workspace-state";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

/** Desk subject tabs — Skipper is the nexus; other agents receive delegated tasks. */
export type ExecutiveSubjectId =
  | "command_center"
  | "crm_intelligence"
  | "ai_agents"
  | "site_builder"
  | "analytics"
  | "inbox"
  | "tasks"
  | "trust_jarva"
  | "revenue_os"
  | "smart_trust"
  | "troo_town"
  | "settings"
  | "new_command";

export type ExecutiveSubjectAgentSlot = {
  /** API-routable key; `jarva` maps to Skipper + TRUST read tools at orchestration time. */
  routeKey: ExecutiveAgentKey | "jarva" | "maania" | "evaana" | "stephon";
  displayName: string;
  /** Domain shown under the agent name on the nav tab (e.g. ACCOUNTING). */
  domainLabel: string;
};

export type ExecutiveSubjectConfig = {
  id: ExecutiveSubjectId;
  navLabel: string;
  shortLabel: string;
  description: string;
  dashboardMode: ExecutiveDashboardMode;
  /** Agents that receive tasks when this subject is active (Skipper always included for routing). */
  delegateAgents: ExecutiveAgentKey[];
  /** Shown on nav tile and in the chat header. */
  agentSlots: ExecutiveSubjectAgentSlot[];
  taskBadge?: number;
};

function withSkipperNexus(agents: ExecutiveAgentKey[]): ExecutiveAgentKey[] {
  const set = new Set<ExecutiveAgentKey>(["skipper", ...agents]);
  return [...set];
}

export const EXECUTIVE_SUBJECTS: ExecutiveSubjectConfig[] = [
  {
    id: "command_center",
    navLabel: "Command Center",
    shortLabel: "Command",
    description: "Skipper nexus — orchestrates all desk agents from one command surface.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "OVERVIEW",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [{ routeKey: "skipper", displayName: "SKIPPER", domainLabel: "NEXUS" }],
  },
  {
    id: "crm_intelligence",
    navLabel: "CRM Intelligence",
    shortLabel: "CRM",
    description: "Client graph, follow-ups, and fulfillment operations intelligence.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "CRM",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "CRM OPS" },
      { routeKey: "executive_admin", displayName: "Executive Admin", domainLabel: "CRM" },
    ],
  },
  {
    id: "ai_agents",
    navLabel: "AI Agents",
    shortLabel: "Agents",
    description: "Delegate to Reality, Bentley, Eleanor, and Maania — parallel desk work via Claude API.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "CONVERSATIONS",
    delegateAgents: withSkipperNexus(["reality", "bentley", "eleanor", "executive_admin"]),
    agentSlots: [
      { routeKey: "reality", displayName: "Reality", domainLabel: "ENGAGEMENT" },
      { routeKey: "bentley", displayName: "Bentley", domainLabel: "REVENUE OS" },
      { routeKey: "eleanor", displayName: "Eleanor", domainLabel: "ACCOUNTING" },
      { routeKey: "maania", displayName: "Maania", domainLabel: "PROPERTY" },
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "NEXUS" },
    ],
  },
  {
    id: "site_builder",
    navLabel: "Stephon",
    shortLabel: "Stephon",
    description:
      "Site Builder desk — Stephon operator conversations, builder usability signals, and Skipper-governed engine feedback.",
    workspaceKind: "website",
    departmentFocus: "WEBSITE",
    dashboardMode: "SITE_BUILDER",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [
      { routeKey: "stephon", displayName: "Stephon", domainLabel: "SITE BUILDER" },
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "USABILITY" },
    ],
  },
  {
    id: "analytics",
    navLabel: "Analytics",
    shortLabel: "Analytics",
    description: "Platform analytics — Skipper reads traffic, campaigns, and conversion signals.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "OVERVIEW",
    delegateAgents: withSkipperNexus(["bentley"]),
    agentSlots: [
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "ANALYTICS" },
      { routeKey: "bentley", displayName: "Bentley", domainLabel: "REVENUE OS" },
    ],
  },
  {
    id: "inbox",
    navLabel: "Inbox",
    shortLabel: "Inbox",
    description: "Admin Executive inbox — broadcast and direct messages to approved accounts.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "CONVERSATIONS",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [{ routeKey: "executive_admin", displayName: "Executive Admin", domainLabel: "INBOX" }],
  },
  {
    id: "tasks",
    navLabel: "Tasks",
    shortLabel: "Tasks",
    description: "Owner todos and approval-queue tasks — human execution only.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "TASKS",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "TASK ROUTER" },
      { routeKey: "executive_admin", displayName: "Executive Admin", domainLabel: "TASKS" },
    ],
    taskBadge: 8,
  },
  {
    id: "trust_jarva",
    navLabel: "Jarva",
    shortLabel: "TRUST",
    description: "TRUST / legal-review fulfillment — Jarva desk (read-only packets, no trust apply).",
    workspaceKind: "trust",
    departmentFocus: "TRUST",
    dashboardMode: "CRM",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [
      { routeKey: "jarva", displayName: "Jarva", domainLabel: "TRUST" },
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "LEGAL OPS" },
    ],
  },
  {
    id: "smart_trust",
    navLabel: "Smart Trust",
    shortLabel: "Trust Gov",
    description:
      "Smart Trust governance operations — review checkpoints, resolutions/minutes, compliance reminders (no autonomous trust execution).",
    workspaceKind: "smart_trust",
    departmentFocus: "SMART_TRUST",
    dashboardMode: "CRM",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "GOVERNANCE" },
      { routeKey: "executive_admin", displayName: "Executive Admin", domainLabel: "TRUST OPS" },
    ],
  },
  {
    id: "revenue_os",
    navLabel: "Revenue OS",
    shortLabel: "Revenue",
    description:
      "AI Revenue OS campaign fulfillment — review packets, launch readiness, KPI snapshots (no autonomous launch).",
    workspaceKind: "revenue_os",
    departmentFocus: "REVENUE_OS",
    dashboardMode: "REVENUE",
    delegateAgents: withSkipperNexus(["bentley", "executive_admin"]),
    agentSlots: [
      { routeKey: "bentley", displayName: "Bentley", domainLabel: "REVENUE OS" },
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "FULFILLMENT" },
    ],
  },
  {
    id: "troo_town",
    navLabel: "TROO TOWN",
    shortLabel: "TROO TOWN",
    description:
      "TROO TOWN 3D world desk — Evaana visitor conversations at TROOTHHERTZ LLC, world intelligence, and Skipper-governed follow-ups.",
    workspaceKind: "troo_town",
    departmentFocus: null,
    dashboardMode: "CONVERSATIONS",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [
      { routeKey: "evaana", displayName: "Evaana", domainLabel: "TROO WORLD" },
      { routeKey: "skipper", displayName: "SKIPPER", domainLabel: "FOLLOW-UP" },
    ],
  },
  {
    id: "settings",
    navLabel: "Settings",
    shortLabel: "Settings",
    description: "Routines, knowledge base, and system health.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "SYSTEM_HEALTH",
    delegateAgents: withSkipperNexus(["executive_admin"]),
    agentSlots: [{ routeKey: "executive_admin", displayName: "Executive Admin", domainLabel: "SYSTEM" }],
  },
  {
    id: "new_command",
    navLabel: "New Command",
    shortLabel: "New",
    description: "Ad-hoc multi-agent command — Skipper routes to the best read tools.",
    workspaceKind: "desk",
    departmentFocus: null,
    dashboardMode: "OVERVIEW",
    delegateAgents: withSkipperNexus(["reality", "bentley", "eleanor", "executive_admin"]),
    agentSlots: [{ routeKey: "skipper", displayName: "SKIPPER", domainLabel: "COMMAND" }],
  },
];

export function getExecutiveSubject(id: ExecutiveSubjectId): ExecutiveSubjectConfig {
  return EXECUTIVE_SUBJECTS.find((s) => s.id === id) ?? EXECUTIVE_SUBJECTS[0]!;
}

/** Map legacy bottom tab labels to subject ids. */
export function subjectIdFromBottomTab(tab: string): ExecutiveSubjectId {
  const map: Record<string, ExecutiveSubjectId> = {
    "Command Center": "command_center",
    "CRM Intelligence": "crm_intelligence",
    "AI Agents": "ai_agents",
    "Site Builder": "site_builder",
    Stephon: "site_builder",
    Analytics: "analytics",
    Inbox: "inbox",
    Tasks: "tasks",
    Settings: "settings",
    Jarva: "trust_jarva",
    "Revenue OS": "revenue_os",
    "Smart Trust": "smart_trust",
    "TROO TOWN": "troo_town",
  };
  return map[tab] ?? "command_center";
}

export function bottomTabFromSubjectId(id: ExecutiveSubjectId): string {
  return getExecutiveSubject(id).navLabel;
}

const SUBJECT_IDS = new Set(EXECUTIVE_SUBJECTS.map((s) => s.id));

export function isExecutiveSubjectId(s: string): s is ExecutiveSubjectId {
  return SUBJECT_IDS.has(s as ExecutiveSubjectId);
}
