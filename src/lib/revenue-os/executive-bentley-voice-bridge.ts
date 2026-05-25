/**
 * Module bridge so ExecutiveAgentDashboard can invoke Bentley voice handler
 * without splitting the large dashboard component tree.
 */

import type { ExecutiveBentleyVoiceTurnResult } from "@/lib/revenue-os/executive-bentley-voice-orchestrator";

type Handler = (transcript: string) => ExecutiveBentleyVoiceTurnResult;

let voiceHandler: Handler | null = null;

export function setExecutiveBentleyVoiceHandler(handler: Handler | null): void {
  voiceHandler = handler;
}

export function tryExecutiveBentleyVoiceBridge(transcript: string): ExecutiveBentleyVoiceTurnResult {
  if (!voiceHandler) return { handled: false, answer: "" };
  return voiceHandler(transcript);
}

let pipelineRunner: (() => Promise<void>) | null = null;

export function setExecutiveBentleyPipelineRunner(runner: (() => Promise<void>) | null): void {
  pipelineRunner = runner;
}

export async function runExecutiveBentleyPipelineBridge(): Promise<void> {
  if (pipelineRunner) await pipelineRunner();
}
