# STEP 2 Decision Engine & Unified Queue — 2026-11-03

Implementation under Charles's explicit proceed order, with the supplied STEP 2 work order and adopted charter v1.0. Draft review only. This does not activate a schedule or authorize deployment.

## 2.1 Revenue loop

GET and POST /api/cron/revenue-loop both use isAuthorizedInternalCronRequest. GET is provided because native Vercel Cron invokes GET. Daily cadence is enforced in persisted state, not assumed from HTTP timing. SKIPPER_REVENUE_LOOP_ENABLED defaults disabled. SKIPPER_REVENUE_LOOP_ADMIN_USER_ID must identify the existing ADMIN_USERNAME account; there is no arbitrary admin discovery or account creation. vercel.json is unchanged. A reviewed future daily schedule would use 0 8 * * * (UTC), with the existing internal cron secret.

The server calls the merged listTelemetryEventsFromDb directly, with a fixed per-run clock. It maintains separate forward and catch-up cursors, fully drains each chain to an empty page, and persists catch-up at that run's visibility watermark. Archived, internal system-note records in executive_agent_memory_items store the checkpoint and durable per-admin event receipts. The state row is locked FOR UPDATE. Receipts, deterministic proposal IDs, pending approvals, audit records, briefing and checkpoint commit together. A failure leaves the previous checkpoint; duplicate/overlapping invocations serialize on the state row. No schema or migration changes.

The loop also reconciles current pending accounts and submitted, non-revoked intakes directly from source tables. This finds current review opportunities even when a telemetry event is late or missing. It does not claim to reconstruct historical events or prove that an intake lacks a next step. Each proposal describes exactly what was observed. A subject/kind/admin key is proposed once, including after rejection; re-proposal requires a separate explicit operator workflow, not automatic resurrection. More than 100 telemetry pages per chain or 1,000 source rows per category fails closed; no successful checkpoint is claimed for a truncated scan. These operational budgets need representative-load verification before activation.

Only the code-priced membership model is eligible. Account counts and model prices are not collected revenue. The billing result is explicitly null/unverified. Mock/emulated campaigns, unpriced services and TROO sales are excluded. Membership charging remains UNVERIFIED: paylink destination, processor, reconciliation and the stub payment webhook need a separate verification. Setup fees are one-time, never ARR.

The only new executable action is recordRevenueOpportunityReview. The cron never executes it: insertExecutiveApproval stores it pending. After human approval through the existing gate, the canonical stored action revalidates its subject and records an internal decision. It does not approve accounts, offer next steps, contact members, charge money, publish, launch campaigns or merge code. Those future business actions need their own reviewed executors and approval rows.

## 2.2 Adopted charter

policy/skipper-charter.v1.json is the versioned, structured representation of Charles's supplied adopted policy: whole-system ARR target, SubVendor exclusion, membership model/billing caveat, three distinct roles, six duties and ten limits. Identical JSON is vendored in hero-market, skipperdesktop and skipper to avoid an unavailable remote dependency at startup. Policy changes must update all copies and compare their byte hashes; no network fetch or new outside service is required.

Website authoritative executive prompt stack, Desktop mission/context injection and Coding Agent coding/executive/conversation prompts import their local versioned policy module. Adoption is policy, not evidence that every duty or integration is already implemented. Existing capability/role prompts remain contextual; they grant no new tools or authority.

## 2.3 Shared queue

GET /api/admin/executive-agent/approvals keeps the legacy approvals array and adds schemaVersion + queue DTOs. It remains admin/owner-scoped, includes all five stored states and all existing action categories, and disables caching. Both queue views read that same endpoint through their existing browser/native authentication paths. Bentley/campaign, code/site-builder, outreach/follow-up and operations items share the same DTO. Unsupported actions gain no new executor merely by appearing in a queue. Local unsubmitted drafts remain clearly distinguished from persisted server proposals.

Each UI is collapsed by default. While open it refreshes every 15 seconds and on window focus, and refreshes after decisions. This is polling, not WebSockets or an always-running Desktop agent. It shows the latest 100 server proposals, status filters and stored payload before an explicit confirmation. It does not optimistically claim execution. Auth/read/decision failures disable decisions until refresh.

Approve continues through the STEP 0 persisted-row gate/dispatcher. Desktop now sends literal humanConfirmed=true only on explicit approval/rejection gestures. Rejection also calls validateApprovalGate and uses an owner/pending compare-and-set, with status update and success audit in one transaction. A losing reject/approve race cannot overwrite an approved or executed row. Refusals are audited. Older reject clients must update to send humanConfirmed=true.

## Verification and limits

Local: node --test tests/step2/*.test.mjs (39/39), node --test tests/step2/charter.test.mjs in Desktop (1/1), python -m unittest discover -s tests -p test_adopted_charter.py in Coding Agent (2/2). Website tests bundle actual pure coordinator, gate, rejection handler, queue normalizer and prompt construction; HTTP tests invoke actual cron/list route handlers with auth/persistence/coordinator fixtures. These are not new-loop MySQL/TiDB locking tests. They do not replace PR #17's merged-feed SQL verification.

Pending: repository CI/typecheck results; new-loop actual MySQL/TiDB transactions and concurrency; native Mac runtime; simultaneous Website/Desktop state-update walkthrough; populated-feed delivery; representative-load limits and approved activation. No live registration, approval execution, membership charge, provider call, source-table mutation, production migration or STEP 2 deployment was performed for this change.
