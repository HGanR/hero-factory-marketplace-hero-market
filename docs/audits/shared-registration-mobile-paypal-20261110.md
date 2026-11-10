# Shared registrations and mobile PayPal attribution

New mobile and website registrations must enter the same marketplace_users pending queue (isApproved=false, isActive=false, passwordHash=NULL). The website account service is canonical; mobile forwards only email/username with registrationSource=mobile to that fixed HTTPS service. Mobile does not create device-only users, passwords or simulated email verification. Existing approved members retain their current sign-in and generated-password workflow.

The canonical account insert and its source-labelled site_analytics_events receipt commit together in an isolated TLS-configured transaction. Duplicate requests do not create a second receipt; failures roll back both writes. Existing email/username unique indexes enforce concurrent uniqueness. Public analytics ingestion rejects the reserved account.registration.* namespace so clients cannot manufacture successful account-registration receipts.

The attached Smart Trust Mobile test HTML supplies https://www.paypal.com/ncp/payment/YPS4H5NTVWDYE. The live app code adopts that outbound link without importing its device-only account or simulated email-code logic. The server fixes the trigger label to **Mobile app TROO Token purchases**, eventName mobile.troo_token.paypal.open, eventType outbound_paypal, source mobile_app and paymentVerified=false. The client uses a same-origin, keepalive event request and opens PayPal independently of analytics availability. No amount, completed payment, token balance, fulfillment, approval or KYC status is inferred from opening the link.

Skipper's existing pending-account tool already counts marketplace_users where isApproved=false, regardless of channel. The daily briefing now includes seven-day registration-source counts and mobile TROO PayPal trigger counts. Registration/purchase-trigger counters use a dedicated aggregate rather than the top-24 CTA ranking. Existing mysql2 [rows,fields] results are normalized with the repository helper so real source and CTA rows reach analytics. The daily briefing also receives the existing site-traffic rollup rather than dropping it when constructing live metrics.

## TiDB

No new tables, columns, enums or migration are proposed. Existing tables marketplace_users and site_analytics_events are sufficient. Run `node scripts/verify-registration-readiness.mjs` in the configured website environment to verify required columns and single-column unique indexes. This only reads schema metadata and zero-row SELECTs; it creates no account and changes no data. Schema definitions establish the expected structure; an unrun readiness check does not establish live database readiness. If it reports a missing table/index, resolve the existing analytics/account schema before release rather than creating tables at request time.

## Rollout and validation

Deploy the canonical website account service before enabling the mobile registration form on the live domain. Mobile preflights the version-2 capability before submission, so an older backend cannot create an untracked mobile account. Website and mobile releases remain separate, reviewable deployments; no production alias is changed by this implementation work.

Focused tests cover pending-account/source receipts for both channels, duplicate retries, analytics-write rollback, input validation, reserved analytics names, mysql2 result normalization, briefing aggregation, mobile proxy boundaries, fixed PayPal attribution and form/link behavior. No real registration or payment was submitted during testing. Authenticated live Skipper briefing refresh, true member signup and real PayPal settlement remain acceptance items. Historical account sources are not fabricated or backfilled.
