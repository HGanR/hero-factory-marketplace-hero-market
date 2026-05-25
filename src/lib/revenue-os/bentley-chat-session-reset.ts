/**
 * Clears Bentley browser persistence for a true “start over” from chat (session-scoped intake, workflow, locks).
 * Does not dispatch `bentley-workflow-updated` — caller should reset React state, reconcile, then notify.
 */

import { BENTLEY_WORKER_LAST_RUN_SESSION_KEY } from "@/lib/revenue-os/bentley-approval-worker-analytics-chat";
import { clearCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import { BENTLEY_CAMPAIGN_PERSIST_RUN_SESSION_KEY } from "@/lib/revenue-os/bentley-campaign-persist-run-id";
import {
  BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
  REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
  REVENUE_OS_BENTLEY_APPLIED_FORM_KEY,
  REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY,
  REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY,
  REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY,
  REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import { BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY } from "@/lib/revenue-os/bentley-first-campaign-ui";
import { BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY } from "@/lib/revenue-os/bentley-publish-approval-chat";
import { BENTLEY_OBSERVABILITY_CHANGED_EVENT, BENTLEY_OBSERVABILITY_STORAGE_KEY } from "@/lib/revenue-os/bentley-run-observability";
import { clearAllBentleyRunLockSessionRows } from "@/lib/revenue-os/bentley-run-lock";
import {
  removeAllSessionKeysForLogicalBase,
  removeBentleySessionScopedAndLegacy,
} from "@/lib/revenue-os/bentley-storage-scope";
import { clearAllBentleyWorkflowSessionRows } from "@/lib/revenue-os/bentley-workflow";
import { REVENUE_OS_CONTENT_ENGINE_CACHE_KEY } from "@/lib/revenue-os/content-engine-cache";
import { LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, notifyLaunchProgressUpdated } from "@/lib/revenue-os/launch-progress-storage";

export function clearBentleyPersistedStorageForFreshChat(): void {
  if (typeof window === "undefined") return;
  try {
    clearAllBentleyWorkflowSessionRows();
    clearCanonicalBentleySnapshot();
    clearAllBentleyRunLockSessionRows();

    for (const k of [
      BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
      REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY,
      REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY,
      REVENUE_OS_BENTLEY_APPLIED_FORM_KEY,
      REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY,
      REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY,
      REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
      BENTLEY_OBSERVABILITY_STORAGE_KEY,
      LAUNCH_CYCLE_PROGRESS_STORAGE_KEY,
      BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY,
      REVENUE_OS_CONTENT_ENGINE_CACHE_KEY,
      BENTLEY_CAMPAIGN_PERSIST_RUN_SESSION_KEY,
    ]) {
      removeAllSessionKeysForLogicalBase(k);
    }

    removeBentleySessionScopedAndLegacy(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY);
    removeBentleySessionScopedAndLegacy(BENTLEY_WORKER_LAST_RUN_SESSION_KEY);

    try {
      sessionStorage.removeItem("airos_dashboard_deployment_feedback_enriched");
    } catch {
      /* ignore */
    }

    try {
      window.dispatchEvent(new CustomEvent(BENTLEY_OBSERVABILITY_CHANGED_EVENT));
    } catch {
      /* ignore */
    }

    notifyLaunchProgressUpdated();
  } catch {
    /* ignore */
  }
}
