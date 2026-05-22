import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";
import type {
  CoordinationEvidenceLink,
  ExecutiveDeskAgentId,
  InterAgentThreadLink,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import { resolveAgentForThread } from "@/lib/executive-agent/persistent-agent-workspaces";
import { buildExecutiveAgentHierarchy } from "@/lib/executive-agent/executive-agent-hierarchy";

function targetAgentsForThread(
  source: ExecutiveDeskAgentId,
  thread: ExecutiveOperationalThreadDto
): ExecutiveDeskAgentId[] {
  const hierarchy = buildExecutiveAgentHierarchy();
  const targets = new Set<ExecutiveDeskAgentId>();

  if (thread.decisionNeeded) targets.add("skipper");

  if (thread.department === "REVENUE_OS" && source !== "bentley") targets.add("bentley");
  if (
    (thread.department === "TRUST" || thread.department === "SMART_TRUST") &&
    source !== "jarva"
  )
    targets.add("jarva");
  if (thread.department === "WEBSITE" && source !== "reality") targets.add("reality");

  if (thread.unresolvedQuestionCount > 0 && source !== "eleanor") targets.add("eleanor");

  const sourceNode = hierarchy.find((n) => n.agentId === source);
  if (sourceNode?.reportsTo && sourceNode.reportsTo !== source) {
    targets.add(sourceNode.reportsTo);
  }

  targets.delete(source);
  return [...targets];
}

export function buildInterAgentThreadLinks(
  threads: ExecutiveOperationalThreadDto[]
): InterAgentThreadLink[] {
  const open = threads.filter((t) => t.status === "open" || t.status === "monitoring");

  return open
    .map((thread) => {
      const sourceAgentId = resolveAgentForThread(thread);
      const targetAgentIds = targetAgentsForThread(sourceAgentId, thread);
      if (targetAgentIds.length === 0) return null;

      const evidence: CoordinationEvidenceLink[] = [
        { source: "threads", detail: `Thread ${thread.id.slice(0, 8)}… kind=${thread.threadKind}` },
      ];
      if (thread.clientId) evidence.push({ source: "tasks", detail: `Client scope ${thread.clientId.slice(0, 8)}…` });
      if (thread.decisionNeeded) evidence.push({ source: "hierarchy", detail: "Decision needed — nexus visibility required" });

      return {
        id: `link-${thread.id}`,
        threadId: thread.id,
        title: thread.title,
        sourceAgentId,
        targetAgentIds,
        department: thread.department,
        clientId: thread.clientId,
        summary: `${sourceAgentId} thread "${thread.title}" coordinates with ${targetAgentIds.join(", ")}`,
        evidence,
      } satisfies InterAgentThreadLink;
    })
    .filter(Boolean) as InterAgentThreadLink[];
}
