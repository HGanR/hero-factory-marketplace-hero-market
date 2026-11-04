# SKIPPER QR workspace artifact — implementation draft

This is the next production adapter after Stephon, stacked on website PR #24. Registration in this branch is not evidence of deployment or live availability. No production migration, provider, spending, publication or sending is introduced.

## Operator flow

Select an owned client workspace in paired Tell Skipper, then request a QR for the intended http(s) URL. The companion Coding Agent change resolves the current selection against the authenticated catalog, asks for a missing URL and prepares a proposal. Only explicit human approval goes through the existing canonical approval route. The executor returns private PNG/SVG download pointers, hashes and independent decode results. This implementation creates a URL QR, not a new destination website or tracking service.

## Ownership and storage decision

Existing `trusts.userId` remains authoritative, and this server path additionally requires `trusts.clientId` to match the selected owned `clients.id`. Both must belong to the calling admin. Unlinked legacy trusts are rejected; no link is invented or migrated. The catalog lists up to 50 owned client-linked workspaces for resolution. Proposal and approval preflight check both relationships; the executor checks before rendering and under row locks before persistence. Downloads check current ownership again.

Reuse existing `trust_assets.description` for the additive legacy config plus receipt, and an archived `executive_agent_memory_items` system-note record for gzip/base64 PNG/SVG bytes, away from ordinary prompt memory. An internal client note records the receipt. All three writes occur in a nested transaction/savepoint, since the canonical dispatcher catches business exceptions. No new table, ephemeral server filesystem or public object store. Each serialized TEXT record is conservatively capped at 60,000 UTF-8 bytes, decompression at 1MB. Oversize generation fails before saving. Files remain private and retained with the existing workspace records; no new automatic deletion schedule or expiry is introduced. Private data occupies existing DB storage, not a new paid service.

## Renderer and scope choices

Pin the page's already locked transitive encoder as a direct dependency (`qrcode` 1.5.4), promote `pngjs` 7.0.0 and existing Next optional `sharp` 0.34.5 to direct runtime dependencies, and add pinned `jsqr` 1.4.0. PNG and SVG come from one QR matrix; every generation decodes the actual PNG with PNGJS/jsQR and rasterizes the actual SVG with Sharp/libvips then decodes it with jsQR. Stored bytes are these verified bytes; the download route checks receipt binding and content hashes before serving attachments under no-store/sandbox/nosniff headers.

V1 accepts square black modules on white only, quiet zone at least four modules, all four ECC levels, 128–2048 px with a minimum of two pixels per module. Other colors, shapes, gradients and custom finder eyes are refused rather than downgraded. Browser styling remains unchanged. URL cap is **600 characters**, intentionally below the existing canonical audit writer's 800-character scalar truncation so a job receipt retains the exact target. Larger or too-dense outputs fail explicitly. Parse/validate locally and encode the exact validated string. Optional unique mode appends a server-generated qrid using the existing URL-parameter behavior, and records both requested and final URLs; appending an ID does not implement analytics. Credentials, non-http(s), controls, interior whitespace and unsupported options fail closed. Never fetch a supplied URL, resolve it as an image or inspect its destination.

Decoded does not mean the destination is live, safe, owned, commercially ready, or printable at every size. The receipt carries scanner/print review requirements and a heuristic density warning. No model, subagent or QR string may approve an action.

## Verification

CI installs the committed manifest/lock with npm ci, imports and executes the production renderer, runs all ECC/Unicode/unique-mode/decode/no-fetch/corruption checks, then uses disposable MySQL 8 and TiDB 8.5.4 for actual canonical gateway/approval/dispatcher/QR writes, row locks, replay and protected downloads. Only DB binding, admin-id wrapper (delegating to real signed-session verification), and unrelated executors/services are replaced. SQL, the QR executor, artifact route, gate, approval store and dispatcher are real. Existing boundary/gateway/STEP 2 tests run separately. This is not a claim of a clean full Next build or live production/Mac testing; full-repository baseline diagnostics remain separate.

Pending at draft creation: CI results, configured production schema compatibility and signed-in Mac/website walkthrough. Deployment and live verification require the existing stack to be integrated separately. The rest of the requested engine portfolio and multi-engine project orchestration remain future work, not implied by this QR adapter.
