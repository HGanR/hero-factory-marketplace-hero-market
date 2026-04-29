import { buildRetAgentContext } from "@/lib/ret/agent-context";
import type { RetAgentDraft } from "@/lib/ret/types";
import type { BuyerDraft } from "@/lib/maania/buyer-draft";
import type { MaaniaIntakePath } from "@/lib/maania/maania-intake";
import { buildBuyerDemoPayload, shouldAttachBuyerDemoPayload } from "@/lib/maania/build-buyer-demo-payload";
import {
  buyerDraftToProgressSnapshot,
  getBuyerIntakeProgress,
} from "@/lib/maania/buyer-progress";

export type BuildMaaniaSnapshotOptions = {
  /** When set, overrides draft.maaniaIntakePath (e.g. floating MAANIA chat). */
  intakePath?: MaaniaIntakePath;
  buyerDraft?: BuyerDraft;
  /** For-realtors embedded chat only */
  maaniaMode?: boolean;
  pageSource?: "for-realtors" | "realtor-demo";
};

/**
 * Single builder for `context.retSnapshot` — RET workspace + MAANIA branches.
 */
export function buildRetMaaniaSnapshot(
  draft: RetAgentDraft,
  options: BuildMaaniaSnapshotOptions = {}
): Record<string, unknown> {
  const base = buildRetAgentContext(draft);
  const path: MaaniaIntakePath =
    options.intakePath ?? draft.maaniaIntakePath ?? "unknown";

  const snapshot: Record<string, unknown> = {
    ...base,
    maaniaIntakePath: path,
    maaniaRole: "intake_and_demo_generation",
  };

  if (path === "buy" && options.buyerDraft) {
    const b = options.buyerDraft;
    const progress = getBuyerIntakeProgress(b);
    snapshot.buyerIntakeProgress = buyerDraftToProgressSnapshot(b);
    snapshot.buyerIntakeProgressMeta = {
      answeredCount: progress.answeredCount,
      totalCount: progress.totalCount,
      percent: progress.percent,
      missingFields: progress.missingFields,
    };
    snapshot.suggestedNextBuyerQuestion = progress.suggestedNextBuyerQuestion;
    snapshot.buyerFieldsCollectedCount = progress.answeredCount;
    snapshot.buyerTotalFields = progress.totalCount;
    if (shouldAttachBuyerDemoPayload(progress.percent)) {
      snapshot.buyerDemoPayload = buildBuyerDemoPayload(b);
    }
  }

  if (options.maaniaMode) {
    snapshot.maaniaMode = true;
    snapshot.pageSource = options.pageSource;
    snapshot.realtorListingAssist = true;
    snapshot.outputGoal =
      "Run intake: selling → RET transfer/listing intelligence; buying → buyer qualification. When enough data exists, offer consultant summary, client-facing summary, escalation flags, and demo/page-ready copy. Not legal advice.";
  }

  return snapshot;
}
