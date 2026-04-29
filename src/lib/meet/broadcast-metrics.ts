/**
 * Log-based metrics (JSON lines). Same drain as `broadcast-audit`; upgrade path: Datadog statsd / OpenTelemetry counters.
 */
export type BroadcastMetricFields = {
  userId?: number | null;
  roomId?: string | null;
  sessionId?: number | null;
  reason?: string | null;
};

function emit(metric: string, fields: BroadcastMetricFields): void {
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({
    timestamp,
    component: "meet_broadcast_metrics",
    metric,
    userId: fields.userId ?? null,
    roomId: fields.roomId ?? null,
    sessionId: fields.sessionId ?? null,
    reason: fields.reason ?? null,
  });
  console.info(line);
}

export function incrementBroadcastStartAttempt(fields: BroadcastMetricFields): void {
  emit("broadcast_start_attempt", fields);
}

export function incrementBroadcastStartSuccess(fields: BroadcastMetricFields): void {
  emit("broadcast_start_success", fields);
}

export function incrementBroadcastStartIdempotent(fields: BroadcastMetricFields): void {
  emit("broadcast_start_idempotent", fields);
}

export function incrementBroadcastRoomBusy(fields: BroadcastMetricFields): void {
  emit("broadcast_room_busy", fields);
}

export function incrementBroadcastPreflightFailure(fields: BroadcastMetricFields): void {
  emit("broadcast_preflight_failure", fields);
}

export function incrementBroadcastEgressFailure(fields: BroadcastMetricFields): void {
  emit("broadcast_egress_failure", fields);
}

export function incrementBroadcastStop(fields: BroadcastMetricFields): void {
  emit("broadcast_stop", fields);
}

export function incrementBroadcastStopNoop(fields: BroadcastMetricFields): void {
  emit("broadcast_stop_noop", fields);
}

export function incrementBroadcastReconciled(fields: BroadcastMetricFields): void {
  emit("broadcast_reconciled", fields);
}

export function incrementBroadcastDegraded(fields: BroadcastMetricFields): void {
  emit("broadcast_degraded", fields);
}

export function incrementBroadcastCompositorV2Attempt(fields: BroadcastMetricFields): void {
  emit("broadcast_compositor_v2_attempt", fields);
}

export function incrementBroadcastCompositorV2Fallback(fields: BroadcastMetricFields): void {
  emit("broadcast_compositor_v2_fallback", fields);
}

export function incrementBroadcastCompositorV2Success(fields: BroadcastMetricFields): void {
  emit("broadcast_compositor_v2_success", fields);
}

export function incrementBroadcastCompositorV2Failure(fields: BroadcastMetricFields): void {
  emit("broadcast_compositor_v2_failure", fields);
}

export function incrementBroadcastLiveSceneChange(fields: BroadcastMetricFields): void {
  emit("broadcast_live_scene_change", fields);
}

export function incrementBroadcastLiveSceneReset(fields: BroadcastMetricFields): void {
  emit("broadcast_live_scene_reset", fields);
}

export function incrementBroadcastLiveSceneError(fields: BroadcastMetricFields): void {
  emit("broadcast_live_scene_error", fields);
}

export function incrementBroadcastOverlayChange(fields: BroadcastMetricFields): void {
  emit("broadcast_overlay_change", fields);
}

export function incrementBroadcastOverlayReset(fields: BroadcastMetricFields): void {
  emit("broadcast_overlay_reset", fields);
}

export function incrementBroadcastOverlayError(fields: BroadcastMetricFields): void {
  emit("broadcast_overlay_error", fields);
}

export function incrementBroadcastScheduleChange(fields: BroadcastMetricFields): void {
  emit("broadcast_schedule_change", fields);
}

export function incrementBroadcastScheduleReset(fields: BroadcastMetricFields): void {
  emit("broadcast_schedule_reset", fields);
}

export function incrementBroadcastScheduleError(fields: BroadcastMetricFields): void {
  emit("broadcast_schedule_error", fields);
}

export function incrementBroadcastScheduleActionExecute(fields: BroadcastMetricFields): void {
  emit("broadcast_schedule_action_execute", fields);
}

export function incrementBroadcastScheduleActionFail(fields: BroadcastMetricFields): void {
  emit("broadcast_schedule_action_fail", fields);
}

export function incrementBroadcastRealtimeConnect(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_connect", fields);
}

export function incrementBroadcastRealtimeDisconnect(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_disconnect", fields);
}

export function incrementBroadcastRealtimeError(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_error", fields);
}

export function incrementBroadcastRealtimeEventPublish(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_event_publish", fields);
}

export function incrementBroadcastRealtimeEventPublishFail(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_event_publish_fail", fields);
}

export function incrementBroadcastRealtimeBackendMemory(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_backend_memory", fields);
}

export function incrementBroadcastRealtimeBackendDistributed(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_backend_distributed", fields);
}

export function incrementBroadcastRealtimeBackendFallback(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_backend_fallback", fields);
}

export function incrementBroadcastRealtimePublishSuccess(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_publish_success", fields);
}

export function incrementBroadcastRealtimePublishFail(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_publish_fail", fields);
}

export function incrementBroadcastRealtimeSubscribeSuccess(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_subscribe_success", fields);
}

export function incrementBroadcastRealtimeSubscribeFail(fields: BroadcastMetricFields): void {
  emit("broadcast_realtime_subscribe_fail", fields);
}

export function incrementBroadcastAutoDirectingChange(fields: BroadcastMetricFields): void {
  emit("broadcast_auto_directing_change", fields);
}

export function incrementBroadcastAutoDirectingDecision(fields: BroadcastMetricFields): void {
  emit("broadcast_auto_directing_decision", fields);
}

export function incrementBroadcastAutoDirectingApply(fields: BroadcastMetricFields): void {
  emit("broadcast_auto_directing_apply", fields);
}

export function incrementBroadcastAutoDirectingPauseManualOverride(fields: BroadcastMetricFields): void {
  emit("broadcast_auto_directing_pause_manual_override", fields);
}

export function incrementBroadcastAutoDirectingError(fields: BroadcastMetricFields): void {
  emit("broadcast_auto_directing_error", fields);
}

export function incrementBroadcastEventCreate(fields: BroadcastMetricFields): void {
  emit("broadcast_event_create", fields);
}

export function incrementBroadcastEventUpdate(fields: BroadcastMetricFields): void {
  emit("broadcast_event_update", fields);
}

export function incrementBroadcastEventDelete(fields: BroadcastMetricFields): void {
  emit("broadcast_event_delete", fields);
}

export function incrementBroadcastEventPrepareLaunch(fields: BroadcastMetricFields): void {
  emit("broadcast_event_prepare_launch", fields);
}

export function incrementBroadcastEventLaunch(fields: BroadcastMetricFields): void {
  emit("broadcast_event_launch", fields);
}

/** Idempotent start linked a broadcast event to the existing session (attached or already linked). */
export function incrementBroadcastEventIdempotentAttach(fields: BroadcastMetricFields): void {
  emit("broadcast_event_idempotent_attach", fields);
}

export function incrementBroadcastEventIdempotentAttachConflict(fields: BroadcastMetricFields): void {
  emit("broadcast_event_idempotent_attach_conflict", fields);
}

export function incrementBroadcastTimelineTemplateCreate(fields: BroadcastMetricFields): void {
  emit("broadcast_timeline_template_create", fields);
}

export function incrementBroadcastTimelineTemplateUpdate(fields: BroadcastMetricFields): void {
  emit("broadcast_timeline_template_update", fields);
}

export function incrementBroadcastTimelineTemplateDelete(fields: BroadcastMetricFields): void {
  emit("broadcast_timeline_template_delete", fields);
}

export function incrementBroadcastCalendarLinkCreate(fields: BroadcastMetricFields): void {
  emit("broadcast_calendar_link_create", fields);
}

export function incrementBroadcastCalendarLinkDelete(fields: BroadcastMetricFields): void {
  emit("broadcast_calendar_link_delete", fields);
}

export function incrementBroadcastCalendarImport(fields: BroadcastMetricFields): void {
  emit("broadcast_calendar_import", fields);
}

export function incrementBroadcastCalendarExport(fields: BroadcastMetricFields): void {
  emit("broadcast_calendar_export", fields);
}

export function incrementBroadcastCalendarSync(fields: BroadcastMetricFields): void {
  emit("broadcast_calendar_sync", fields);
}

export function incrementBroadcastCalendarSyncError(fields: BroadcastMetricFields): void {
  emit("broadcast_calendar_sync_error", fields);
}

export function incrementBroadcastAnalyticsDashboardView(fields: BroadcastMetricFields): void {
  emit("broadcast_analytics_dashboard_view", fields);
}

export function incrementBroadcastAnalyticsDashboardFilter(fields: BroadcastMetricFields): void {
  emit("broadcast_analytics_dashboard_filter", fields);
}

export function incrementBroadcastLaunchReadinessView(fields: BroadcastMetricFields): void {
  emit("broadcast_launch_readiness_view", fields);
}

export function incrementBroadcastLaunchReadinessBlocked(fields: BroadcastMetricFields): void {
  emit("broadcast_launch_readiness_blocked", fields);
}

export function incrementBroadcastLaunchReadinessAttention(fields: BroadcastMetricFields): void {
  emit("broadcast_launch_readiness_attention", fields);
}

export function incrementBroadcastRemindersView(fields: BroadcastMetricFields): void {
  emit("broadcast_reminders_view", fields);
}

export function incrementBroadcastShowPackageCreate(fields: BroadcastMetricFields): void {
  emit("broadcast_show_package_create", fields);
}

export function incrementBroadcastShowPackageUpdate(fields: BroadcastMetricFields): void {
  emit("broadcast_show_package_update", fields);
}

export function incrementBroadcastShowPackageDelete(fields: BroadcastMetricFields): void {
  emit("broadcast_show_package_delete", fields);
}

export function incrementBroadcastShowPackageApply(fields: BroadcastMetricFields): void {
  emit("broadcast_show_package_apply", fields);
}

export function incrementBroadcastOverlayPackCreate(fields: BroadcastMetricFields): void {
  emit("broadcast_overlay_pack_create", fields);
}

export function incrementBroadcastOverlayPackApply(fields: BroadcastMetricFields): void {
  emit("broadcast_overlay_pack_apply", fields);
}

export function incrementBroadcastGuestCardPackCreate(fields: BroadcastMetricFields): void {
  emit("broadcast_guest_card_pack_create", fields);
}

export function incrementBroadcastGuestCardApply(fields: BroadcastMetricFields): void {
  emit("broadcast_guest_card_apply", fields);
}
