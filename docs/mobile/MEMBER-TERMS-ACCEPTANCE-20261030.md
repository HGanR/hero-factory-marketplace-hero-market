# Required member terms acceptance — prepared integration

## Requested behavior

An approved, active member may authenticate with their existing credentials, but cannot retrieve the mobile profile until they affirm the currently published member terms. Verified website administrators bypass this step and create no member acceptance record. This applies to the mobile session/profile surface, not to unrelated website routes or installed older applications.

GET /api/mobile/session returns terms-required metadata instead of profile data until an account-bound receipt matches the current document version and SHA-256. POST login also omits profile data when the requirement is enabled. No localStorage flag or client-provided member ID can unlock the profile.

The app offers a link to read/retain the agreement, an initially unchecked checkbox, Agree and Continue, and Decline and Sign Out. A saved acceptance must be confirmed by the server before profile data is returned. Failed saves and stale document versions keep the profile blocked. The profile can display the accepted version and server UTC date.

POST /api/mobile/terms requires a valid non-admin member session, same-origin JSON and exactly accepted=true/version/sha256 for the current published document. The database rechecks active/approved/password-set eligibility. Neither the client date nor a client-supplied account ID is accepted.

## Durable record

The additive migration is `drizzle/manual/mobile_terms_acceptances_20261030.sql`:

- `mobile_terms_documents` retains an immutable version/hash/title/exact HTML snapshot independently of future source edits.
- `mobile_terms_acceptances` records member ID, version, hash and database-generated UTC acceptance time. A unique member/version/hash key makes retries preserve the first acceptance date. Account deletion does not cascade-delete this audit evidence.

Existing member rows, passwords and approval flags are untouched by the migration. No IP address, device fingerprint or user-agent collection is added. These are application audit records, not a claim of legal enforceability or tamper-proof evidence.

## Activation is pending two concrete prerequisites

The owner's uploaded `Pasted markdown.md` is preserved verbatim in `docs/mobile/terms/SMART-TRUST-MEMBER-TERMS-DRAFT-20261030.md`. It supplies the full 17-section agreement and explicitly flags the legal-name spelling discrepancy. It is source material for finalization, not a finalized published agreement.

1. Supply the final agreement text. The existing `/mobile/terms` document is explicitly a proposed SMART TRUST DESKTOP agreement with `[INSERT DATE]`, operator formation state, business address, legal/support email, privacy-policy link and governing-law/venue placeholders. It is preserved as review-only. `src/lib/mobile/terms-document.ts` deliberately has published=false and rejects unresolved placeholders. No acceptance of this draft is collected. Replace it with the owner's approved final copy, identify its version/effective date, and publish that exact body before enabling the gate.
2. Approve and apply the two-table migration to the account database, after validating it in an isolated MySQL/TiDB test schema. Production schema changes require explicit owner approval. Nothing auto-runs the migration at startup or build time.

After both, set SMART_TRUST_MOBILE_TERMS_REQUIRED=true only on the reviewed mobile branch and deploy the exact reviewed commit. The existing database readiness script then requires a published document and the new table columns before deployment succeeds. Administrator bypass must be tested separately. Keep the current working custom-domain deployment until those checks pass.

The current live member login is not changed by preparing this branch. No feature flag is enabled, no tables are created, no production acceptance records are inserted, and no legal text is represented as finalized by this work.

## Validation

Focused tests cover server-side profile withholding, login-response withholding, administrator bypass, stale/current document handling, affirmative consent, member/date spoof rejection, storage failures, and receipt display. Database protocol fixtures are explicitly distinct from real SQL execution.

An opt-in real MySQL/TiDB test uses TEST_MOBILE_TERMS_DATABASE_URL and refuses anything except an empty database named mobile_terms_test_*. It creates only synthetic test tables, tests the real migration/idempotency/eligibility path, and cleans up only those test tables. It must never point at DATABASE_URL. If no isolated test database is provided, that integration test is reported skipped. No live acceptance action is performed by automated tests.

Owner audit query after activation:

```sql
SELECT a.member_id, u.username, a.terms_version, a.terms_sha256, a.accepted_at
FROM mobile_terms_acceptances a
LEFT JOIN marketplace_users u ON u.id = a.member_id
ORDER BY a.accepted_at DESC
LIMIT 100;
```

To retain historical agreement text, look up mobile_terms_documents by the receipt's version and hash. Do not overwrite an accepted document when terms change; publish a new version and require renewed acceptance for that version.
