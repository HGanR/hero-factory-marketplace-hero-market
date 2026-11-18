# Trust Records guided workspace: preservation-first renovation

Scope: website `/trust-records` and all linked trust-records routes. This branch is for a non-destructive UX renovation. Do not merge or deploy without explicit approval.

## Non-negotiable preservation
- Keep every existing form field, option, asset, trust type, certificate, QR/barcode, watermark, seal, minutes, resolutions, amendments, ledger, deed, instrument, export, and API integration.
- Do not modify stored records, storage keys, legal instrument contents, permissions, verification behavior, or existing URLs.
- Existing workflows must remain accessible by direct links and by a visible **All tools / Advanced** entry.
- No competency quizzes or gating in this phase.

## Source inventory (main branch, 2026-11-18)
- `src/app/trust-records/page.tsx` (3614 lines): trust certificate console with tabs, registry, minutes, resolutions/amendments, extensive settings for entity, certificate prefix, seal, watermark opacity/scale/rotation, QR/barcodes, etc.
- `src/app/trust-records/layout.tsx`: auth, active trust context, workspace summary, identity and assistant strips. Preserve access and state resolution.
- `src/app/trust-records/[trustId]/wizard/[step]/page.tsx`: wizard route presently renders a step label with placeholder body; do not promote as complete until implemented.
- `src/app/trust-records/wizard/irrevocable-trust/page.tsx`: separate existing irrevocable trust wizard.
- Nested routes: estate/will, governance/minutes/new, hybrid-ledger, jarva, instruments, assets/deeds, brokerage-deposit, and related APIs.

## Proposed user flow
1. Welcome: choose **Start a trust records workspace**, **Continue existing**, or **Browse all tools**.
2. Select existing supported trust type; never imply a platform draft itself creates a legally valid trust.
3. Show only relevant existing data-entry sections in a progressive stepper; preserve underlying state and validation.
4. Review documents and asset records; link to existing instruments/deeds/minutes.
5. Review, save, and access existing export/certificate tools. Explain jurisdiction-dependent execution/funding steps without individualized legal advice.

## Interface grouping
- **My workspace**: active trust, saved drafts, recent records.
- **Create / continue**: supported workflows and their progress.
- **Records & governance**: assets, deeds, instruments, minutes, resolutions, amendments, ledgers.
- **Documents & certificates**: registry, issuance, preview, exports.
- **Document appearance & advanced** (collapsed by default): seal, watermark, QR, barcode, prefixes, authorized units, other settings.
- **All existing tools**: complete unchanged console and deep links as fallback.

## Implementation guardrails
- Prefer additive navigation shell and disclosure wrappers; no rewrites of certificate generation, persistence, or APIs.
- Maintain keyboard accessibility, mobile layout, focus management, and back/forward navigation.
- Test direct routes, all tabs, existing saved records, image uploads and removal, QR/verification, certificates, role-based access, export, and mobile widths.
- Compare before/after route and control inventory; zero removed functionality is the acceptance criterion.
- Separate protected preview and approval required before production.
