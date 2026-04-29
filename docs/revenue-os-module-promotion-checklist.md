# Revenue OS — module promotion checklists (implementation-backed)

**UI:** `src/components/roadmap/SystemArchitectureModules.tsx` module badges (**LIVE** vs **PARTIAL**) follow this stricter bar, not “baseline route exists.”

This document separates **what is already shipped in code** from **what remains for a “full LIVE” product bar** (persistence coverage, execution, governance, downstream reuse). It is derived from the codebase as of the last audit.

**Files audited:** `src/components/roadmap/SystemArchitectureModules.tsx`, `src/lib/db/schema.ts` (Revenue OS tables), `src/app/api/revenue-os/**`, `src/lib/db/revenue-os-live-modules-ensure.ts`, `src/lib/revenue-os/market-scan-normalize.ts`, `src/lib/revenue-os/market-scan-persist-sources.ts`, `src/lib/revenue-os/capital-plan-vs-actuals.ts`, `src/components/revenue-os/BenchmarkComparisonPanel.tsx`, `MarketScanHistoryPanel.tsx`, `PlanVsActualsPanel.tsx`, `DeploymentCenterPanel.tsx`, `OfferLadderPanel.tsx`, `ActiveExperiments.tsx`, `src/app/revenue-os/dashboard/page.tsx`, `src/lib/revenue-os/bentley-action-map.ts`, `src/lib/revenue-os/bentley-action-runner.ts`.

**Bentley (orchestration):** Covers the **core pipeline** (research → trends/synthesis → content engine → campaign → media brief → full analysis) via shared `run-*` helpers and correlation headers. It does **not** by default drive `market/scan`, `offers/generate`, `capital/plan`, `deploy/*`, or `experiments*` unless separately wired.

---

## Module 1 — Market Intelligence Engine

### LIVE (promotion bar met)
- **Routes:** `GET /api/revenue-os/benchmarks`, `POST /api/revenue-os/market/scan` (normalized `v:2`, citation filtering), `GET /api/revenue-os/market/scans`, `GET /api/revenue-os/market/scans/:id`.
- **Persistence:** `industry_benchmarks`; `market_scans` stores full structured payload (competitors, pricing, demand gaps, regulatory, citations) when `userId` is provided; `market_sources` upserted per citation URL on each persisted scan (`last_market_scan_id` audit).
- **UI:** `BenchmarkComparisonPanel` + `MarketScanHistoryPanel` (run scan, list, select, cited drill-down) on revenue dashboard.
- **Correlation:** `logBentleyCorrelationEvent` on benchmarks, market/scan, market/scans list/detail.

### Out of scope / minor gaps (not blockers for LIVE badge)
- **Regulatory / demand gaps:** Heuristic / benchmark-derived only; not a separate research pipeline.
- **Scan persistence:** Still requires explicit `userId` in API body (dashboard passes resolved user id).
- **Governance:** No formal scan approval workflow, versioning, or `diff` between scans.

### Checklist (post-LIVE enhancements)
- [ ] **Governance:** Optional `scan` version, `superseded_by`, or “approved scan” workflow.
- [ ] **Bentley:** Optional step to call `market/scan` after intake (not required for core pipeline).

---

## Module 2 — Offer Engineering Core

### Already live (code)
- **Routes:** `POST /api/revenue-os/analyze` (offer plan in response), `POST /api/revenue-os/offers/generate`.
- **Persistence:** `offer_packages` + `offer_versions` versioned per workspace (on successful DB path).
- **UI:** `OfferLadderPanel` on dashboard (consumes analyze output).
- **Correlation:** analyze + offers/generate.

### Partially live
- **Version history:** Stored in DB; **UI does not load “pick version”** from `offer_versions`.
- **Single source of truth:** Analyze run vs offers/generate can diverge; no unified “offer package id” on analyze response.

### Missing for full LIVE
| Area | Gap |
|------|-----|
| **Persistence** | Optional FK from `revenue_os_runs` / `revenue_profiles` to `offer_packages.id`. |
| **Governance** | No approval state, publish flag, or rollback. |
| **Downstream reuse** | Campaign / content flows don’t reference stored `offer_versions.id`. |

### Checklist
- [ ] **Schema:** `offer_versions.status` (DRAFT/PUBLISHED) optional; link `revenue_os_runs` → `offer_version_id` optional.
- [ ] **Routes:** `GET /api/revenue-os/offers/versions?packageId=` or `?userId=&clientId=`.
- [ ] **UI:** Version picker + diff view on dashboard.
- [ ] **Bentley:** Could pass `offerVersionId` into downstream steps when exists.

### Primary blockers
**No UI/API for listing or selecting stored offer versions**; **analyze ↔ stored offer** linkage not explicit.

---

## Module 3 — Deployment Automation Layer

### LIVE (promotion bar met)
- **Artifacts (unchanged):** `revenue_os_funnels`, `revenue_os_funnel_pages`, `revenue_os_message_sequences`, `revenue_os_sequence_steps`.
- **Execution audit:** `revenue_os_funnel_deployment_runs` (on successful funnel POST), `revenue_os_sequence_execution_runs` (on each execute; success/failure with summary/error).
- **Routes:** `POST` funnel/sequences (unchanged), `GET /api/revenue-os/deploy/funnel`, `GET /api/revenue-os/deploy/sequences`, `GET /api/revenue-os/deploy/runs`, `POST .../sequences/[id]/execute` (persists run + `runId`).
- **UI:** **`DeploymentCenterPanel`** — recent funnel + sequence runs, status badges, summaries; dry-run execute with visible **mock / no ESP** banner.
- **Providers:** SendGrid/Twilio **not** integrated; `provider: none`, `mode: dry_run|mock`, `externalProvidersAvailable: false` in API payloads.

### Out of scope / minor gaps
- **Real delivery:** Webhooks, idempotency keys, secrets, live `provider` values.
- **Governance:** No prod approval gate before execute.
- **Downstream:** Campaign launch does not auto-bind funnel/sequence IDs (optional future).

### Post-LIVE enhancements
- [ ] **Bentley:** Optional “deploy after brief” step (read-only hook is enough for later).
- [ ] **ESP:** Wire SendGrid/Twilio + flip `provider` / `mode: live` when configured.

---

## Module 4 — Capital Allocation Optimizer

### LIVE (promotion bar met)
- **Routes:** `POST /api/revenue-os/analyze` (returns `meta.profileId`), `POST /api/revenue-os/capital/plan`, `POST /api/revenue-os/capital/channel-spend`, `GET /api/revenue-os/capital/plan-vs-actuals`, `GET /api/revenue-os/capital/plans`.
- **Persistence:** `capital_plans` with `profile_id`, `snapshot_month`, workspace; `channel_spend_snapshots` upserted per month/channel with optional `revenue_attributed`, `roas`, `profile_id`.
- **UI:** CAC Risk Band, monthly snapshots, **`PlanVsActualsPanel`** (plan vs actuals, save actuals, overspend/underspend/ROAS flags).
- **Correlation:** capital/plan, channel-spend, plan-vs-actuals, plans list, analyze.

### Out of scope / minor gaps
- **DB FK:** `profile_id` remains app-validated (no hard FK to `revenue_profiles` in all environments).
- **Governance:** No locked plan or automated budget cap enforcement.
- **Downstream:** Experiments/campaigns do not auto-consume `capital_plans` (optional future).

### Post-LIVE enhancements
- [ ] **Bentley:** Optional capital step after analysis (not required for core pipeline).
- [ ] **Imports:** CSV ingest for channel spend at scale.

---

## Module 5 — Continuous Optimization Engine

### Already live (code)
- **Routes:** `POST/GET /api/revenue-os/experiments`, `POST .../result`, `PATCH .../[id]`.
- **Persistence:** `revenue_os_experiments`, `experiment_variants` (default A/B on create), `experiment_results` (variant metrics + winner).
- **UI:** `ActiveExperiments` on dashboard (list, create, patch).
- **Correlation:** experiments + result + patch.

### Partially live
- **GET experiments** does not return **variants** or **results** nested (UI shows flat experiment list).
- **“Offer reconstruction trigger”** is **manual** (no automatic job when KPIs stall).

### Missing for full LIVE
| Area | Gap |
|------|-----|
| **Persistence** | Optional experiment ↔ `offer_version` / `campaign` link. |
| **Execution** | Scheduled evaluation, statistical significance, not just max revenue lift. |
| **Governance** | No review/approval before concluding WON/LOST. |
| **Downstream reuse** | Winning variant does not auto-update offer ladder or launch. |

### Checklist
- [ ] **Schema:** Optional `experiment_id` on campaign or offer_version; `experiment_results` already sufficient for MVP.
- [ ] **Routes:** `GET /api/revenue-os/experiments/:id/variants` or expand GET list payload.
- [ ] **UI:** Variant detail + results table; “Apply winner” CTA.
- [ ] **Bentley:** Optional experiment suggestion after analysis (not wired).

### Primary blockers
**No automated offer-reconstruction**; **variants/results not exposed in dashboard list UX**.

---

## Promotion priority (recommended)

1. **Closest to “full LIVE”:** **Module 2** (storage + UI gap is narrow) and **Module 5** (core loop exists; needs UX + automation).
2. **Mid:** **Module 4** is LIVE; next polish is governance/imports if needed.
3. **Heavier lift:** **Module 3** polish is mostly **real ESP integrations** (UI + audit trail are LIVE).
4. **Foundational data:** **Module 1** meets the LIVE bar (`market_sources` + scan history); prioritize **Module 2** next per product goals.

---

## Exact blockers summary (why “product LIVE” is still gated)

| Module | Hard blocker |
|--------|----------------|
| **2** | Offer versions not selectable in UI; weak link to analyze. |
| **5** | No automated win → apply; experiments GET lacks variant/result detail. |
