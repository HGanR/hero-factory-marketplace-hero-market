import {
  extractBudgetAllocation,
  type BudgetAllocationRow,
} from "@/lib/revenue-os/capital-plan-vs-actuals";

/** Map capital mix labels (Module 4) to deployment channels (Module 3). */
const MIX_TO_DEPLOY: Record<string, "email" | "sms"> = {
  paid: "email",
  organic: "email",
  referral: "sms",
};

function dedupeDeployOrder(channels: ("email" | "sms")[]): ("email" | "sms")[] {
  const out: ("email" | "sms")[] = [];
  const seen = new Set<string>();
  for (const c of channels) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * Derive a stable email vs SMS priority from plan budget allocation (higher spend first).
 * Does not change persisted artifacts unless callers store the returned object.
 */
export function deriveDeploymentChannelPriority(params: {
  payload: Record<string, unknown> | null | undefined;
  channelMix: Record<string, unknown> | null | undefined;
}): {
  channelPriority: ("email" | "sms")[];
  rationale: string;
  budgetAllocationSnapshot: BudgetAllocationRow[];
} {
  let rows = extractBudgetAllocation(params.payload);
  if (rows.length === 0 && params.channelMix && typeof params.channelMix === "object") {
    const mix = params.channelMix as Record<string, unknown>;
    const total =
      Object.values(mix).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0) ||
      100;
    rows = Object.entries(mix)
      .map(([channel, pct]) => ({
        channel,
        pct: typeof pct === "number" ? pct : Number(pct) || 0,
        spend: 0,
      }))
      .map((r) => ({
        ...r,
        spend: Math.round((r.pct / total) * 100),
      }));
  }

  const sorted = [...rows].sort((a, b) => b.spend - a.spend);
  const mapped = sorted.map((r) => {
    const key = r.channel.trim().toLowerCase();
    return MIX_TO_DEPLOY[key] ?? "email";
  });
  const channelPriority = dedupeDeployOrder(mapped);
  if (channelPriority.length === 0) {
    channelPriority.push("email", "sms");
  } else if (channelPriority.length === 1) {
    channelPriority.push(channelPriority[0] === "email" ? "sms" : "email");
  }

  return {
    channelPriority,
    rationale:
      "Ordered by planned spend (desc), mapped: paid/organic→email, referral→sms.",
    budgetAllocationSnapshot: sorted,
  };
}
