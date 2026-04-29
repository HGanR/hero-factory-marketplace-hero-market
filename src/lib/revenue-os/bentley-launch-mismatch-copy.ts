/**
 * Operator-facing copy for `detectBentleyLaunchMismatches` issue codes.
 */

export type BentleyLaunchMismatchLine = {
  code: string;
  title: string;
  detail: string;
};

const LINES: Record<string, Omit<BentleyLaunchMismatchLine, "code">> = {
  workflow_has_db_campaign_but_no_posts: {
    title: "Campaign exists in the database but has no scheduled posts yet",
    detail:
      "Run Launch sync from AI Revenue OS (or retry finalize) so Bentley can create `campaign_posts` rows for each platform.",
  },
  workflow_has_db_campaign_but_no_launch_sync_timestamp: {
    title: "Campaign persisted but launch sync has not completed",
    detail:
      "Open AI Revenue OS and run the Launch / finalize step so posts are created and the workflow records a sync timestamp.",
  },
  launch_sync_recorded_but_launch_ready_still_incomplete: {
    title: "Launch sync is recorded but the Launch phase is still incomplete",
    detail:
      "Workflow state may be out of date — try advancing Launch again, or clear the stuck phase from support tooling if it persists.",
  },
  launch_sync_without_db_campaign_id: {
    title: "Launch sync timestamp without a DB campaign id",
    detail:
      "Session artifacts are inconsistent. Re-run campaign generation with persistence, or contact support if this persists.",
  },
  launch_finalize_blocked_empty_post_ids: {
    title: "Launch finalize blocked — sync returned no post rows",
    detail:
      "The sync API did not return any post ids. Check that the campaign has a Bentley generation payload and OAuth-resolvable platforms, then retry Launch.",
  },
};

export function bentleyLaunchMismatchLines(issues: string[]): BentleyLaunchMismatchLine[] {
  const out: BentleyLaunchMismatchLine[] = [];
  const seen = new Set<string>();
  for (const code of issues) {
    if (seen.has(code)) continue;
    seen.add(code);
    const row = LINES[code];
    if (row) {
      out.push({ code, ...row });
    } else {
      out.push({
        code,
        title: code,
        detail: "See Bentley debug / observability for raw workflow artifacts.",
      });
    }
  }
  return out;
}
