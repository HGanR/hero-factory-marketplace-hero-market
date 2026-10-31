# Shared website engine orchestration — 2026-10-31

## Operator experience

After website sign-in and an active workspace pairing, native Desktop automatically establishes the website engine session. The operator does not re-enter the website password in Coding Agent, choose GitHub source, share Code DNA or select a graph symbol to use website engines. The one-time local workspace pairing permission remains necessary; website identity does not grant unrestricted local computer access.

Try ordinary conversation:

- `Available engines`
- `Company findings`
- `Research barbershops for [client name]`
- `Ask Bentley to research ...`
- `Approve this engine job`, or `no` in direct response to its exact pending proposal
- `Engine status`

The configured model may select a registered engine and resolve business names from the account's bounded client list. It cannot approve the proposal, choose a new HTTP destination or grant tools. Ambiguous or missing business context produces a business question rather than a request to look up a UUID.

`Company findings` queries current accounts, analytics, agent coordination and website-project status, then requests a source-grounded synthesis from the existing configured model. If synthesis is unavailable, the evidence is preserved. Reports are saved in the account-scoped SQLite store and private `engine-reports/*.txt` files next to it. Revenue hypotheses are not verified revenue or proof that a product is ready.

## Registered website adapters

| Adapter | Existing implementation | Result boundary |
| --- | --- | --- |
| company.accounts | Executive account read tools | Account counts, not payments |
| company.analytics | Executive platform analytics tool | Recorded analytics with source limits |
| agents.overview | Existing coordination overview | Registry/routing facts, not completed work |
| bentley.outputs | Owned campaign outputs read | Existing campaign data |
| stephon.projects | Owned site-builder status | Current project status |
| eleanor.operations | Fulfillment operations overview | Account-scoped operations |
| jarva.smart_trust | Smart Trust fulfillment tool | Governance status, not legal execution |
| reality.engagement | Engagement summary tool | Read-only engagement |
| skipper.knowledge | Existing knowledge-base summary | Summary, not every document read |
| bentley.market_research | Approved triggerBentleyAnalysis, fixed market_sweep | Existing Reddit research executor; provider readiness/charges still apply |
| bentley.campaign_drafts | Approved triggerCampaignSync | Existing unscheduled-draft-only executor |
| stephon.intake | Approved createSiteBuilderTask | Internal intake note; **does not generate a website** |

The gateway does not expose arbitrary actions, publishing, scheduling, token purchases or full-lifecycle launch. Additional callable engines can be added as typed, owner-scoped adapters after their actual interfaces are reviewed. Existing engine availability does not establish agentic product quality.

## Authentication, persistence and cancellation

Native Rust reads existing JWT cookies from keychain/session storage and sends them directly to the fixed loopback service, under the active pairing bearer. Website JWTs are not returned to the webview, written to report files or included in error messages. A prepared one-use handoff ID binds the request; cancellation and newer sign-in attempts invalidate stale responses. Native requests do not follow redirects.

The service requires the configured HTTPS website origin to match Desktop. It verifies both the authenticated summary and the new catalog/account ID. Website credentials remain in memory and expire/disconnect with their session. Runtime records use a verified website-origin/account-ID scope, and approvals are additionally tied to their conversation. Legacy username-scoped client-plan records remain on disk; this change does not migrate or delete them.

Website mutations require same-origin requests and the existing executive approval policy. Input schemas reject unknown fields and execution-mode overrides. Client and campaign ownership are checked before proposal and execution. Proposal IDs are durable and immutable; atomic pending-to-approved/rejected transitions prevent duplicate or competing approval requests from executing an action twice. Failed or uncertain executions are not automatically replayed. Final results come from the existing audited executor receipts. A job with no confirmed receipt remains uncertain, even if a model says it succeeded.

## Automatic local code context

After successful website connection, the service can recognize the conventional local Hero-Market checkout, or a host-configured `SKIPPER_WEBSITE_REPO`. Its Git remote must match `HGanR/hero-factory-marketplace-hero-market`, and its GitNexus metadata must identify that actual folder. It binds an eligible, bounded path snapshot and enables the already-installed CLI. An existing operator-selected source is preserved. No recursive disk scan, package installation, index rebuild or raw query interface is added.

An unambiguous existing npm-cache GitNexus executable can be recognized automatically when PATH and `SKIPPER_GITNEXUS_BIN` are absent. Multiple cached installations require a one-time host choice. Graph enablement is not a successful-query receipt.

On the owner's Mac, native symbol context was verified against Bentley's component and its callers. Full-text search remains blocked by a GitNexus FTS binary referencing a missing system C++ symbol. Automatic context does not conceal or repair that binary incompatibility. Website engines are independent of local full-text search.

## Reference image handoff

An explicit REN reference-creation workflow or image creation request can proceed through the existing private draft handoff even without the optional local neural provider. It retains source/evidence hashes, readiness checks, canonical REN/TAYO assignment, existing worker authorization and revision checks. A blocked handoff returns the saved project and reason rather than discarding the analysis. Mere generic image analysis does not authorize a build. Existing neural-provider routing remains intact.

This removes another manual handoff for supported private drafts. It does not implement a new reconstruction model, autonomous visual repair loop, professional mesh/topology certification, or permission to publish a catalog asset. An uncertain floor count or unsupported geometry remains a genuine blocker rather than being silently invented.

## Activation and review

Install all three matching feature branches together. The website branch targets `recovery-from-prod`; Coding Agent and Desktop are stacked on their earlier `feat/client-brief-coding-handoff-20261031` branches. Deploying the website gateway and installing the updated apps are required before the new connection works. No production deployment or PR merge is performed by this implementation.

Preserve the owner's dirty Hero-Market checkout, including its unsaved delegation/server-work code. This source change is based on the remote repository and does not import or overwrite that uncommitted implementation. Use an isolated checkout or protected preview for integration review.

Validation covers the Python session/job/context/reference boundaries, website coordinator idempotency/approval/rejection/ownership contracts, strict coordinator TypeScript, Desktop connection lifecycle, and a native Rust transport harness compiling the production handoff body without Tauri UI dependencies. Native Mac packaging, real signed-in website/database/provider execution and professional modeling output are separate integration checks; fixture tests are not evidence that those passed.

Three pre-existing `test_conversation_attachments.py` failures (two old image-route expectations and exact timeout equality) were reproduced with the unchanged parent source as well as this change. They were not modified or counted as passing.
