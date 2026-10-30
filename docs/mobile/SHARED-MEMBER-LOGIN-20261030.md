# Mobile access to existing website member credentials

The owner explicitly authorized connecting mobile to the existing website account source on October 30, 2026. This changes the earlier isolated-database-only preview boundary for the reviewed mobile login branch, not for arbitrary previews.

## Account behavior

Mobile POST /api/mobile/session continues to invoke the existing marketplace login function internally. The same database account record, username/email lookup, bcrypt password hash, active/approved flags and password-set checks apply. A successful login updates the existing lastLogin field. No registration, password reset, entitlement change, migration, catalog action or payment route is enabled.

The isolated mobile deployment uses its own JWT signing secret and the host-only Secure/HttpOnly `__Host-smart-trust-mobile` session cookie. This permits the same credentials without sharing website/admin cookies or the production JWT signing key. Parent-domain auth-token cookies are ignored in this mode. Logout expires only the mobile cookie. The canonical website defaults to its original auth-token behavior when the mobile setting is absent.

Admin-only credentials are not turned into member credentials. An administrator needs an existing active, approved marketplace member record with a password to use this member surface. Admin JWTs and admin-only sessions remain rejected.

## Deployment boundary

- Separate Vercel project: smart-trust-mobile-preview.
- Custom address: https://mobile.troothhurtz.app/.
- Source branch: feat/mobile-shared-member-login-20261030.
- Preview-only DATABASE_URL is supplied from the existing hero-market account database configuration and scoped to this specific branch. Do not copy it to other previews or commit its value.
- SMART_TRUST_MOBILE_SESSION_COOKIE=__Host-smart-trust-mobile and SMART_TRUST_MOBILE_ENABLED=true.
- Retain the mobile project's independent JWT_SECRET. Do not copy ADMIN_PASSWORD, ADMIN_USERNAME, provider keys, the website signing key or AUTH_COOKIE_DOMAIN.
- Vercel protection stays enabled, including for the custom domain. No production promotion or change to the hero-market project is part of this operation.

## Validation and limits

The build runs the existing isolated-target runtime/source-parity checks plus an added real-Next-server cookie isolation test. Test subprocesses explicitly remove DATABASE_URL and auth configuration before applying test fixtures, so those tests cannot query real member records. They verify website/admin-cookie rejection, private mobile-token selection, admin-token rejection and host-only mobile logout.

A build and configuration copy alone do not prove a real member can log in. Verify a real connection through the deployed app, then have the owner enter their own existing member credentials. Do not extract member password hashes, reset a member password for testing, mint a member session to impersonate them, or copy production member data into a fixture database.
