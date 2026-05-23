import type {
  ExecutivePresenceSnapshot,
  ExecutiveToneMode,
  ExecutiveUrgencyLevel,
} from "@/lib/executive-agent/executive-presence-types";

const ACKNOWLEDGEMENTS = [
  "Understood, Boss — one moment while I align with the desk.",
  "Copy that — pulling live operational context.",
  "Got it — let me reconcile that against current incidents and approvals.",
  "Acknowledged — I'll stay advisory and approval-aware.",
];

const INTERRUPT_COPY =
  "You broke in mid-flow — I'll pivot to your latest priority. Nothing executes without your authorization.";

export function acknowledgementForInterrupt(): string {
  return ACKNOWLEDGEMENTS[Math.floor(Math.random() * ACKNOWLEDGEMENTS.length)]!;
}

export function pacingHintForUrgency(urgency: ExecutiveUrgencyLevel): "measured" | "urgent" | "reassuring" {
  if (urgency === "critical" || urgency === "urgent") return "urgent";
  if (urgency === "elevated") return "measured";
  return "reassuring";
}

function toneOpener(tone: ExecutiveToneMode, urgency: ExecutiveUrgencyLevel): string {
  switch (tone) {
    case "crisis_briefing":
      return urgency === "critical"
        ? "Boss — critical desk posture. I'll be direct."
        : "Boss — elevated crisis coordination on the desk.";
    case "operations_director":
      return "Boss — operations director mode. Here's where we stand.";
    case "executive_coordinator":
      return "Boss — coordinating across desks for you.";
    case "strategic_advisor":
      return "Boss — strategic read on the operation.";
    default:
      return "Good to have you back, Boss.";
  }
}

export function composeExecutivePresenceGreeting(snapshot: Pick<
  ExecutivePresenceSnapshot,
  | "toneMode"
  | "urgency"
  | "postureHeadline"
  | "criticalRisks"
  | "activeIncidents"
  | "workflowBottlenecks"
  | "topRecommendedAction"
  | "activeEntities"
  | "sessionContinuity"
>): string {
  const parts: string[] = [toneOpener(snapshot.toneMode, snapshot.urgency)];

  parts.push(snapshot.postureHeadline);

  if (snapshot.sessionContinuity.lastCheckInAt) {
    parts.push("Since your last check-in, I've kept continuity on the desk.");
  }

  if (snapshot.activeIncidents.length) {
    parts.push(`Active incidents: ${snapshot.activeIncidents.slice(0, 2).join("; ")}.`);
  }

  if (snapshot.criticalRisks.length) {
    parts.push(`Critical risks: ${snapshot.criticalRisks.slice(0, 2).join("; ")}.`);
  }

  if (snapshot.workflowBottlenecks.length) {
    parts.push(`Bottlenecks: ${snapshot.workflowBottlenecks.slice(0, 2).join("; ")}.`);
  }

  const activeAgents = snapshot.activeEntities
    .filter((e) => e.status === "online" || e.status === "watch")
    .map((e) => e.label)
    .slice(0, 4);
  if (activeAgents.length) {
    parts.push(`Live desks: ${activeAgents.join(", ")}.`);
  }

  if (snapshot.topRecommendedAction) {
    parts.push(`My top recommendation — ${snapshot.topRecommendedAction} — pending your authorization.`);
  } else {
    parts.push("What should we tackle first?");
  }

  return parts.join(" ");
}

export function buildVoiceGuidance(snapshot: Pick<ExecutivePresenceSnapshot, "urgency">) {
  return {
    acknowledgementPhrases: ACKNOWLEDGEMENTS,
    pacingHint: pacingHintForUrgency(snapshot.urgency),
    interruptHandling: INTERRUPT_COPY,
  };
}

/** Legacy fixed greeting — superseded when presence briefing is available. */
export function buildSkipperGreetingResponse(): string {
  return "Good day, Boss. How can I help you today?";
}

export function isVoiceAcknowledgementRequest(input: string): boolean {
  const t = input.trim().toLowerCase();
  return /^(yes|yeah|yep|ok|okay|go ahead|continue|proceed)[!.?]*$/.test(t);
}

export function isVoiceInterruptDuringBriefing(input: string): boolean {
  const t = input.trim().toLowerCase();
  return /^(wait|hold on|stop|pause|hang on|one sec)/.test(t);
}

export function buildVoiceInterruptAcknowledgement(): string {
  return `${acknowledgementForInterrupt()} ${INTERRUPT_COPY}`;
}
