/** Pure Claude handoff builder (no server-only; safe for unit tests). */

export type PendingClientQueueItem = {
  id: string;
  marketplaceUserId: number;
  crmClientId: string | null;
  name: string;
  email: string;
  username: string;
  requestedService: string | null;
  requestedServices: string[];
  status: "pending_approval";
  intakeType: "marketplace_signup" | "crm_intake";
  createdAt: string;
  notes: string | null;
  isActive: boolean;
};

export type PendingClientsClaudeHandoff = {
  version: "1";
  generatedAt: string;
  summaryLine: string;
  counts: {
    pendingAllTime: number;
    pendingApprox30d: number;
    returned: number;
  };
  pendingClients: PendingClientQueueItem[];
  suggestedPrompts: string[];
};

/** Safe for Executive Agent chat, voice, and orchestrator insights (no row-level PII). */
export type PendingClientsClaudeHandoffPublic = Omit<PendingClientsClaudeHandoff, "pendingClients">;

export function toPublicPendingClientsHandoff(
  handoff: PendingClientsClaudeHandoff,
): PendingClientsClaudeHandoffPublic {
  const { pendingClients: _rows, ...publicHandoff } = handoff;
  return publicHandoff;
}

/** Audit log payload for tool invocations — counts and lengths only, no queue rows. */
export function pendingClientsQueueToolAuditOutput(handoff: PendingClientsClaudeHandoffPublic): string {
  return JSON.stringify({
    tool: "getPendingClientsQueue",
    counts: handoff.counts,
    summaryLineLength: handoff.summaryLine.length,
    suggestedPromptsCount: handoff.suggestedPrompts.length,
  });
}

function humanizeServiceLabel(label: string): string {
  return label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function buildPendingClientsClaudeHandoff(
  items: PendingClientQueueItem[],
  counts: { pendingAllTime: number; pendingApprox30d: number },
): PendingClientsClaudeHandoff {
  const n = items.length;
  const serviceBuckets = new Map<string, number>();
  for (const item of items) {
    const key = item.requestedService ?? (item.intakeType === "marketplace_signup" ? "marketplace_signup" : "unspecified");
    serviceBuckets.set(key, (serviceBuckets.get(key) ?? 0) + 1);
  }

  const bucketParts = [...serviceBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => {
      const pretty =
        label === "marketplace_signup"
          ? "marketplace signup (no CRM intake yet)"
          : label === "unspecified"
            ? "no requested service on file"
            : humanizeServiceLabel(label);
      return count === 1 ? `one requested ${pretty}` : `${count} requested ${pretty}`;
    });

  let summaryLine: string;
  if (counts.pendingAllTime === 0) {
    summaryLine = "There are no marketplace accounts waiting for approval.";
  } else if (n === 0) {
    summaryLine = `${counts.pendingAllTime} account(s) are pending approval (${counts.pendingApprox30d} in the last 30 days). None matched this page of the queue.`;
  } else {
    const lead = `You have ${counts.pendingAllTime} pending marketplace account(s) (${counts.pendingApprox30d} in the last 30 days). Showing ${n} newest.`;
    summaryLine = bucketParts.length ? `${lead} ${bucketParts.join("; ")}.` : lead;
  }

  const suggestedPrompts: string[] = [];
  if (n > 0) {
    suggestedPrompts.push("Draft a welcome / next-step reply for the newest pending signup.");
    if (items.some((i) => i.requestedServices.length > 0)) {
      suggestedPrompts.push("Summarize requested services across the pending queue and recommend intake order.");
    }
    if (counts.pendingAllTime > n) {
      suggestedPrompts.push("Which pending accounts are oldest and should be prioritized for approval?");
    }
  }

  return {
    version: "1",
    generatedAt: new Date().toISOString(),
    summaryLine,
    counts: {
      pendingAllTime: counts.pendingAllTime,
      pendingApprox30d: counts.pendingApprox30d,
      returned: n,
    },
    pendingClients: items,
    suggestedPrompts,
  };
}
