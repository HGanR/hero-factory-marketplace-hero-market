/**
 * Client-side Skipper ↔ Bentley voice orchestration for Executive Admin.
 * Uses REAL bentley-orchestrator intake — no fake flow.
 */

import type { ClientReadinessAnswers } from "@/components/ai-revenue-os/ClientReadinessQuestionnaire";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  applyExecutiveBentleyIntakeAnswer,
  executiveBentleyIntakeGreeting,
  executiveBentleyIntakeComplete,
  executiveBentleyOpeningQuestion,
} from "@/lib/revenue-os/executive-bentley-intake";
import { readExecutiveBentleyCampaignMemory } from "@/lib/revenue-os/executive-bentley-campaign-memory";
import {
  assessExecutiveBentleyLaunchGovernance,
  executiveBentleyLaunchGovernanceVoiceLine,
} from "@/lib/revenue-os/executive-bentley-launch-governance";
import {
  startExecutiveBentleySession,
  touchExecutiveBentleySession,
} from "@/lib/revenue-os/executive-bentley-session";
import { buildExecutiveBentleyHudState } from "@/lib/revenue-os/executive-bentley-hud";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";

export type ExecutiveBentleyVoiceTurnResult = {
  handled: boolean;
  answer: string;
  hudSummary?: string;
  activateCampaignMode?: boolean;
  requestPipelineRun?: boolean;
  requestPipelineResume?: boolean;
  patch?: Partial<BentleySnapshot>;
  questionnairePatch?: Partial<ClientReadinessAnswers>;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isExecutiveBentleyCampaignStartPhrase(input: string): boolean {
  const t = norm(input);
  if (!t) return false;
  return (
    /\b(create|start|build|launch prep|run)\b.*\b(campaign|bentley)\b/.test(t) ||
    /\b(bentley|revenue os)\b.*\b(campaign|intake)\b/.test(t) ||
    /\bafternoon campaign\b/.test(t) ||
    /\blet'?s create a campaign\b/.test(t) ||
    /\bbentley campaign mode\b/.test(t)
  );
}

export function isExecutiveBentleyPipelineRunPhrase(input: string): boolean {
  const t = norm(input);
  return (
    /\brun (the )?(full )?(revenue os )?pipeline\b/.test(t) ||
    /\brun full analysis\b/.test(t) ||
    /\bresume pipeline\b/.test(t) ||
    /\bexecute (the )?campaign pipeline\b/.test(t)
  );
}

export function isExecutiveBentleyStatusPhrase(input: string): boolean {
  const t = norm(input);
  return (
    /\bcampaign status\b/.test(t) ||
    /\bwhere are we\b/.test(t) ||
    /\bworkflow status\b/.test(t) ||
    /\bbentley status\b/.test(t) ||
    /\bwhat stage\b/.test(t)
  );
}

export function isExecutiveBentleyLaunchStatusPhrase(input: string): boolean {
  const t = norm(input);
  return /\blaunch readiness\b/.test(t) || /\bcan we launch\b/.test(t) || /\bapproval queue\b/.test(t);
}

export type ExecutiveBentleyVoiceOrchestratorOpts = {
  transcript: string;
  getSnapshot: () => BentleySnapshot;
  adminUserId: string;
  clientId: string;
  intakeActive: boolean;
  campaignModeActive: boolean;
  pendingApprovals?: number | null;
  content360Configured?: boolean;
};

/**
 * Handle Bentley campaign voice locally before executive orchestrator LLM.
 * Returns `{ handled: false }` when the turn should fall through to server Skipper.
 */
export function tryExecutiveBentleyClientVoiceTurn(
  opts: ExecutiveBentleyVoiceOrchestratorOpts,
): ExecutiveBentleyVoiceTurnResult {
  const t = opts.transcript.trim();
  if (!t) return { handled: false, answer: "" };

  const snap = opts.getSnapshot();
  const memory = readExecutiveBentleyCampaignMemory();

  if (!opts.campaignModeActive && !opts.intakeActive && !isExecutiveBentleyCampaignStartPhrase(t)) {
    return { handled: false, answer: "" };
  }

  if (isExecutiveBentleyPipelineRunPhrase(t)) {
    if (!executiveBentleyIntakeComplete(snap)) {
      const q = executiveBentleyOpeningQuestion(snap);
      return {
        handled: true,
        answer: `Intake isn't complete yet, Boss. ${q}`,
        activateCampaignMode: true,
      };
    }
    if (!memory.session) {
      startExecutiveBentleySession({
        adminUserId: opts.adminUserId,
        clientId: opts.clientId,
        intakeActive: false,
      });
    }
    touchExecutiveBentleySession({ mode: "pipeline", intakeActive: false });
    return {
      handled: true,
      answer:
        "Roger. Running the **real Bentley pipeline** — research, trends, market sweep, content, campaign generation, media brief, and analysis. Watch the HUD for live stage progression. Launch stays approval-gated.",
      hudSummary: "Pipeline executing…",
      activateCampaignMode: true,
      requestPipelineRun: true,
    };
  }

  if (isExecutiveBentleyLaunchStatusPhrase(t)) {
    const gov = assessExecutiveBentleyLaunchGovernance(snap, {
      pendingApprovals: opts.pendingApprovals,
      content360Configured: opts.content360Configured,
    });
    return {
      handled: true,
      answer: executiveBentleyLaunchGovernanceVoiceLine(gov),
      hudSummary: gov.nextGovernedAction,
      activateCampaignMode: true,
    };
  }

  if (isExecutiveBentleyStatusPhrase(t)) {
    const wf = loadWorkflowState();
    const completed = Object.keys(wf.completed ?? {}).filter(Boolean).length;
    const hud = buildExecutiveBentleyHudState(snap, {
      pendingApprovals: opts.pendingApprovals,
      content360Configured: opts.content360Configured,
    });
    return {
      handled: true,
      answer: `${hud.headline}. ${hud.statusLine} ${completed} pipeline phase(s) marked complete in session.`,
      hudSummary: hud.statusLine,
      activateCampaignMode: true,
    };
  }

  if (isExecutiveBentleyCampaignStartPhrase(t) || (opts.campaignModeActive && !memory.session)) {
    startExecutiveBentleySession({
      adminUserId: opts.adminUserId,
      clientId: opts.clientId,
      intakeActive: !executiveBentleyIntakeComplete(snap),
    });
    const greeting = executiveBentleyIntakeGreeting(snap);
    const hud = buildExecutiveBentleyHudState(snap, {
      pendingApprovals: opts.pendingApprovals,
      content360Configured: opts.content360Configured,
    });
    return {
      handled: true,
      answer: greeting,
      hudSummary: hud.subline,
      activateCampaignMode: true,
    };
  }

  if (opts.intakeActive || (opts.campaignModeActive && !executiveBentleyIntakeComplete(snap))) {
    const applied = applyExecutiveBentleyIntakeAnswer(snap, t);
    if (!applied.ok) {
      return {
        handled: true,
        answer: applied.error,
        activateCampaignMode: true,
      };
    }
    touchExecutiveBentleySession({
      intakeActive: !applied.intakeComplete,
      mode: applied.intakeComplete ? "review" : "intake",
    });
    const followUp = applied.nextQuestion
      ? `\n\n${applied.nextQuestion}`
      : applied.intakeComplete
        ? "\n\nIntake complete. Say **run pipeline** to execute the real Bentley workflow."
        : "";
    return {
      handled: true,
      answer: `${applied.confirm}${followUp}`,
      hudSummary: applied.intakeComplete ? "Intake complete" : applied.nextQuestion ?? undefined,
      activateCampaignMode: true,
      patch: applied.patch,
      questionnairePatch: applied.questionnairePatch,
    };
  }

  return { handled: false, answer: "" };
}
