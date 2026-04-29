# Meet broadcast — internal runbook

Short reference for engineering and support. Code lives under `src/lib/meet/`, `src/lib/streaming/`, `src/app/api/meet/broadcast/`, and `src/components/meet/`.

## Host identity

- **Source of truth**: signed-in marketplace user (`auth-token` / `admin-token` cookie → `getAuthedUserId`).
- **UI**: `GET /api/meet/broadcast/context` returns masked email, masked linked wallet, `hostRule` (`sign_in_only` | `wallet_must_match`), and `hostRuleDetail`.
- **Rule**: If the account has a **linked wallet** on `marketplace_users`, the **connected wallet in the meeting** must match (case-insensitive), or APIs return **`broadcast_host_mismatch`**. The context route does **not** take the client wallet as input; correctness is server-side only.

## Stream destinations (RTMP) — encryption env

- **Required for persistence (saved destinations)**: **`STREAM_DESTINATION_ENCRYPTION_KEY`** must be set in the **server** environment (same process as Next/API routes). Without it, **`POST /api/stream-destinations`** and **`PATCH /api/stream-destinations/[id]`** return **503** with `code: stream_destination_encryption_not_configured` and a clear `error` message — credentials are **not** stored. **`GET /api/stream-destinations`** still lists existing rows and includes **`encryptionConfigured: false`** so the UI can show a banner and disable Save until the server is fixed.
- **Not required for one-time RTMP**: Hosts can start a broadcast with **`ephemeralRtmp`** on **`POST /api/meet/broadcast/start`** (server URL + stream key for **this session only**). That path does **not** write to **`stream_destinations`** and does **not** use `decryptStreamKey`. If the start request **includes any saved** active destinations, encryption must still be configured so those rows can be decrypted for egress.
- **Key format**: 32 bytes, supplied as **base64** or **64-character hex** (see `src/lib/streaming/crypto.ts`). Treat like any production secret (not client-exposed, not committed).
- **Broadcast start + encryption**: If the operator includes saved destinations in the start request and encryption is missing, **`POST /api/meet/broadcast/start`** returns **503** with `code: broadcast_encryption_unconfigured`. Ephemeral-only starts (`savedDestinationIds: []` + valid `ephemeralRtmp`) do **not** hit that requirement.
- **Operator UX**: The destinations dialog shows save errors **inside the modal** (not only under the fold). When encryption is off, Save is disabled and both the panel and dialog explain the server misconfiguration; the broadcast panel still offers **One-time destination** so Instagram-style per-show keys can be used without saving.
- **Re-open / edit**: The API never returns raw stream keys. For edits, **Server URL** shows the stored value when present; it may be **empty** for preset platforms that use built-in ingest. **Stream key** fields stay empty; the list row shows `****last4` for confirmation that a key exists.

### `POST /api/meet/broadcast/start` — destination selection

- **`savedDestinationIds` (optional)**  
  - **Omitted**: all **active** saved destinations for the user are included (default, backward compatible).  
  - **`[]`**: **no** saved destinations — use with **`ephemeralRtmp`** for a one-time-only launch.  
  - **Non-empty array**: only those destination ids (each must be active and owned).
- **`ephemeralRtmp` (optional)**  
  - Object: `{ serverUrl?, streamKey, platform?, label?, orientationPreference? }`. **`streamKey`** required; omit the whole field if not using one-time RTMP.  
  - Merged **after** saved rows for egress (saved first, then ephemeral).  
  - Response **`destinations`** entries use **`streamDestinationId: null`** for ephemeral outputs; **`meet_broadcast_session_destinations.stream_destination_id`** is **NULL** for those rows (migration **`0102_meet_broadcast_ephemeral_session_destinations.sql`**).
- **Secrets in responses**: Start JSON never includes raw stream keys or full RTMP URLs — only **`maskedUrl`** and metadata.
- **Idempotent + `ephemeralRtmp`**: When **`idempotent: true`** and the request included **`ephemeralRtmp`**, the response adds **`ephemeralRtmpIgnored: true`** and **`ephemeralRtmpIgnoredReason: "broadcast_ephemeral_ignored_idempotent_active_session"`** (stable code in **`BROADCAST_CODES.ephemeralIgnoredIdempotentActiveSession`**). The new one-time credentials were **not** wired into the existing egress. Operators should **stop**, then **start** again with the desired key, or rely on saved destinations. The Meet broadcast panel shows an amber alert in the one-time RTMP block when this happens.

## Idempotent start

- Same **user** + **room** + live row (`starting` or `active`): **`POST /api/meet/broadcast/start`** returns **`idempotent: true`** and the existing session (no second egress). If the client also sent **`ephemeralRtmp`**, see **Idempotent + `ephemeralRtmp`** above — the UI and response flag explain that the one-time input was ignored.
- Another user’s live session in the same room: **`409`** + **`broadcast_room_busy`**.

## Stuck `starting` (no egress id)

- Threshold: **`BROADCAST_STUCK_STARTING_MS`** in `src/lib/meet/broadcast-constants.ts` (single definition; compared with `Date.now()` vs row `createdAt`).
- Behavior: session + destinations marked **failed**; audit **`broadcast_stuck_session_recovered`**.

## DB vs LiveKit reconciliation

- Runs when the room has **any** live broadcast row, before **`listEgress`** for that room: **`startMeetBroadcastSession`** and **`getMeetBroadcastStatus`**.
- **Terminal egress** in LiveKit (complete / failed / aborted / limit reached): DB session ended, destinations ended with reason `livekit_egress_terminal:<status>`.
- **Egress id missing** from LiveKit’s room list: end only if session age ≥ **`BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS`** (same constants file; avoids list lag false positives).
- LiveKit errors during reconcile: skip reconcile, audit **`broadcast_reconcile_skipped`** (no DB mutation).

## `degraded` in status JSON

- **`true` only** if at least one **`meet_broadcast_session_destinations`** row has **`status === 'failed'`** while the parent session is still `starting` or `active`.
- Never inferred from empty lists, missing LiveKit data, or session status alone.

## Error codes (common)

| Code | Meaning |
|------|--------|
| `broadcast_not_authenticated` | No valid session cookie |
| `broadcast_user_not_found` | User id not in `marketplace_users` |
| `broadcast_host_mismatch` | Linked wallet ≠ meeting wallet |
| `broadcast_room_busy` | Another user’s live session in this room |
| `broadcast_no_destinations` | No destinations for this start (no saved rows included and no valid `ephemeralRtmp`) |
| `broadcast_encryption_unconfigured` | Start included saved destinations but `STREAM_DESTINATION_ENCRYPTION_KEY` is missing |
| `broadcast_destination_invalid` | Preflight: not all active destinations produced valid RTMP URLs |
| `broadcast_egress_failed` | LiveKit start failed after DB rows created |
| `broadcast_stop_noop` | Stop called with nothing live |
| `broadcast_scene_not_supported` | Live scene API: session is not active V2 rendered compositor (V1 or V2 fallback) |
| `broadcast_scene_session_not_found` | Live scene API: unknown `broadcastSessionId` |
| `broadcast_scene_not_active` | Live scene API: session not `starting` / `active` |
| `broadcast_scene_host_mismatch` | Live scene API: session owned by another user |
| `broadcast_scene_invalid` | Live scene API: bad body, validation, or persistence error |
| `broadcast_overlay_not_supported` | Overlay API: not active V2 rendered compositor |
| `broadcast_overlay_session_not_found` | Overlay API: unknown `broadcastSessionId` |
| `broadcast_overlay_not_active` | Overlay API: session not `starting` / `active` |
| `broadcast_overlay_host_mismatch` | Overlay API: session owned by another user |
| `broadcast_overlay_invalid` | Overlay API: bad body, validation, URL, or persistence error |
| `broadcast_schedule_not_supported` | Schedule API: not active V2 rendered compositor |
| `broadcast_schedule_session_not_found` | Schedule API: unknown `broadcastSessionId` |
| `broadcast_schedule_not_active` | Schedule API: session not `starting` / `active` |
| `broadcast_schedule_host_mismatch` | Schedule API: session owned by another user |
| `broadcast_schedule_invalid` | Schedule API: bad body, validation, or persistence error |
| `broadcast_event_idempotent_conflict` | Start returned existing live session; it is already linked to a different broadcast event (HTTP 200 + conflict payload; stream stays up) |
| `broadcast_timeline_session_not_found` | Timeline/analytics API: unknown `broadcastSessionId` for this user |
| `broadcast_timeline_forbidden` | Timeline API: session owned by another user |
| `broadcast_analytics_session_not_found` | Analytics API: unknown session |
| `broadcast_analytics_forbidden` | Analytics API: not the session owner |
| `broadcast_analytics_dashboard_invalid` | Dashboard API: bad range/filters or server error building aggregates |
| `broadcast_launch_readiness_invalid` | Readiness API: missing/invalid `broadcastEventId` |
| `broadcast_show_package_invalid` | Show package API: validation / bad JSON |
| `broadcast_show_package_not_found` | Show package missing or not owned |
| `broadcast_overlay_pack_invalid` | Overlay pack API: validation |
| `broadcast_overlay_pack_not_found` | Overlay pack missing or not owned |
| `broadcast_guest_card_pack_invalid` | Guest card pack API: validation / bad `cards` JSON |
| `broadcast_guest_card_pack_not_found` | Guest card pack missing or not owned |

## Platforms

- **Stable default path**: Twitch-style defaults where we supply a known ingest base.
- **Best-effort / variable ingest**: Instagram, TikTok, Facebook, Pump.fun — UI warns; prefer **custom** + provider’s current RTMP URL when flows break.

## Staging checklist (before guarded prod)

1. Join room as host; open Broadcast panel; confirm **context** matches account.
2. **Recording on** (S3 egress) + **broadcast start**; confirm both can run (LiveKit limits may vary).
3. Toggle **screen share**; confirm layout still acceptable.
4. Participant **join/leave**; confirm no unexpected stop.
5. **Stop broadcast**; confirm **recording** continues or stops per existing product behavior.
6. Simulate zombie row: kill egress server-side or wait for terminal state; confirm **reconcile** clears lockout and UI updates on next status/start.

## Constants (do not duplicate)

- `src/lib/meet/broadcast-constants.ts` — all broadcast time thresholds.

## Metrics (log-based)

- **Module**: `src/lib/meet/broadcast-metrics.ts`
- **Drain**: JSON lines on `console.info` with `component: "meet_broadcast_metrics"`, fields `metric`, `timestamp`, `userId`, `roomId`, `sessionId` (no stream keys or full RTMP URLs).
- **Future**: point the same emit function at Datadog DogStatsD, OpenTelemetry metrics, or CloudWatch embedded metric format; keep field names stable for parser rules.

## Broadcast timeline vs audit vs metrics

- **Metrics**: aggregate counters and operational signals (start/stop rates, feature usage). Optimized for dashboards and alerts; not a per-session story.
- **Audit** (`broadcast-audit`): append-only security and ops trail (who did what, coarse context). Good for compliance and incident forensics; not structured as a session narrative.
- **Timeline** (`meet_broadcast_timeline_events`): **durable, session-scoped** rows for operators — start/stop, compositor mode, live scene/overlay changes, schedule execution, auto-directing, event attach/conflict, etc. Summaries are short; `details_json` is structured, size-bounded, and must not contain raw ingest URLs or secrets (defense in depth in `broadcast-timeline.ts`). **Append failures never fail** the underlying broadcast action (`publishBroadcastTimelineEventSafe`).
- **Retention**: no automatic pruning in this phase; ops may add TTL jobs later.
- **APIs (host auth + ownership)**:
  - `GET /api/meet/broadcast/timeline?broadcastSessionId=&hostWallet=&limit=` — ordered events + aggregate summary.
  - `GET /api/meet/broadcast/analytics?broadcastSessionId=&hostWallet=` — one-session operational summary (counts + template/event names when linked).
  - `GET /api/meet/broadcast/analytics/recent?hostWallet=&limit=` — recent sessions for the signed-in host.
  - `GET /api/meet/broadcast/analytics/dashboard?hostWallet=&range=&fromIso=&toIso=&compositorMode=&roomId=&broadcastEventLinked=&calendarLinked=` — **cross-session** operational aggregates (bounded sample; no raw RTMP URLs or stream keys).
- **Status poll**: `GET /api/meet/broadcast/status` includes **`timelinePreview`** (`eventCount`, `latestEvent`) for quick UI hints without loading full history every time.
- **UI**: `MeetBroadcastStatus` shows timeline preview when events exist; **Broadcast** panel includes collapsible **MeetBroadcastTimelinePanel** (full analytics + list on demand).

### Debugging workflow (typical)

1. **Start** — look for `session_started`, `destination_attached`, `compositor_v2_enabled` or `compositor_v2_fallback`, optional `event_attached`.
2. **Scene changes** — `live_scene_changed` / `live_scene_reset`; overlays `overlay_changed` / `overlay_reset`.
3. **Auto-directing** — `auto_directing_decision`, `auto_directing_applied`, `auto_directing_manual_override`.
4. **Degrade / fallback** — `compositor_v2_fallback` on start; **`degraded_entered` / `degraded_cleared`** are reserved for future precise transitions (today status JSON still flags degraded from destination rows). `session_stopped` with `reason` covers reconcile, operator stop, and terminal failure.
5. **Stop** — `session_stopped` (operator or reconcile).

### Launch readiness & reminders (planning)

- **Purpose**: Help operators see **what is missing** before a scheduled broadcast and surface **lightweight, in-app** time-based hints. **Does not** start broadcasts, send push/email, or run a background worker in this phase.
- **Readiness** is **recomputed from server state** on each API call: `prepareBroadcastEventLaunch`, scene resolution, active destinations count, calendar link presence (informational), whether a **live** session in the same room is already linked to a **different** broadcast event, and **show package** (informational: **attention** when prepare succeeds but **no** linked or default show package supplies defaults).
- **Statuses**: `ready` (green) · `attention_needed` (amber) · `blocked` (red). **Calendar link** is never blocking. **No active destinations** is attention, not blocking. **Prepare-launch failure** and **room missing** / **timeline template missing when configured** / **live session conflict** are blocking when applicable.
- **APIs**:
  - `GET /api/meet/broadcast/readiness?broadcastEventId=&hostWallet=` — full checklist for one event.
  - `GET /api/meet/broadcast/readiness/upcoming?hostWallet=&horizonHours=&maxEvents=` — batch for upcoming events in a horizon (default horizon in UI: 7d for panel).
  - `GET /api/meet/broadcast/reminders?hostWallet=&horizonHours=` — **computed-only** reminder rows (no DB table); regenerated every request. Payloads exclude secrets and raw RTMP URLs.
- **Reminder timing (computed)**: Within the horizon, time buckets **60m / 30m / 10m** before scheduled start (non-overlapping). **readiness_attention** / **readiness_blocked** items may appear for events within **24h** when the readiness report says so. Nothing is “sent” automatically — the client must call the API (panel open / refresh).
- **UI**: **MeetBroadcastReadinessPanel** + **BroadcastLaunchReadinessCard** under broadcast events; **BroadcastUpcomingRemindersCard** (compact) in the main Broadcast controls; analytics dashboard shows a short **scheduled launch** hint when expanded.
- **Metrics / audit**: `broadcast_launch_readiness_view`, `broadcast_launch_readiness_blocked`, `broadcast_launch_readiness_attention`, `broadcast_reminders_view`; audit `broadcast_launch_readiness_checked` on single-event readiness GET.
- **Troubleshooting — “Why blocked?”** Open readiness for the event: check **prepare_launch**, **room_assigned**, **timeline_template**, **live_session_conflict**. Run **Prepare launch** from the UI to see the same errors the server uses.
- **Troubleshooting — reminders empty**: Reminders are **computed** — only events in the **next 24h** (default card horizon) or **48h** with upcoming starts; refresh the panel. No push delivery in this phase.

### Show packages, overlay packs, guest cards (reusable presets)

- **Purpose**: Reduce repeated setup: bundle **launch defaults** (room, scene preset, timeline template, optional branding JSON, default overlay/guest packs), store **V2 overlay JSON fragments** (lower third / ticker / CTA), and store **guest identities** (display name, title, company, accent, allowed URL fields) in **guest card packs** (`guestCardsJson.cards[]`). This phase is **preset-oriented**, not a media CMS (no binary uploads beyond existing URL validation on overlay/guest fields).
- **DB** (migration `0101_meet_broadcast_show_packages.sql`): `meet_broadcast_show_packages`, `meet_broadcast_overlay_packs`, `meet_broadcast_guest_card_packs`; `meet_broadcast_events.show_package_id` (optional FK-style reference by id + ownership in app layer).
- **Prepare-launch resolution order** (`prepareBroadcastEventLaunch`): **(1)** explicit body overrides on `POST …/events/[id]/prepare-launch` (`roomId`, `scenePresetId`, `defaultTimelineTemplateId`), **(2)** fields on the **event** row, **(3)** the **active show package** (event’s `showPackageId` if that pack exists, else the user’s **default** package with `isDefault`), **(4)** no package defaults if none apply. Response includes `appliedShowPackageId`, `showPackageSummary`, `overlayPackSummary`, `guestCardPackSummary`, `defaultBrandingJson` when resolvable; missing referenced packs degrade gracefully (summaries omitted; no crash).
- **APIs** (cookie auth + `assertMeetBroadcastHost`, owner-only):
  - `GET|POST /api/meet/broadcast/show-packages`, `PATCH|DELETE|GET /api/meet/broadcast/show-packages/[id]`
  - `POST /api/meet/broadcast/show-packages/[id]/prepare-defaults` — returns bundled defaults + summaries; records **`broadcast_show_package_apply`** metric / apply audit hook (explicit operator preview).
  - `GET|POST /api/meet/broadcast/overlay-packs`, `PATCH|DELETE|GET /api/meet/broadcast/overlay-packs/[id]`
  - `GET|POST /api/meet/broadcast/guest-card-packs`, `PATCH|DELETE|GET /api/meet/broadcast/guest-card-packs/[id]`
- **Live V2 overlays — explicit apply** (`POST /api/meet/broadcast/overlays`): optional **`applyOverlayPackId`** merges pack JSON into current persisted overlay state, then applies the normal `lowerThird` / `ticker` / `ctaBanner` patch so **manual fields in the same request win**. Optional **`guestCardPackId` + `guestCardId`** merges **lower third** from that card. Records metrics/audit for pack and guest apply; **`overlay_changed`** timeline `details_json` may include `appliedOverlayPackId` / `appliedGuestCardId`. **Does not** restart egress.
- **UI**: **MeetBroadcastShowPackagesPanel** under broadcast events (create/edit/delete packs, preview package defaults). **BroadcastEventEditor** — assign **show package** on create/edit. **MeetBroadcastOverlayControls** — **Merge pack → live**, guest pack picker with **→ editor** / **→ live**.
- **Analytics**: Per-session **`GET /api/meet/broadcast/analytics`** includes **`showPackageId`** / **`showPackageName`** when the linked event has a resolvable package.
- **Metrics / audit** (lightweight): e.g. `broadcast_show_package_create|update|delete|apply`, `broadcast_overlay_pack_create|apply`, `broadcast_guest_card_pack_create`, `broadcast_guest_card_apply`; audit `broadcast_show_package_*`, `broadcast_overlay_pack_applied`, `broadcast_guest_card_applied`.
- **Limitations**: No automatic on-air application from packages beyond explicit prepare/start flows you already use; broken preset IDs are skipped or rejected with stable **codes**; branding JSON is opaque to the server beyond storage.

### Cross-session analytics dashboard (operational)

- **Purpose**: Aggregated broadcast activity over a time window — session counts, compositor mix, destination failures, timeline-driven counters (scene/overlay/schedule/auto-directing), and linkage to **broadcast events** / **calendar**. Additive; does not affect V1/V2 runtime.
- **Host API**: `GET /api/meet/broadcast/analytics/dashboard` — same auth + `assertMeetBroadcastHost` as other broadcast APIs. **`userId` is not accepted** on the host route.
- **Admin API**: `GET /api/admin/meet-broadcast/analytics/dashboard` — `admin-token` + `isAdmin`; optional `userId` narrows to one host; omitted = global sample (still **capped**).
- **Filters**: `range` = `last_7_days` | `last_30_days` | `custom`; custom requires `fromIso` + `toIso` (max **90** days). Optional: `compositorMode`, `roomId`, `broadcastEventLinked`, `calendarLinked` (`true` / `false`).
- **Payload**: `summary`, `breakdowns`, `filtersApplied`, `generatedAt`, `sessionsTruncated`, `sessionSampleSize`, `recentSessions`. No raw RTMP URLs or stream keys.
- **Bounds**: Up to **900** rows read from DB in range, then **600** max in aggregates. If `sessionsTruncated`, narrow filters or shorten the range.
- **UI**: Broadcast panel collapsible **Cross-session analytics dashboard**; live status **View cross-session dashboard** expands it. Drill-down: per-session **timeline & analytics**; scroll to **Broadcast events** when a session is event-linked.
- **Metrics**: `broadcast_analytics_dashboard_view`, `broadcast_analytics_dashboard_filter` (log-based).
- **Support flow**: Dashboard → session drill-down → timeline → broadcast events panel for templates/calendar.

### Limits of this phase

- Not a BI warehouse; analytics are **operational** (counts, last scene, template linkage), not revenue or multi-tenant reporting.
- No heavy charting; timeline is a **readable event list**.
- Per-destination failure rows in DB drive **degraded** in status; timeline **`destination_failed`** is not emitted until a dedicated egress webhook path exists.

## Admin: list sessions

- **Route**: `GET /api/admin/meet-broadcast/sessions`
- **Auth**: `admin-token` cookie; JWT must verify with `isAdmin: true` (`verifyToken`).
- **Query**: `limit` (default 50, max 100), `status`, `roomId`, `userId`.
- **Data**: `src/lib/meet/broadcast-admin.ts` — sessions ordered by `created_at` desc, with child destination rows (masked URLs only).
- **Timeline preview** (per session object): `timelineEventCount`, `latestTimelineEvent` (`summary`, `eventType`, `eventAtIso`), and compact **`analyticsSummaryPreview`** (destination counts, compositor flags, duplicate `timelineEventCount`). Full history: use operator timeline API or DB `meet_broadcast_timeline_events`.

### Example JSON response

```json
{
  "ok": true,
  "count": 1,
  "sessions": [
    {
      "session": {
        "id": 1,
        "roomId": "meet-room-abc",
        "userId": 42,
        "livekitEgressId": "EG_xxxx",
        "status": "active",
        "layoutMode": "grid",
        "recordingEnabled": false,
        "startedAt": "2026-04-08T12:00:00.000Z",
        "endedAt": null,
        "createdAt": "2026-04-08T11:59:55.000Z",
        "updatedAt": "2026-04-08T12:00:01.000Z",
        "currentLiveSceneType": null,
        "currentLiveLayoutMode": null,
        "liveSceneUpdatedAt": null,
        "overlaySummary": null,
        "overlayUpdatedAt": null,
        "scheduleSummary": null,
        "scheduleUpdatedAt": null
      },
      "destinations": [
        {
          "id": 10,
          "streamDestinationId": 99,
          "platform": "twitch",
          "label": "Main",
          "resolvedOutputUrlMasked": "rtmp://live.twitch.tv/app/****1234",
          "status": "active",
          "lastError": null,
          "startedAt": "2026-04-08T12:00:00.000Z",
          "endedAt": null
        }
      ]
    }
  ]
}
```

## Provider capabilities

- **Map**: `src/lib/streaming/provider-capabilities.ts` — drives UI badges, RTMP resolver `warnings`, and optional audit `providerCapabilitiesSnapshot`.

## Broadcast scene engine (V1)

- **Model**: `src/lib/meet/broadcast-scene.ts` — `BroadcastSceneConfig`, layout modes (`speaker`, `gallery`, `screenshare_focus`, `portrait_*`), branding fields, validation, and mapping to LiveKit room-composite strings (`grid` | `speaker` | `single-speaker`).
- **Presets**: Table `meet_broadcast_scene_presets`, API under `GET/POST /api/meet/broadcast/scene-presets` and `PATCH/DELETE …/scene-presets/[id]`. Host-only via existing auth + `assertMeetBroadcastHost` where applicable.
- **Start payload**: `POST /api/meet/broadcast/start` accepts optional `scenePresetId` or `sceneConfig` (not both from the client hook: preset id is sent only when the host loaded a preset and has not edited the scene). Resolved config is snapshotted on `meet_broadcast_sessions.scene_config_json` (includes `appliedPresetId` / `appliedPresetName` when applicable).
- **Program metadata**: `src/lib/meet/broadcast-program.ts` — `buildBroadcastProgramState` / highlights / notes; consumed by **V2** render model when the rendered compositor flag is on.
- **Egress**: `startRoomCompositeEgress` still receives only LiveKit’s `layout`; `RoomCompositeSceneIntent` on `startRoomCompositeRtmpFanOut` carries `sceneLayoutMode`, `portraitSafe`, `screenSharePriority`, `brandingEnabled` for forward compatibility and audit (`broadcast_start_*` events include the same fields).
- **UI**: `MeetBroadcastSceneControls`, branding form, preset picker, layout preview card; `MeetBroadcastStatus` shows active program summary and operator warnings (orientation / portrait-safe / V1 disclaimer).
- **Limitations (V1)**: Branding and portrait-safe framing are **intent + metadata** only; outputs are standard LiveKit composites until a dedicated program/compositor phase. Some layout modes map to the same composite with **documented warnings** (`mapBroadcastSceneToLiveKitLayout`).
- **Suggestions**: `src/lib/meet/broadcast-scene-suggestions.ts` — portrait-first destinations suggest portrait layouts; landscape-first defaults suggest `speaker` (host may choose `screenshare_focus` manually).

## Broadcast rendered compositor (V2)

- **Feature flags** (opt-in): `MEET_BROADCAST_RENDERED_COMPOSITOR=1|true` enables V2 for **all** users; or `MEET_BROADCAST_RENDERED_COMPOSITOR_USER_IDS=1,2,3` for an allow-list. Implementation: `src/lib/meet/broadcast-feature-flags.ts`. If neither applies, **only V1** runs (existing LiveKit default template + `layout` string).
- **Modules**: `broadcast-compositor.ts` (render model + validation), `broadcast-compositor-fallback.ts` (`prepareV2RenderedCompositorOrReason`), `broadcast-render-sessions.ts`, `broadcast-template.ts` (public origin + URL builder).
- **DB**: Migration `drizzle/0093_meet_broadcast_v2_compositor.sql` — `meet_broadcast_render_sessions` + `meet_broadcast_sessions.compositor_mode`, `render_session_id`, `compositor_fallback_from_v2`.
- **Render session TTL**: **6 hours** from creation (`BROADCAST_RENDER_SESSION_TTL_MS`). Rows are deleted when expired on template API read (`deleteExpiredBroadcastRenderSessions`); you may also schedule periodic cleanup.
- **Template**: `/meet/broadcast-template` loads render JSON from `GET /api/meet/broadcast/render-session/[id]?token=…` (no cookies; **token is the secret** — treat like a capability URL). LiveKit egress opens the template URL with merged `layout`, `url`, `token` query params.
- **Public origin**: Set **`MEET_BROADCAST_TEMPLATE_ORIGIN`** (`https://your-app.com`) so egress workers can reach the app. Fallback order: that env → `NEXT_PUBLIC_APP_URL` → `VERCEL_URL`. If none resolve, V2 prep **fails** and start **falls back to V1** (audit `broadcast_compositor_v2_fallback`, metric `broadcast_compositor_v2_fallback`).
- **Fallback rules**: Invalid render model, DB insert failure, or missing origin → **V1** egress still starts (same RTMP fan-out). Egress failure after V2 URL was built increments `broadcast_compositor_v2_failure` in addition to `broadcast_egress_failure`.
- **Operator UI**: `MeetBroadcastStatus` shows compositor mode, masked render session id, whether branding is rendered on the V2 template, and a notice when `compositor_fallback_from_v2` is set.
- **Admin API**: `GET /api/admin/meet-broadcast/sessions` includes `compositorMode`, `compositorFallbackFromV2`, `renderSessionMasked`, `sceneLayoutSummary`.
- **Audit**: `broadcast_start_*` events include `compositorMode`, `templatePathUsed`, `renderSessionRef` (e.g. `rs_123`) when applicable.
- **Limitations**: Start path does not yet receive live participant/track graph from the meeting — `BroadcastProgramState` uses **empty participants** and **destination-derived `providerHints`** until a richer sync exists. Template layouts follow LiveKit `grid` / `speaker` / `single-speaker` with Troo branding chrome; `screenshare_focus` reorders tracks to prefer screen share when present.

## Live scene control (V2 only, polling)

- **Scope**: Operators can change **on-stream scene** during an **active** broadcast **only** when `compositor_mode = v2_rendered_template`, `render_session_id` is set, and **`compositor_fallback_from_v2` is false**. V1 and V2-fallback sessions do not expose live scene APIs or operator controls (UI shows a short notice).
- **Model**: `src/lib/meet/broadcast-live-scenes.ts` — types `BroadcastLiveSceneType` (`program` | `intro` | `brb` | `outro` | `holding`), `BroadcastLiveSceneState`, merge/validation helpers, and `mergeBaseRenderModelWithLiveScene` (frozen render snapshot + live overrides).
- **Persistence**: Table `meet_broadcast_live_scene_states` (migration `drizzle/0094_meet_broadcast_live_scenes.sql`); **one row per** `broadcast_session_id` (unique). **Latest row is authoritative**; **reset** deletes the row so the system falls back to the **program default** derived from `meet_broadcast_sessions.scene_config_json` / `layout_mode`.
- **APIs** (auth + `assertMeetBroadcastHost` + same host/owner rules as start/stop):
  - `GET /api/meet/broadcast/live-scene?broadcastSessionId=&hostWallet=`
  - `POST /api/meet/broadcast/live-scene` — body: `broadcastSessionId`, optional `hostWallet`, optional partial patch (`sceneType`, `layoutMode`, branding/flags, `customHeadline` / `customSubheadline`).
  - `POST /api/meet/broadcast/live-scene/reset` — clears persisted overrides.
- **Template / egress**: `GET /api/meet/broadcast/render-session/[id]` merges live state into the JSON consumed by `/meet/broadcast-template`. **No egress restart** in this phase: the template page **polls** render-session about every **3 seconds** (`BroadcastEgressTemplateClient`; see code comment). Failed polls after the first successful load **keep the last merged model** on the client.
- **Status panel**: `GET /api/meet/broadcast/status` includes `scenePreview.liveScene` when the V2 template is active (server truth; panel polls on the existing ~4s interval in `useMeetBroadcast`).
- **Operator UI**: `MeetBroadcastLiveSceneControls`, `BroadcastSceneQuickActions` — scene type buttons, program layout quick actions, optional headline/subhead for slates, reset.
- **Audit / metrics**: `broadcast_live_scene_changed`, `broadcast_live_scene_reset`, `broadcast_live_scene_denied`, `broadcast_live_scene_invalid`; metrics `broadcast_live_scene_change`, `broadcast_live_scene_reset`, `broadcast_live_scene_error`.
- **Admin**: `GET /api/admin/meet-broadcast/sessions` adds `currentLiveSceneType`, `currentLiveLayoutMode`, `liveSceneUpdatedAt` on each session object (V2-active rows only; otherwise null).
- **Operator expectations**:
  - **Propagation delay**: lower bound is roughly **status poll + template poll** (on the order of several seconds), not frame-perfect.
  - **Eventually consistent**: server state wins; optimistic UI may briefly disagree until the next status refresh.
  - **Failure behavior**: If persisting live scene fails, the API returns an error but **the broadcast and egress continue** with the previous state. If the template cannot refresh JSON, the **last good render** remains until the next successful poll.
  - **Slates** (`intro` / `brb` / `outro` / `holding`): template shows full-screen copy with branding; recording start is **accelerated** when not on `program` so egress does not wait indefinitely for participant video.

## Operator overlays (V2 only)

- **Scope**: Same eligibility as live scene control — **active** session with **V2 rendered template** and **no V2→V1 fallback**. Overlays never apply to V1 egress.
- **Types** (logical): `lower_third`, `ticker`, `cta_banner` — all can be toggled together; each has its own visibility and fields.
- **Model / validation**: `src/lib/meet/broadcast-overlays.ts` — string length caps (e.g. lower-third headline 120, ticker 500, CTA text 200); **CTA `buttonUrl` must be `http:` or `https:`** (no `javascript:`, `data:`, etc.); positions constrained (`bottom_left` | `bottom_center`, ticker strip bottom, CTA `top` | `bottom`).
- **Persistence**: Table `meet_broadcast_overlay_states` (migration `drizzle/0095_meet_broadcast_overlay_states.sql`); **unique** `broadcast_session_id`. **Reset** deletes the row → defaults (**all overlays off**).
- **APIs**: `GET/POST /api/meet/broadcast/overlays`, `POST /api/meet/broadcast/overlays/reset` — POST body: `broadcastSessionId`, optional `hostWallet`, partial `{ lowerThird?, ticker?, ctaBanner? }`.
- **Render session JSON**: `model.overlays` carries the template payload; **`liveSceneState`** mirrors **`liveScene`**; **`overlayState`** returns a compact summary (`lowerThirdVisible`, `tickerVisible`, `ctaBannerVisible`, `updatedAt`). **No egress restart** on overlay changes.
- **Template**: `BroadcastEgressTemplateClient` — lower third (`data-testid="broadcast-overlay-lower-third"`), ticker (`broadcast-overlay-ticker`, static truncated line for now; `speed` reserved for future marquee), CTA banner (`broadcast-overlay-cta-banner`) with **URL shown as text** (no in-stream link clicks in this phase). Overlays draw above program and slate scenes; respect portrait-safe width.
- **Status / hook**: `scenePreview.overlaySummary` (visibility booleans + `updatedAt` when persisted). `useMeetBroadcast`: `fetchOverlayState`, `updateOverlayState`, `resetOverlayState`. Polling: same as live scene (status ~4s, template ~3s).
- **Operator UI**: `MeetBroadcastOverlayControls`, `BroadcastLowerThirdEditor`, `BroadcastTickerEditor`, `BroadcastCtaBannerEditor` — apply + reset; **V2-only** notice when unavailable.
- **Audit / metrics**: `broadcast_overlay_changed`, `broadcast_overlay_reset`, `broadcast_overlay_denied`, `broadcast_overlay_invalid`; `broadcast_overlay_change`, `broadcast_overlay_reset`, `broadcast_overlay_error`.
- **Admin**: `overlaySummary` (`lowerThirdVisible`, `tickerVisible`, `ctaBannerVisible`) and `overlayUpdatedAt` on each session (V2-only context; null when not V2).
- **Guidance**: Keep lower thirds **short** for legibility; use ticker for **secondary** lines; CTA for **one clear action** — label + URL as on-screen text so viewers can type it; avoid flashing or heavy motion (current build is minimal CSS).
- **Fallback**: Failed overlay persistence → API error, **stream continues** with prior overlays. Failed template poll → **last good `model`** on the client until the next successful poll.

## V2 schedule, countdown & timed automation (polling)

- **V2-only**: Same eligibility as live scene and overlays — active **`v2_rendered_template`** session with **no** `compositor_fallback_from_v2`. V1 is unchanged.
- **Server truth**: `meet_broadcast_schedule_states` (migration `drizzle/0096_meet_broadcast_schedule_states.sql`) stores JSON schedule state; **unique** `broadcast_session_id`. **Reset** deletes the row (in-memory default until the host saves again). Reset does **not** clear live scene or overlay rows unless you do that separately.
- **Model**: `src/lib/meet/broadcast-schedule.ts` — countdown config, typed scheduled actions (`switch_scene`, `reset_scene_to_program`, `show_overlay`, `hide_overlay`, `update_overlay`, `start_countdown`, `stop_countdown`), validation (max actions, ISO times, payload checks), helpers for due/pending actions and compositor countdown payload.
- **Execution (no WebSocket in this phase)**: `src/lib/meet/broadcast-scheduler.ts` runs **`evaluateBroadcastScheduleForActiveSession`** when **automation is enabled** and applies **due** actions idempotently (`executedAtIso` on each action). It is invoked opportunistically on:
  - `GET /api/meet/broadcast/render-session/[id]` (egress template poll),
  - `GET /api/meet/broadcast/status`,
  - `GET /api/meet/broadcast/live-scene`,
  - `GET /api/meet/broadcast/overlays`,
  - `GET /api/meet/broadcast/schedule`.
  **No egress restart**: only DB-backed live scene, overlay, and schedule rows update; the template keeps polling merged JSON.
- **APIs** (auth + host rules aligned with live-scene/overlays):
  - `GET /api/meet/broadcast/schedule?broadcastSessionId=&hostWallet=`
  - `POST /api/meet/broadcast/schedule` — partial body: `automationEnabled`, `countdown`, `actions` (full replacement when `actions` is sent).
  - `POST /api/meet/broadcast/schedule/reset`
- **Countdown on stream**: Render-session merges `model.countdown` for the template; `BroadcastEgressTemplateClient` renders `data-testid="broadcast-overlay-countdown"` (label + remaining time). If the target time has passed while still visible, the UI shows **00:00** and a small “done” hint. Propagation is **poll-limited** (template ~3s + status ~4s), not frame-perfect.
- **Manual override**: Operators can still change live scene and overlays while automation is on. Scheduled actions only fire when due; they do not continuously “fight” manual state except when a due action applies a new scene/overlay/countdown change.
- **Eventually consistent**: Execution aligns with polling cadence; do not expect frame-accurate show cues. A failed action is audited and metric’d; it **stays due** until it succeeds or the operator edits/disables/removes it.
- **Status / hook**: `scenePreview.scheduleSummary` and `scheduleUpdatedAt` on `/api/meet/broadcast/status`. `useMeetBroadcast`: `fetchScheduleState`, `updateScheduleState`, `resetScheduleState`.
- **Operator UI**: `MeetBroadcastScheduleControls`, `BroadcastCountdownEditor`, `BroadcastScheduledActionsEditor` (under Broadcast panel when V2 template active).
- **Audit / metrics**: `broadcast_schedule_changed`, `broadcast_schedule_reset`, `broadcast_schedule_denied`, `broadcast_schedule_invalid`, `broadcast_schedule_action_executed`, `broadcast_schedule_action_failed`; metrics `broadcast_schedule_change`, `broadcast_schedule_reset`, `broadcast_schedule_error`, `broadcast_schedule_action_execute`, `broadcast_schedule_action_fail`.
- **Admin**: `GET /api/admin/meet-broadcast/sessions` includes `scheduleSummary` (automation, countdown visibility, next action time/type, last executed id) and `scheduleUpdatedAt` when a schedule row exists.

## V2 auto-directing (layout hints & optional auto-apply)

- **Scope**: **V2 rendered compositor only** (same eligibility as live scene). V1 unchanged. **No egress restart** — only `layoutMode` on persisted live scene may change when **auto_apply** is on and rules fire.
- **Modes**: `off` (default) — no recommendations persisted beyond engine no-ops; `suggest_only` — computes and stores `lastDecision`, **does not** change live scene; `auto_apply` — may update **layout only** on program scene when not in manual override window.
- **Server truth**: `meet_broadcast_auto_directing_states` (migration `drizzle/0097_meet_broadcast_auto_directing.sql`) — JSON `directing_state_json` holds `policy`, `lastDecision`, `lastAppliedAt`, `manualOverrideUntilIso`, `debounce` (speaker flip timing), `updatedByUserId`.
- **Signals**: `buildBroadcastDirectingSignals` reads the **latest non-expired render session** compositor model (`highlightedParticipantIds`, `primarySpeakerId`, `screenShareActive`, `providerHints`). **Limitation**: without live LiveKit participant sync, counts/speakers reflect the **frozen snapshot** (same note as program state) — heuristics stay **conservative** when `signalsWeak`.
- **Heuristics (explainable)**: Screen share + `preferScreenShareFocus` → `screenshare_focus`. Many participants / multiple highlighted speakers → `gallery`. Single dominant speaker → `speaker` or `portrait_speaker` if portrait-capable destinations and `preferPortraitLayouts`. **Speaker debounce** (`speakerSwitchDebounceMs`, default ~4.5s) avoids thrashing when the dominant id changes.
- **Manual override**: Any operator **layout** change via `POST /api/meet/broadcast/live-scene` sets `manualOverrideUntilIso` (~2 minutes). During override, auto-directing may still **suggest**; **auto_apply** does not run. **Resume** clears override (`POST /api/meet/broadcast/auto-directing` with `manualOverrideUntilIso: null`) or wait for expiry.
- **APIs** (auth + host + V2 active): `GET/POST /api/meet/broadcast/auto-directing`, `POST /api/meet/broadcast/auto-directing/reset`. Stable codes: `broadcast_auto_directing_not_supported`, `broadcast_auto_directing_session_not_found`, `broadcast_auto_directing_not_active`, `broadcast_auto_directing_host_mismatch`, `broadcast_auto_directing_invalid`. Body may include `policy`, `mode`, `manualOverrideUntilIso`, `applyRecommendedNow`.
- **Evaluation**: `evaluateBroadcastAutoDirectingForSession` on **GET render-session**, **GET status** (V2), **GET live-scene**, and auto-directing **GET/POST**. Failures are metric’d/audited; broadcast continues.
- **Status / template**: `scenePreview.autoDirectingSummary` on `/api/meet/broadcast/status`. Render-session JSON adds `directingSignals` (public summary) and `autoDirecting` (mode, recommendation, override flag).
- **Realtime**: `auto_directing_updated`, `auto_directing_decision`, `auto_directing_applied` (+ `render_model_refresh_requested`) for invalidation.
- **UI**: `MeetBroadcastAutoDirectingControls`, `BroadcastAutoDirectingPolicyEditor`, `BroadcastAutoDirectingStatusCard` under Broadcast panel; `MeetBroadcastStatus` shows a short auto-directing line when V2 template active.
- **Audit / metrics**: `broadcast_auto_directing_changed`, `broadcast_auto_directing_applied`, `broadcast_auto_directing_denied`, `broadcast_auto_directing_invalid`, `broadcast_auto_directing_manual_override`; counters `broadcast_auto_directing_change`, `broadcast_auto_directing_decision`, `broadcast_auto_directing_apply`, `broadcast_auto_directing_pause_manual_override`, `broadcast_auto_directing_error`.
- **Admin**: Each session includes `autoDirectingSummary` when row exists (mode, latest recommendation, override flag, last applied).
- **Troubleshooting — “Why didn’t it switch?”** Mode off or suggest_only; manual override active; non-program live scene; weak signals; debounce window; policy thresholds; render snapshot stale.
- **Troubleshooting — “Why did it switch?”** Auto_apply + decision differed from current layout + override inactive + program scene; check audits `broadcast_auto_directing_applied` and live scene history.

## Broadcast events & timeline templates (planning + launch-assist)

- **Purpose**: First-class **broadcast events** (`meet_broadcast_events`) let operators plan scheduled shows with optional **scene preset** and **default timeline template** (`meet_broadcast_timeline_templates`). This layer is **additive**; V1 start behavior is unchanged when no event is used.
- **No hidden go-live**: Nothing in this phase starts egress or opens RTMP automatically. **Prepare launch** (`POST /api/meet/broadcast/events/[id]/prepare-launch`) only returns a resolved config for the UI. **Going live** still requires an explicit **`POST /api/meet/broadcast/start`** (or the Broadcast panel **Start broadcast** / **Start from event**).
- **Start with `broadcastEventId`**: `POST /api/meet/broadcast/start` accepts optional `broadcastEventId`. Server validates ownership, persists `broadcast_event_id` on the session, applies the event’s **room** only if the body omits `roomId`, and applies the event’s **scene preset** / **timeline template** only when the caller does **not** explicitly send `scenePresetId` / `sceneConfig` (explicit body wins).
- **V2 schedule seeding**: If the session ends up on **V2 rendered compositor** and the event has a linked template, **`startMeetBroadcastSession`** builds schedule state from the template at **launch time** (offsets relative to `scheduledStartIso`), upserts it, and publishes schedule invalidation. If the compositor falls back to V1, **no** template seeding runs (same as “no template”).
- **APIs**: `GET/POST /api/meet/broadcast/events`, `GET/PATCH/DELETE /api/meet/broadcast/events/[id]`, `POST .../prepare-launch`, optional `.../mark-live` / `.../mark-complete`; `GET/POST /api/meet/broadcast/timeline-templates`, `PATCH/DELETE .../[id]`.
- **Operator UI**: `MeetBroadcastEventsPanel` (inside **Broadcast** panel) — upcoming events, create/edit event, create template JSON, **Prepare launch**, **Start from event**.
- **Status / admin**: `scenePreview.broadcastEventSummary` on **`/api/meet/broadcast/status`**; admin sessions list includes `broadcastEventId` and `broadcastEventSummary` when resolvable.
- **Safety**: Deleting an event does not mutate historical sessions; linked rows keep `broadcast_event_id` even if the event row is gone (summary may empty). **Prepare-launch** returns **400** on bad template resolution and **does not** write DB.
- **Audit / metrics**: `broadcast_event_*`, `broadcast_timeline_template_*` (create/update/delete/prepare_launch/launched) per `broadcast-audit` and `broadcast-metrics`.

## Broadcast calendar sync (external scheduling)

- **Purpose**: Link **broadcast events** (`meet_broadcast_events`) to **external calendar** rows so operators can import, browse, export, and **explicitly** refresh metadata — without replacing server-owned broadcast fields.
- **Phase model**: **User-initiated only**. There is **no** background sync worker, cron, or silent mutation. Every import, link, export, sync, and unlink is an authenticated API call the operator triggers from the UI (or an equivalent client).
- **Server truth**: `meet_broadcast_events` remains authoritative for **room**, **scene preset**, **default timeline template**, **broadcast-specific status**, and anything not listed as calendar-synced below. Calendar data **never** overwrites those fields during generic sync.

### Supported providers (this phase)

- **`google_calendar`**: Uses the **existing Google OAuth path** tied to **AI agents** — valid access via `ai_agents` + `agent_plugin_credentials` and the same token refresh helpers used elsewhere (no parallel OAuth app model). If the signed-in user has **no** connected agent with Calendar-capable credentials, list/import/sync/export return a **clear setup** response (stable product codes such as `broadcast_calendar_not_configured` / related codes in `broadcast-codes.ts`) — **never** a fake success.
- **`generic_ics` / `manual_external`**: Shapes exist for future ICS feeds or hand-entered external references; listing and pull may be empty or **unsupported** until a connector ships. Prefer explicit errors over silent no-ops where the API promises Google-backed data.

### Persistence

- **Table**: `meet_broadcast_calendar_links` (migration `drizzle/0100_meet_broadcast_calendar_links.sql`) — `user_id`, `broadcast_event_id` (unique per event link), `provider`, optional `external_calendar_id` / `external_event_id` / `external_event_url`, `sync_mode`, `last_synced_at`, timestamps.
- **Store**: `src/lib/meet/broadcast-calendar-link-store.ts` — create, get by broadcast event, list for user, update, delete, touch last-synced.
- **Types / rules**: `src/lib/meet/broadcast-calendar-sync.ts` — `validateBroadcastCalendarLink`, pull/push capability helpers, summaries for API payloads (**no** tokens or raw OAuth in summaries).

### Sync modes

| Mode | Meaning |
|------|--------|
| `import_only` | One-time or explicit pull from external source; conservative updates to allowed fields only. |
| `linked_readonly` | Link is stable; **explicit** “Sync now” may refresh **title, description, scheduled start/end, timezone** from the external event into the broadcast event. |
| `linked_bidirectional_prepare` | Same pull rules as readonly; **explicit** export/update during prepare-style workflows may push or patch the external copy — still **no** hidden background sync. |
| `export_only` | Broadcast event is source for scheduling copy; **explicit** “Export” creates/updates external event; calendar changes do not auto-pull unless the operator runs sync where mode allows. |

### Field ownership (conflict rules)

- **May sync from external → broadcast event** (on **explicit** sync only, when mode allows): **title**, **description**, **scheduledStartIso**, **scheduledEndIso**, **timezone**.
- **Always app-owned** unless changed only inside the app (not by generic calendar sync): **roomId**, **scenePresetId**, **defaultTimelineTemplateId**, **broadcast event status** and other broadcast-only columns.
- **Overrides**: In-app edits to the above calendar-mapped fields remain possible; the next **explicit** sync may overwrite those fields from the external event per mode — operators should treat calendar as the scheduling mirror when using pull-capable modes.

### APIs (host auth + ownership)

- `GET /api/meet/broadcast/calendar/events` — list **candidate** upcoming external events (Google when configured).
- `POST /api/meet/broadcast/calendar/link` — link an existing broadcast event to an external event, or **create** a broadcast event from an external event (`createFromExternal`).
- `POST /api/meet/broadcast/calendar/unlink` — remove the **link row** only; **does not delete** the broadcast event.
- `POST /api/meet/broadcast/calendar/export` — create or update external calendar event from a broadcast event (**explicit**).
- `POST /api/meet/broadcast/calendar/sync` — **explicit** “sync now” for a linked event (pull and/or push per mode via `broadcast-calendar-ops.ts`).

Stable error **codes** and **metrics**: see `src/lib/meet/broadcast-codes.ts` and `src/lib/meet/broadcast-metrics.ts` (`broadcast_calendar_*`). **Audit** event names include `broadcast_calendar_link_created`, `broadcast_calendar_link_deleted`, `broadcast_calendar_imported`, `broadcast_calendar_exported`, `broadcast_calendar_synced`, `broadcast_calendar_sync_failed`.

### Prepare-launch, status, admin, analytics

- **Prepare-launch** (`POST /api/meet/broadcast/events/[id]/prepare-launch`): includes a **stored** `calendarLink` summary (provider, sync mode, external URL, last synced, etc.) from the link table — **no live Google API call** on this path in this phase.
- **Event list** (`GET /api/meet/broadcast/events`): optional `calendarLink` summary per event when a link exists.
- **Live status** (`GET /api/meet/broadcast/status`): `scenePreview.broadcastEventSummary.calendarLink` when the session is tied to a linked broadcast event.
- **Admin** (`GET /api/admin/meet-broadcast/sessions`): same summary under `broadcastEventSummary.calendarLink` when resolvable.
- **Analytics**: recent-session and per-session summaries may include `calendarLink` for operator visibility.

### Operator UI

- **Components**: `MeetBroadcastCalendarPanel`, `BroadcastCalendarLinkCard`, `BroadcastCalendarEventPicker` — embedded in the broadcast events area (`MeetBroadcastEventsPanel`). Shows link state, picker for upcoming events, export, sync now, unlink.

### Troubleshooting

- **“No calendar events” / not configured**: User likely has **no** Google Calendar–capable **agent** credentials. Complete Google connection for the agent used by the product; do not expect ICS or manual providers to list Google events until implemented.
- **Sync or export fails**: Check stable `code` in JSON, audit `broadcast_calendar_sync_failed`, and metrics `broadcast_calendar_sync_error`. Network or Google 4xx/5xx should surface as user-visible errors without leaking tokens.
- **Unlink**: Only removes `meet_broadcast_calendar_links` — the broadcast event and historical session links stay intact.

### Event-linked idempotent start (same room already live)

- **Situation**: `POST /api/meet/broadcast/start` with `broadcastEventId` hits the **idempotent** path (your session is already `starting`/`active` in that room). The server then **reconciles** whether to persist `broadcast_event_id` on that existing row.
- **Attach**: Session had **no** linked event → set `meet_broadcast_sessions.broadcast_event_id`, set the event row **`live`**, audit **`broadcast_event_idempotent_attached`**, metric **`broadcast_event_idempotent_attach`** (`reason: attached`).
- **Already linked**: Session already has **the same** `broadcast_event_id` → no DB change, audit **`broadcast_event_idempotent_already_attached`**, metric **`broadcast_event_idempotent_attach`** (`reason: already_attached`).
- **Conflict**: Session already has a **different** `broadcast_event_id` → **no overwrite**, audit **`broadcast_event_idempotent_conflict`**, metric **`broadcast_event_idempotent_attach_conflict`**. HTTP **200** with `code: broadcast_event_idempotent_conflict`, `broadcastEventAttachment: "conflict"`, and `broadcastEventConflict` `{ existingEventId, requestedEventId }`. The broadcast **stays live**; only the new link is refused.
- **Operator guidance**: On conflict, **stop** the current broadcast or continue without linking the second event; you cannot re-link the live row to another event without stopping or using support/admin tools that change the row explicitly (no silent replace).
- **Status / admin**: After a successful attach, the next **`/api/meet/broadcast/status`** or admin session payload reflects **`broadcastEventId`** / **`broadcastEventSummary`** like a fresh start-with-event.

## V2 realtime invalidation (SSE)

- **Transport**: **Server-Sent Events** (`text/event-stream`), same pattern as `GET /api/worlds/[worldId]/activity-stream` — `ReadableStream` + named SSE events + `: hb` heartbeats (~25s).
- **Server truth**: Events are **hints to refetch** authoritative APIs (`render-session`, `status`, `live-scene`, `overlays`, `schedule`). Payloads are minimal JSON (types, ids, timestamps) — **no** stream keys or raw RTMP URLs. Polling intervals **remain**; if SSE fails or misses an event, the next poll recovers state.
- **Why realtime is still invalidation-only**: The database and poll/refetch paths remain authoritative. SSE (and any backbone) only signal “something may have changed”; clients must not treat event payloads as source of truth.
- **Operator SSE feed**: `GET /api/meet/broadcast/events?broadcastSessionId=&hostWallet=` — requires session cookie auth + `assertMeetBroadcastHost` + same V2-active rules as schedule/live-scene. **`broadcastSessionId` must be present** for SSE; without it, the same route returns **JSON** for **calendar broadcast events** (`?upcoming=1` lists future rows). `useMeetBroadcast` auto-opens EventSource while an active V2 template session is live; on each event it **`refreshStatus()`** and bumps **`broadcastRefreshSignal`** so overlay/schedule editors resync.
- **Template feed**: `GET /api/meet/broadcast/render-events?rsid=&token=` — validates `getBroadcastRenderSessionByToken` + active V2 parent session (no user cookie). `BroadcastEgressTemplateClient` opens EventSource alongside the existing **~3s** render-session poll; any listed event triggers an **immediate** `pull()` refetch.
- **Publishing**: `src/lib/meet/broadcast-event-publisher.ts` — publishes through `getBroadcastRealtimeAdapter()` after successful live-scene / overlay / schedule mutations and from the schedule executor. **Publish failures never fail the control action** (async try/catch + `broadcast_realtime_publish_failed` audit + metrics).
- **Distributed realtime (multi-instance)**: `MEET_BROADCAST_REALTIME_BACKEND=distributed` uses **Upstash Redis Streams** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) with key pattern `meet_br_rt_s_{broadcastSessionId}`. Short **XRANGE replay** (last ~8 entries) on subscribe reduces missed hints after reconnect; retention is capped (`MAXLEN ~ 128`) and is **not** a correctness log. Default / local dev: `MEET_BROADCAST_REALTIME_BACKEND=memory` or unset → in-process adapter (same host only).
- **Fallback chain**: **Configured distributed + healthy Upstash** → cross-instance delivery. **Missing Upstash env or `memory` in env** → in-memory adapter on that instance. **Subscribe errors** → SSE still opens with heartbeats; **polling** remains the safety net. **Publish errors** → mutation still succeeds; metrics/audit record the failure.
- **What still relies on polling?** Template **render-session** merge (~3s), operator **status** (~4s when live), and any path where SSE is disconnected or an instance had no subscriber. Schedule evaluation is still driven by those reads — not by SSE.
- **Wire helpers**: `src/lib/meet/broadcast-realtime-hub.ts` — `broadcastRealtimeSseChunk` only. Fan-out: `src/lib/meet/broadcast-realtime-adapter*.ts`, factory `broadcast-realtime-factory.ts`, SSE wiring `broadcast-realtime-sse.ts`.
- **Latency**: With distributed Redis, operator and template on **any** app instance typically see invalidation within one RTT of publish plus stream poll interval (~750ms) instead of waiting for the full status/render poll window; combined with poll, worst case remains prior behavior.
- **UI**: `MeetBroadcastStatus` shows Realtime connected vs polling fallback (V2 only). Template exposes `data-testid="broadcast-realtime-connected"` and `data-testid="broadcast-realtime-fallback-active"` (sr-only text yes/no). Clients may skip refetch when `eventId` repeats (best-effort dedupe); duplicates are safe.
- **Audit / metrics**: `broadcast_realtime_connected`, `broadcast_realtime_disconnected`, `broadcast_realtime_publish_failed`; `broadcast_realtime_connect`, `broadcast_realtime_disconnect`, `broadcast_realtime_error`, `broadcast_realtime_event_publish`, `broadcast_realtime_event_publish_fail`. Includes auto-directing event types (`auto_directing_*`) in the same SSE contract. Backbone: `broadcast_realtime_backend_selected`, `broadcast_realtime_backend_fallback`, `broadcast_realtime_subscribe_failed`; counters `broadcast_realtime_backend_memory`, `broadcast_realtime_backend_distributed`, `broadcast_realtime_backend_fallback`, `broadcast_realtime_publish_success`, `broadcast_realtime_publish_fail`, `broadcast_realtime_subscribe_success`, `broadcast_realtime_subscribe_fail`.
- **Admin**: Top-level `realtime` object (`backend`, `backendRequested`, `backendHealthy`, `backendDetail`, `fallbackActive`) plus per session `realtimeBackend*`, `realtimeSubscriberCount` (accurate for **memory**; **0** for distributed cross-instance), `realtimeLastEventAt` (from stream tail when distributed).
- **Troubleshooting**: If the operator line never shows “Connected”, check auth/host/V2 eligibility and proxies buffering SSE. If the template shows fallback “yes” continuously, token/render session may be invalid or subscribe failed — rely on poll until reconnect. For distributed mode, verify Upstash pipeline (PING), env vars, and logs for `broadcast_realtime_publish_fail` / `broadcast_realtime_subscribe_fail`.
