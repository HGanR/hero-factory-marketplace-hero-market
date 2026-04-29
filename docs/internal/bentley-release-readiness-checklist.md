# Bentley release readiness

Concise validation checklist for the Bentley-guided Revenue OS workflow before calling the experience **stable** in production.

Use with staging first; production-only items are called out in § Risks.

---

## 1. Intake continuity

- [ ] Start guided intake on **AI Revenue OS** with a clean session (or scoped storage cleared for QA).
- [ ] Complete industry / audience / revenue optionals / content profile so `pipeline.intakeComplete` is set and Bentley does **not** re-ask structured intake fields.
- [ ] Refresh the page: intake answers **restore** from snapshot; guided flow resumes from **post-intake** state (no duplicate industry questions).
- [ ] Optional fields skipped with explicit skip/ack behave as before (no infinite re-prompt loops).

---

## 2. Dashboard restore

- [ ] From AI Revenue OS, use **Open Dashboard** / handoff so the Revenue OS dashboard loads with **Bentley snapshot + form** aligned (no empty industry when snapshot had one).
- [ ] Edit a field on the dashboard, return to AI Revenue OS: shared state reflects the edit where the bridge is designed to sync.
- [ ] `BentleyDashboardSharedStateSync` path: numbers/narrative match after navigation (spot-check one metric + one text field).

---

## 3. Run full analysis / resume behavior

- [ ] With intake complete, trigger **Run Full Analysis** or equivalent pipeline entry; confirm analysis artifact appears and `pipeline.analysisComplete` becomes true when the run succeeds.
- [ ] **Resume**: interrupt or fail a mid-pipeline step (or use a failed run): ambient strip / chat shows **failed phase**; **Resume** is available when rules allow; resume does not wipe completed workflow phases.
- [ ] Cross-tab: open a second tab on AI Revenue OS; workflow updates (BroadcastChannel / events) still converge without duplicate runs.

---

## 4. Launch readiness / prefill

- [ ] When `campaignGenerated` / launch prefill is produced, **Launch Campaigns** shows the **Prefilled from Bentley** banner and name/description prefill **without** clobbering after manual edits (edit description → change snapshot → text stays).
- [ ] Readiness summary line **Bentley campaign** shows a clear state (see copy): Ready / awaiting / merging / campaign step running — not a single ambiguous “Yes/No”.
- [ ] Navigate to **Launch Campaign** section (`#campaign-launch` on dashboard): section renders, posting targets align with intake OAuth targets.

---

## 5. Connected vs disconnected vs unsupported (publish)

- [ ] **Adapter-backed** network (e.g. LinkedIn): not connected → **Connect … to publish** (no disabled “Publish” that looks clickable); connected + valid token → **Publish now** enabled.
- [ ] **Expired token**: **Reconnect** path and chip/badge; publish not offered until reconnect (where applicable).
- [ ] **Unsupported** (e.g. TikTok adapter null): **manual-only** copy, **no** server publish button; no “Connect” implied as unlocking server publish for that network.
- [ ] Panel 3 API instructions still available for consultant handoff.

---

## 6. Publish route success / error behavior

Exercise `POST /api/campaigns/posts/:postId/publish` (manual publish from UI):

- [ ] **Success**: post moves to posted state; user sees success feedback; audit/deployment hooks as expected.
- [ ] **401**: message suggests signing in again.
- [ ] **409 IN_PROGRESS**: clear “already publishing” style message.
- [ ] **400 ALREADY_POSTED**: clear “already published”.
- [ ] **502 / PUBLISH_FAILED** with `code` (e.g. `ACCOUNT_NOT_CONNECTED`, `PLATFORM_UNSUPPORTED`): user-facing copy maps to **action** (connect / manual / unsupported), not raw stack traces.

---

## 7. Pipeline progress strip / dominant CTA

- [ ] **Seven pills** show Intake → … → Launch; completed stages stay **green** after later syncs in the same session (monotonic latch).
- [ ] **Current** / **Next** lines match real state (running phase, blocked, or launch-ready).
- [ ] **Single dominant CTA**: only one primary button in the strip — **Continue** (intake), **Run next stage** (resume), **Open Revenue OS dashboard** (when that path is active), **Open Launch Campaign** when `launchReady`.
- [ ] Launch-ready: CTA links to `/revenue-os/dashboard#campaign-launch` and next line explicitly hands off to **Launch Campaign** (not generic “what’s next”).

---

## Manual QA script — TROOTHHERTZ / Consulting / Entrepreneurs / TikTok

**Scenario name:** TROOTHHERTZ (branded run — use as the saved client / business label when the product allows).

**Persona:** Operator running a realistic SMB **Consulting** offer for **Entrepreneurs**, with **TikTok** as a posting target (**manual-only** server publish; validate copy, not OAuth-to-server publish).

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Open **AI Revenue OS**; start guided intake | Flow loads; Bentley chat available |
| 2 | Set **business** context to a consulting-style offer; set **industry** to **Consulting** (or equivalent); **target audience** e.g. **Entrepreneurs** | Fields persist; no duplicate intake after completion |
| 3 | Set **OAuth posting targets** to include **TikTok** (and at least one adapter-backed network e.g. LinkedIn if testing connect/publish) | Targets visible in analysis context |
| 4 | Complete intake through **pipeline intake complete** | Post-intake prompts use `getGuidedMissingField` / resume behavior, not full re-intake |
| 5 | **Open Revenue OS dashboard** from handoff; confirm form + snapshot | Data matches; no blank industry |
| 6 | Run **full analysis** (or pipeline steps until analysis complete) | `analysisComplete` reflected; dashboard numbers plausible |
| 7 | Progress **content → campaign** until campaign artifact exists or `campaignGenerated` | Launch section shows **Ready** or explicit **awaiting / merging / campaign running** |
| 8 | Open **Launch Campaigns** (`#campaign-launch`) | Prefill banner if applicable; **Bentley campaign** line is readable |
| 9 | **TikTok post row**: expect **manual-only**, no gold **Publish** for server; instructions mention panel 3 / native app | Matches unsupported adapter rules |
| 10 | **LinkedIn** (if connected): **Publish now** works OR **Connect** CTA if disconnected | No fake disabled Publish |
| 11 | Pipeline **strip**: verify pills + **Open Launch Campaign** when launch-ready | Handoff explicit |

**Record:** browser, date, operator initials, blockers (with screenshot or HAR for publish failures).

---

## Production-only / high-risk items

- **OAuth**: Production Meta/LinkedIn/TikTok app IDs, redirect URIs, and token refresh behavior; rate limits and webhook URLs if used.
- **Session storage / scope**: Bentley workflow and scoped keys behave correctly across **subdomain** and **HTTPS** in prod (not only localhost).
- **Publish**: Real network APIs; 502 from provider vs app bug — monitor logs and `code` on `PUBLISH_FAILED`.
- **Quota**: sessionStorage limits on large workflow artifacts; cross-tab sync under load.
- **Auth**: Session expiry mid-pipeline — user sees 401-style messaging on publish, not silent failure.

---

## Sign-off

| Area | Owner | Date | OK |
|------|-------|------|-----|
| Intake + snapshot | | | |
| Dashboard bridge | | | |
| Pipeline strip + CTA | | | |
| Launch + publish | | | |
