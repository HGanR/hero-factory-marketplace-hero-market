/**
 * Guarded smoke verification for `runFullLifecycle` — distinguishes ok / blocked / waiting / unknown
 * without claiming publish success. Intended for internal debug harnesses only.
 */

import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import {
  fetchBentleyLifecycleServerFacts,
  type BentleyFullLifecycleOptions,
  type BentleyFullLifecycleResult,
} from "@/lib/revenue-os/bentley-full-lifecycle-orchestrator";

export type BentleyLifecycleSmokeVerdict = "ok" | "blocked" | "waiting" | "unknown";

export type BentleyLifecycleSmokeReport = {
  verdict: BentleyLifecycleSmokeVerdict;
  reasons: string[];
  lifecycleKeys: string[];
  pipelineStopped: boolean;
  fullLifecycleResult: BentleyFullLifecycleResult;
};

function classifyVerdict(r: BentleyFullLifecycleResult): BentleyLifecycleSmokeReport {
  const reasons: string[] = [];
  let verdict: BentleyLifecycleSmokeVerdict = "unknown";
  const wf = r.workflow;
  const lc = wf.lifecycle ?? {};

  if (!r.ok) {
    reasons.push(r.reason ?? `Stopped at ${r.stoppedAt}`);
    verdict = "blocked";
  } else if (r.reason?.includes("gates") || r.reason?.includes("Waiting")) {
    reasons.push(r.reason ?? "Deferred by policy or external wait.");
    verdict = "waiting";
  } else {
    verdict = "ok";
    reasons.push(`Run finished (stoppedAt=${r.stoppedAt}).`);
  }

  const lifecycleKeys = Object.keys(lc);
  const blocked = Object.values(lc).some(
    (v) => v && typeof v === "object" && "status" in v && (v as { status?: string }).status === "blocked"
  );
  const waiting = Object.values(lc).some(
    (v) => v && typeof v === "object" && "status" in v && (v as { status?: string }).status === "waiting"
  );

  if (blocked) {
    if (verdict === "ok") verdict = "blocked";
    reasons.push("Lifecycle records at least one **blocked** stage — review operational panel for exact codes.");
  } else if (waiting && verdict === "ok") {
    verdict = "waiting";
    reasons.push("Lifecycle records **waiting** stages (analytics, OAuth, or optimization prerequisites).");
  }

  return {
    verdict,
    reasons: [...new Set(reasons)],
    lifecycleKeys,
    pipelineStopped: !r.ok && r.stoppedAt !== "complete",
    fullLifecycleResult: r,
  };
}

/**
 * Runs full lifecycle with server facts fetch; does not enable optimization recommendation by default.
 */
export async function runBentleyLifecycleSmokeVerification(
  runner: {
    runFullLifecycle: (opts?: BentleyFullLifecycleOptions) => Promise<BentleyFullLifecycleResult>;
  },
  opts?: Pick<BentleyFullLifecycleOptions, "runOptimizationRecommendation">
): Promise<BentleyLifecycleSmokeReport> {
  const wf = loadWorkflowState();
  if (!wf.completed?.intake) {
    const stub: BentleyFullLifecycleResult = {
      ok: false,
      stoppedAt: "pipeline",
      reason: "Intake incomplete",
      workflow: wf,
    };
    return {
      verdict: "blocked",
      reasons: ["Guided intake is not complete — cannot smoke-run full lifecycle."],
      lifecycleKeys: [],
      pipelineStopped: true,
      fullLifecycleResult: stub,
    };
  }

  const r = await runner.runFullLifecycle({
    fetchServerFacts: fetchBentleyLifecycleServerFacts,
    runOptimizationRecommendation: opts?.runOptimizationRecommendation ?? false,
  });
  return classifyVerdict(r);
}
