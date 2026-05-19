import { z } from "zod";
import { EXECUTIVE_AGENT_KEYS } from "@/lib/executive-agent/agent-intelligence-bus";

const agentKeyEnum = z.enum(EXECUTIVE_AGENT_KEYS);

export const EXECUTIVE_TIME_RANGES = ["LIVE", "1H", "24H", "7D", "30D"] as const;
export const EXECUTIVE_DASHBOARD_MODES = [
  "OVERVIEW",
  "CONVERSATIONS",
  "REVENUE",
  "CRM",
  "SITE_BUILDER",
  "CAMPAIGNS",
  "TASKS",
  "SYSTEM_HEALTH",
] as const;

export type ExecutiveTimeRange = (typeof EXECUTIVE_TIME_RANGES)[number];
export type ExecutiveDashboardMode = (typeof EXECUTIVE_DASHBOARD_MODES)[number];

export const ExecutiveChatBodySchema = z.object({
  prompt: z.string().min(1).max(16_000),
  mode: z.enum(["read", "plan", "write_request"]).default("read"),
  selectedClientId: z.string().uuid().optional().nullable(),
  selectedCampaignId: z.string().uuid().optional().nullable(),
  requestedTool: z.string().max(120).optional().nullable(),
  dryRun: z.boolean().optional(),
  selectedAgents: z.array(agentKeyEnum).max(8).optional(),
  selectedTimeRange: z.enum(EXECUTIVE_TIME_RANGES).optional(),
  dashboardMode: z.enum(EXECUTIVE_DASHBOARD_MODES).optional(),
});

export type ExecutiveChatBody = z.infer<typeof ExecutiveChatBodySchema>;
