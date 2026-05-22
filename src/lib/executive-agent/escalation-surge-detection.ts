import type {
  EscalationSurgeResult,
  ExecutiveCommandEngineInput,
} from "@/lib/executive-agent/executive-command-types";

export function detectEscalationSurge(
  input: ExecutiveCommandEngineInput
): EscalationSurgeResult {
  let proposedEscalations = 0;
  for (const t of input.tasks) {
    const meta = input.metadataByTaskId.get(t.id);
    if (meta?.escalation?.status === "proposed" || meta?.escalation?.status === "approved") {
      proposedEscalations += 1;
    }
  }

  const overdueTasks = input.tasks.filter((t) => t.isOverdue && t.status !== "completed").length;
  const surgeDetected = proposedEscalations >= 2 || (proposedEscalations >= 1 && overdueTasks >= 3);

  const severity =
    proposedEscalations >= 3 || overdueTasks >= 5
      ? "critical"
      : surgeDetected
        ? "high"
        : proposedEscalations >= 1
          ? "medium"
          : "watch";

  return {
    surgeDetected,
    proposedEscalations,
    overdueTasks,
    severity,
    evidence: [
      { source: "tasks", detail: `${proposedEscalations} escalation(s), ${overdueTasks} overdue` },
    ],
    advisoryOnly: true,
  };
}
