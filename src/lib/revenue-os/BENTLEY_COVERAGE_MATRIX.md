# Bentley Revenue OS — coverage matrix

Status legend: **unit** = automated unit / pure logic tests · **int** = jsdom integration / component tests · **route** = Next route handler (node) · **manual** = recommended QA · blank = not meaningfully covered yet.

| Stage / concern | unit | int | manual | Notes |
| --- | --- | --- | --- | --- |
| Intake & snapshot merge | ✓ | ✓ | ○ | `bentley-orchestrator`, `bentley-continuity-handoff`, dashboard continuity spec |
| `resumePipeline` → `runFullPipeline` | ✓ | — | ○ | `bentley-workflow-resume.spec.ts` (mocked runner) |
| Workflow phase order / `getFirstIncompleteWorkflowPhase` | ✓ | — | ○ | `bentley-workflow-resume.spec.ts` |
| **`runFullPipelineAction` execution (focused)** | **✓** | — | ○ | **`run-full-pipeline-action.spec.ts`** — lock, skip, failure preservation |
| **`runFullPipelineAction` chain (integration-style)** | — | **✓** | ○ | **`run-full-pipeline-chain.integration.spec.ts`** — partial workflow → ordered advance; market-sweep failure preserves prior stages; external I/O mocked |
| `syncPipelineStagesFromWorkflow` / merge OR | ✓ | ✓ | ○ | Stage sync + `RevenueOsDashboardLaunchContinuity` |
| Dashboard form→snapshot→pipeline resync | — | ✓ | ○ | `onBentleySnapshotAppliedFromForm` + `BentleyDashboardFormSyncWithPipeline`; continuity spec mirrors |
| Deployment handoff stage machine (`advanceBentleyPipelineStage`) | ✓ | — | ○ | `bentley-pipeline-deployment-handoff.spec.ts`, golden path |
| Dashboard handoff / applied-form | ✓ | ✓ | ○ | `bentley-continuity-handoff`, `RevenueOsDashboardLaunchContinuity` |
| Launch prefill / `campaignGenerated` gate | ✓ | ✓ | ○ | `bentley-launch-prefill`, `CampaignLaunchSection.bentley-snapshot` |
| Launch readiness summary | ✓ | — | ○ | `bentley-launch-readiness-summary.spec.ts` |
| Connect vs publish (`CampaignLaunchSection`) | — | ✓ | ● | `CampaignLaunchSection.connect-publish.spec.tsx` |
| Publish adapter / load context (pure) | ✓ | — | ● | `campaign-post-publish-execution.spec.ts` |
| **`POST /api/campaigns/posts/[postId]/publish` (route)** | — | **route ✓** | ● | **`publish/route.spec.ts`** — success 200; `ACCOUNT_NOT_CONNECTED` / `PLATFORM_UNSUPPORTED` → 502 + codes |
| OAuth planner / governed panels | — | partial | ● | LinkedIn panel has testids; not full matrix |
| Publish workers / scheduled path | partial | — | ● | Worker not duplicated here |
| Canonical snapshot hydration | ✓ | — | ○ | `bentley-canonical-launch-bridge.spec.ts` |

**Manual QA (high value):** full guided intake → pipeline → dashboard → create drafts → connect OAuth → schedule/publish on a real tenant; cross-browser OAuth redirects.

## Final remaining production-only / integration risks

1. **Real HTTP bodies** — `run-*` API modules are mocked in pipeline chain tests; production still depends on live `/api` behavior and payload shapes.
2. **Database fidelity** — publish route tests use mocked `getDb` chains; real Drizzle + MySQL semantics (transactions, row locks) are not exercised here.
3. **OAuth token lifecycle** — refresh, expiry, and provider-specific failures are manual / separate suites.
4. **Cross-tab workflow sync (`BroadcastChannel`)** — not covered.
5. **Empty / stub workspace files** — integration spec mocks `bentley-notes-payload` when the file is empty in-tree; a real implementation should remove that test shim.
6. **Dashboard race** — debounce + rapid edits remain a minor residual risk (mitigated by signature dedupe + `onBentleySnapshotAppliedFromForm`).
