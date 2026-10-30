# Mobile access to existing website member credentials

The owner explicitly approved copying the existing hero-market DATABASE_URL credential into the separate smart-trust-mobile-preview Vercel project on October 30, 2026, scoped to the reviewed mobile-login branch. The credential is configured as a sensitive Preview variable for that branch only. This supersedes the earlier automatic-review block. Real member password login still requires owner confirmation in the deployed app.

## Account behavior

Mobile POST /api/mobile/session continues to invoke the existing marketplace login function internally. The same database account record, username/email lookup, bcrypt password hash, active/approved flags and password-set checks apply. A successful login updates the existing lastLogin field. No registration, password reset, entitlement change, migration, catalog action or payment route is enabled.

The isolated mobile deployment uses its own JWT signing secret and the host-only Secure/HttpOnly `__Host-smart-trust-mobile` session cookie. This permits the same credentials without sharing website/admin cookies or the production JWT signing key. Parent-domain auth-token cookies are ignored in this mode. Logout expires only the mobile cookie. The canonical website defaults to its original auth-token behavior when the mobile setting is absent.

The owner also authorized the website administrator credentials for app sign-in. The Administrator option uses the existing HTTPS https://troothhurtz.app/api/admin/login-edge endpoint, then independently verifies its issued admin cookie with /api/admin/check. No ADMIN_USERNAME, ADMIN_PASSWORD or production signing key is copied into the mobile project. There is no invented member ID or change to member approval rules.

The verified administrator token is held in the host-only Secure/HttpOnly __Host-smart-trust-mobile-admin cookie for at most 24 hours. Every administrator profile read is rechecked with the website authority; only the role and verified username are returned to the app. Passwords and tokens never appear in the client JSON, logs or device storage. Login uses an explicit account-type selection. Signing into one role clears the other mobile-role cookie; mobile logout clears both private cookies without changing website/admin cookies. Website workspace links may still require the website's own browser session.

SMART_TRUST_MOBILE_ADMIN_LOGIN=true enables this path only on the reviewed branch. Requests use fixed website URLs, no redirects, no caching, timeouts and bounded verifier JSON. User-supplied URLs cannot receive credentials or tokens. No administrator management/payment endpoints are exposed by the mobile package.

## Deployment boundary

- Separate Vercel project: smart-trust-mobile-preview.
- Custom address: https://mobile.troothhurtz.app/.
- Source branch: feat/mobile-shared-member-login-20261030.
- Preview-only DATABASE_URL is supplied from the existing hero-market account database configuration, scoped to this specific branch. This credential grants the app access to the live member database. Do not copy it to other previews or commit its value.
- SMART_TRUST_MOBILE_SESSION_COOKIE=__Host-smart-trust-mobile and SMART_TRUST_MOBILE_ENABLED=true.
- Retain the mobile project's independent JWT_SECRET. Do not copy ADMIN_PASSWORD, ADMIN_USERNAME, provider keys, the website signing key or AUTH_COOKIE_DOMAIN.
- Vercel protection stays enabled, including for the custom domain. No production promotion or change to the hero-market project is part of this operation.

## Validation and limits

The build runs the existing isolated-target runtime/source-parity checks plus an added real-Next-server cookie isolation test. Test subprocesses explicitly remove DATABASE_URL and auth configuration before applying test fixtures, so those tests cannot query real member records. They verify website/admin-cookie rejection, private mobile-token selection, admin-token rejection and host-only mobile logout.

A build and configuration copy alone do not prove a real member can log in. Verify a real connection through the deployed app, then have the owner enter their own existing member credentials. Do not extract member password hashes, reset a member password for testing, mint a member session to impersonate them, or copy production member data into a fixture database.

On this approved branch, SMART_TRUST_MOBILE_VERIFY_ACCOUNT_DB=true additionally gates deployment on a real database connection and a SELECT of required login/profile columns with WHERE 1 = 0. It returns zero member rows and performs no writes. Database errors are reduced to a non-sensitive error code; credentials and connection strings are never logged. The gate is in scripts/verify-member-database.mjs and runs after the isolated build/tests.
