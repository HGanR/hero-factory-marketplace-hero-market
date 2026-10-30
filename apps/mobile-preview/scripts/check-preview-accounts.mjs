#!/usr/bin/env node
/**
 * Target checks for the SMART TRUST Mobile protected Preview: account
 * matrix plus the three cases kept as SEPARATE tests — unknown user,
 * missing-user session, and expired token.
 *
 * Status: NOT RUN. Not executed against any deployment. Review before
 * first use. Based on the committed code at e26b3dd932fec6b627a5a675725047e381343957
 * (branch feat/smart-trust-mobile-preview-20261026). Reads only the inputs
 * names only — never passwords, hashes, or tokens.
 *
 * Account cases use a local credentials file (the JSON written by
 * seed-test-database.mjs --write-credentials-file). Token cases mint
 * test tokens in memory with the PREVIEW secret only
 * (PREVIEW_JWT_SECRET env var; HS256, same payload shape the login
 * issues: userId/email/username). If PREVIEW_JWT_SECRET is unset, the
 * token cases report SKIP, not failure.
 *
 * The mobile session route requires same-origin requests, so POST and
 * DELETE send Origin equal to the base URL and Sec-Fetch-Site:
 * same-origin (see src/lib/mobile/session-policy.ts).
 *
 * Usage (from apps/mobile-preview, after `npm ci`):
 *   PREVIEW_JWT_SECRET='<preview-only secret>' node scripts/check-preview-accounts.mjs \
 *     --base-url <preview-url> --credentials-file <path-outside-the-repo>
 * Exit code 0: every executed case passed (skips reported). Exit code 1:
 * any case failed.
 */

import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';

const GENERIC_FAILURE = 'Sign-in failed. Check your credentials and account approval.';

function fail(message, code = 2) {
  console.error(`check-preview-accounts: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { baseUrl: null, credentialsFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url') args.baseUrl = argv[++i];
    else if (argv[i] === '--credentials-file') args.credentialsFile = argv[++i];
    else fail(`unknown argument: ${argv[i]}\nUsage: node scripts/check-preview-accounts.mjs --base-url <url> --credentials-file <path>`);
  }
  if (!args.baseUrl) fail('--base-url is required.');
  if (!args.credentialsFile) fail('--credentials-file is required.');
  return args;
}

function cookieHeader(setCookieHeaders) {
  const cookies = [];
  for (const header of setCookieHeaders) {
    const pair = header.split(';')[0].trim();
    if (pair) cookies.push(pair);
  }
  return cookies.join('; ');
}

async function postSession(baseUrl, identifier, password) {
  const response = await fetch(`${baseUrl}/api/mobile/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Origin: baseUrl,
      'Sec-Fetch-Site': 'same-origin',
    },
    body: JSON.stringify({ identifier, password }),
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* non-JSON body: keep raw text for assertions */ }
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return { status: response.status, body, text, setCookie };
}

async function getProfile(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/mobile/session`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* keep raw text */ }
  return { status: response.status, body, text };
}

async function deleteSession(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/mobile/session`, {
    method: 'DELETE',
    headers: { Origin: baseUrl, 'Sec-Fetch-Site': 'same-origin', Cookie: cookie },
  });
  return { status: response.status };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl.replace(/\/$/, '');
  const credentials = JSON.parse(await readFile(args.credentialsFile, 'utf8'));
  const byUsername = new Map((credentials.accounts || []).map((a) => [a.username, a]));
  const need = ['preview-test-01', 'preview-test-02', 'preview-test-03', 'preview-test-04', 'preview-test-05'];
  for (const username of need) {
    if (!byUsername.has(username)) fail(`credentials file is missing account ${username}.`);
  }

  const results = [];
  const record = (name, outcome, detail = '') => {
    results.push({ name, outcome, detail });
    console.log(`${outcome.padEnd(4)} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const signIn = async (username, password) => postSession(baseUrl, username, password);

  // 1-2. Active/approved users sign in; switching between them works.
  let cookie1 = '';
  {
    const r = await signIn('preview-test-01', byUsername.get('preview-test-01').password);
    const cookie = cookieHeader(r.setCookie);
    const ok = r.status === 200 && cookie.includes('auth-token=');
    record('user-01 signs in', ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    if (ok) cookie1 = cookie;
  }
  {
    const r = await signIn('preview-test-02', byUsername.get('preview-test-02').password);
    const ok = r.status === 200 && cookieHeader(r.setCookie).includes('auth-token=');
    record('user-02 signs in (account switch)', ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  if (cookie1) {
    const p = await getProfile(baseUrl, cookie1);
    record('user-01 profile check', p.status === 200 && p.body?.user?.username === 'preview-test-01' ? 'PASS' : 'FAIL', `status=${p.status}`);
  }

  // 3-6. Refusal cases return the generic failure with the login's status.
  const refusals = [
    ['wrong password (user-01)', 'preview-test-01', 'definitely-not-the-password', 401],
    ['unapproved account (user-03)', 'preview-test-03', byUsername.get('preview-test-03').password, 403],
    ['inactive account (user-04)', 'preview-test-04', byUsername.get('preview-test-04').password, 403],
    ['no-password account (user-05)', 'preview-test-05', 'any-password', 403],
  ];
  for (const [name, username, password, expected] of refusals) {
    const r = await signIn(username, password);
    const generic = r.body?.error === GENERIC_FAILURE;
    record(name, r.status === expected && generic ? 'PASS' : 'FAIL', `status=${r.status} generic=${generic}`);
  }

  // 7. SEPARATE TEST: unknown user — no row exists.
  {
    const r = await signIn('preview-unknown@example.invalid', 'any-password');
    record('unknown user', r.status === 404 && r.body?.error === GENERIC_FAILURE ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // 8-9. SEPARATE TESTS: token cases need the preview secret; SKIP without it.
  const secret = process.env.PREVIEW_JWT_SECRET;
  if (!secret?.trim()) {
    record('missing-user session (valid token, no user row)', 'SKIP', 'PREVIEW_JWT_SECRET unset');
    record('expired token', 'SKIP', 'PREVIEW_JWT_SECRET unset');
  } else {
    const now = Math.floor(Date.now() / 1000);
    const missingUserToken = jwt.sign(
      { userId: 999999999, email: 'preview-missing@example.invalid', username: 'preview-missing', exp: now + 7 * 24 * 3600 },
      secret, { algorithm: 'HS256' },
    );
    const p = await getProfile(baseUrl, `auth-token=${missingUserToken}`);
    record('missing-user session (valid token, no user row)', p.status === 403 ? 'PASS' : 'FAIL', `status=${p.status}`);
    const expiredToken = jwt.sign(
      { userId: 1, email: 'preview-test-01@example.invalid', username: 'preview-test-01', exp: now - 3600 },
      secret, { algorithm: 'HS256' },
    );
    const q = await getProfile(baseUrl, `auth-token=${expiredToken}`);
    record('expired token', q.status === 401 && q.body?.error === 'Your session has expired. Please sign in again.' ? 'PASS' : 'FAIL', `status=${q.status}`);
  }

  // 10. Logout clears this browser's session.
  if (cookie1) {
    const d = await deleteSession(baseUrl, cookie1);
    const p = await getProfile(baseUrl, cookie1);
    record('logout then profile check', d.status === 200 && p.status === 401 ? 'PASS' : 'FAIL', `delete=${d.status} profile=${p.status}`);
  }

  const failed = results.filter((r) => r.outcome === 'FAIL').length;
  const skipped = results.filter((r) => r.outcome === 'SKIP').length;
  console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`check-preview-accounts: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
