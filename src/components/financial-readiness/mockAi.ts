import type { FinancialReadinessState } from "./state";

export type AdvisorModule = "hub" | "foundation" | "optimization" | "resolution";

export type AdvisorContext = {
  module: AdvisorModule;
  stepLabel: string;
  state: FinancialReadinessState;
};

/** Deterministic mock “AI” — replace with internal model / orchestrator later. */
export function getMockAdvisorSuggestions(ctx: AdvisorContext): string[] {
  const { module, stepLabel, state } = ctx;
  const out: string[] = [];

  if (module === "hub") {
    out.push("Pick one path to start: foundation builds habits, optimization targets inaccuracies, resolution handles active collections.");
    out.push(
      state.meta.updatedAt
        ? "Your drafts and checkpoints persist in this browser (local storage). Use Reset on the hub only if you mean to wipe data."
        : "Complete the intake to route into a system — you can switch modules anytime."
    );
    return out;
  }

  if (module === "foundation") {
    const u = state.foundation.utilization;
    const ratio = u.limit > 0 ? (u.balance / u.limit) * 100 : 0;
    if (stepLabel.includes("Utilization") || stepLabel.includes("utilization")) {
      if (ratio > 30)
        out.push(`Utilization is about ${ratio.toFixed(0)}%. Aim for under 30% reported balance before statement date when possible.`);
      else out.push("Utilization looks controlled — keep balances low before the statement cuts.");
    }
    const done = Object.values(state.foundation.checklist).filter(Boolean).length;
    if (stepLabel.includes("profile") || stepLabel.includes("Checklist")) {
      out.push(
        done >= 3
          ? "Strong checklist progress — add credit monitoring and verify accounts age positively."
          : "Prioritize on-time payments and a low reported balance; those move scores fastest."
      );
    }
    if (stepLabel.includes("basics") || stepLabel.includes("Credit basics")) {
      out.push("Payment history and utilization drive most scoring models — consistency beats sporadic large payments.");
    }
    if (stepLabel.includes("Next")) {
      out.push(state.foundation.nextHint || "Export your checklist and set calendar reminders for statement dates.");
    }
  }

  if (module === "optimization") {
    const selected = state.optimization.negativeItems.filter((n) => n.selected);
    if (stepLabel.includes("Negative") || stepLabel.includes("items")) {
      out.push(
        selected.length
          ? `You have ${selected.length} item(s) marked for follow-up — validate dates and amounts before disputing.`
          : "Select items that may be inaccurate or unverifiable; avoid disputing accurate positive history."
      );
    }
    if (stepLabel.includes("Dispute") || stepLabel.includes("Letter")) {
      out.push("Reference account identifiers and request investigation — keep copies of all correspondence.");
    }
    if (stepLabel.includes("Timeline")) {
      out.push("Expect roughly 30 days for investigations; some cases extend toward 45 days under FCRA timelines.");
    }
    if (stepLabel.includes("Report")) {
      out.push("Paste notes from your soft pull or tri-merge summary; we’ll use them to tailor dispute drafts.");
    }
  }

  if (module === "resolution") {
    if (stepLabel.includes("log") || stepLabel.includes("Collector")) {
      out.push("Log time, channel, and any threats or misrepresentations — FDCPA cares about specific facts.");
    }
    if (stepLabel.includes("Validation")) {
      out.push("Debt validation should identify the creditor and amount owed; send within 30 days of first written notice when possible.");
    }
    if (stepLabel.includes("Cease")) {
      out.push("Cease communication stops contact with the collector — it does not erase valid debt.");
    }
    if (stepLabel.includes("FDCPA")) {
      out.push("Third-party collectors cannot harass, misrepresent, or call at odd hours — document violations with dates.");
    }
    if (stepLabel.includes("status") || stepLabel.includes("Case")) {
      out.push(`Current stage: ${state.resolution.caseStatus.replace(/_/g, " ")} — update when mail arrives.`);
    }
  }

  if (out.length === 0) {
    out.push("Continue filling in details — suggestions sharpen as your inputs grow.");
  }
  return out;
}
