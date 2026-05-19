import { z } from "zod";
import { EXECUTIVE_AGENT_KEYS } from "@/lib/executive-agent/agent-intelligence-bus";
import {
  EXECUTIVE_DASHBOARD_MODES,
  EXECUTIVE_TIME_RANGES,
} from "@/lib/executive-agent/executive-agent-chat-request";

const agentKeyEnum = z.enum(EXECUTIVE_AGENT_KEYS);

export const VoiceStartBodySchema = z.object({
  provider: z
    .enum(["placeholder", "browser_webrtc", "browser_stt", "openai_realtime", "elevenlabs"])
    .optional(),
  locale: z.string().max(32).optional(),
});

export const VoiceTurnBodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  transcript: z.string().min(1).max(16_000),
  mode: z.enum(["read", "plan", "write_request"]).default("read"),
  dryRun: z.boolean().optional(),
  selectedClientId: z.string().uuid().optional().nullable(),
  selectedCampaignId: z.string().uuid().optional().nullable(),
  selectedAgents: z.array(agentKeyEnum).max(8).optional(),
  selectedTimeRange: z.enum(EXECUTIVE_TIME_RANGES).optional(),
  dashboardMode: z.enum(EXECUTIVE_DASHBOARD_MODES).optional(),
});

export const VoiceEndBodySchema = z.object({
  sessionId: z.string().uuid(),
});

export type VoiceStartBody = z.infer<typeof VoiceStartBodySchema>;
export type VoiceTurnBody = z.infer<typeof VoiceTurnBodySchema>;
export type VoiceEndBody = z.infer<typeof VoiceEndBodySchema>;
