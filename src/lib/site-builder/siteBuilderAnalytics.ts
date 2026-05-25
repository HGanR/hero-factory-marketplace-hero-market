/**
 * Lightweight, fire-and-forget site-builder instrumentation.
 * Disable with NEXT_PUBLIC_SITE_BUILDER_ANALYTICS_DISABLED=true
 *
 * Does not send raw prompts or full schema — only ids and coarse settings.
 *
 * Session readout (dev / NEXT_PUBLIC_SITE_BUILDER_ANALYTICS_READOUT=1): see siteBuilderAnalyticsReadout.ts
 */

import { ingestSiteBuilderReadoutEvent } from "./siteBuilderAnalyticsReadout";

export type SiteBuilderAnalyticsEvent =
  | "site_builder_inspiration_chip_clicked"
  | "site_builder_proof_snapshot_clicked"
  | "site_builder_full_build_started"
  | "site_builder_full_build_completed"
  | "site_builder_full_build_failed"
  | "site_builder_plan_only_completed"
  | "site_builder_plan_only_failed"
  | "site_builder_section_regenerate_completed"
  | "site_builder_section_regenerate_failed"
  | "site_builder_section_edit_requested"
  | "site_builder_section_edit_completed"
  | "site_builder_section_edit_scope_applied"
  | "site_builder_section_swap_applied"
  | "site_builder_canvas_section_selected"
  | "site_builder_canvas_edit_opened"
  | "site_builder_canvas_edit_submitted"
  | "site_builder_canvas_edit_cancelled"
  | "site_builder_canvas_multi_section_selected"
  | "site_builder_batch_section_edit_submitted"
  | "site_builder_batch_section_edit_completed"
  | "site_builder_layout_restructure_applied"
  | "site_builder_token_updated"
  | "site_builder_token_propagated"
  | "site_builder_brand_governance_applied"
  | "site_builder_version_save_completed"
  | "site_builder_version_save_failed"
  | "site_builder_advanced_opened"
  | "site_builder_deploy_completed"
  | "site_builder_deploy_failed"
  | "site_builder_project_export_downloaded"
  | "site_builder_deployment_target_selected"
  | "site_builder_asset_uploaded"
  | "site_builder_asset_removed"
  | "site_builder_composer_image_attached"
  | "site_builder_export_bundled_assets"
  | "site_builder_brand_brain_evaluated"
  | "site_builder_brand_brain_fix_applied"
  | "site_builder_brand_brain_suggestion_shown"
  | "site_builder_brand_brain_suggestion_accepted"
  | "site_builder_brand_brain_suggestion_dismissed"
  | "site_builder_launch_readiness_evaluated"
  | "site_builder_launch_queue_item_shown"
  | "site_builder_launch_queue_item_accepted"
  | "site_builder_launch_queue_item_dismissed"
  | "site_builder_conversion_path_issue_detected"
  | "site_builder_companion_page_suggested"
  | "site_builder_site_import_started"
  | "site_builder_site_import_completed"
  | "site_builder_site_import_failed"
  | "site_builder_widget_attached"
  | "site_builder_import_blueprint_converted"
  | "site_builder_imported_site_exported"
  | "site_builder_import_audit_evaluated"
  | "site_builder_import_opportunity_shown"
  | "site_builder_import_opportunity_accepted"
  | "site_builder_import_opportunity_dismissed"
  | "site_builder_import_restructure_applied"
  | "site_builder_deliverables_pack_generated"
  | "site_builder_deliverables_asset_downloaded"
  | "site_builder_client_handoff_generated"
  | "site_builder_client_handoff_downloaded"
  | "site_builder_client_handoff_previewed"
  | "site_builder_proposal_generated"
  | "site_builder_proposal_downloaded"
  | "site_builder_proposal_tier_selected"
  | "site_builder_close_package_generated"
  | "site_builder_close_package_downloaded"
  | "site_builder_onboarding_packet_generated"
  | "site_builder_payment_integration_configured"
  | "site_builder_payment_integration_rendered"
  | "site_builder_payment_export_included"
  | "site_builder_execute_intent_applied"
  | "site_builder_execute_intent_failed"
  | "site_builder_execute_intent_no_op"
  | "site_builder_draft_apply"
  | "site_builder_variant_selection_recorded"
  | "site_builder_variant_selection_record_failed";

export type SiteBuilderAnalyticsProps = Record<string, string | number | boolean | undefined | null>;

function isDisabled(): boolean {
  return (
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_BUILDER_ANALYTICS_DISABLED === "true"
  );
}

function compactProps(props?: SiteBuilderAnalyticsProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Non-blocking: schedules work on a microtask; never throws to callers.
 */
export function trackSiteBuilderEvent(event: SiteBuilderAnalyticsEvent, props?: SiteBuilderAnalyticsProps): void {
  const compact = compactProps(props);
  queueMicrotask(() => {
    try {
      if (typeof window !== "undefined") {
        ingestSiteBuilderReadoutEvent(event, compact);
      }
      if (isDisabled()) return;
      if (typeof window === "undefined") return;
      const payload = { event, ...compact };
      const w = window as Window & {
        dataLayer?: Record<string, unknown>[];
        __siteBuilderAnalyticsListener?: (event: string, props: Record<string, string | number | boolean>) => void;
      };
      w.dataLayer?.push(payload);
      w.__siteBuilderAnalyticsListener?.(event, compact);
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- dev-only observability
        console.debug("[site-builder analytics]", event, compact);
      }
    } catch {
      /* ignore */
    }
  });
}
