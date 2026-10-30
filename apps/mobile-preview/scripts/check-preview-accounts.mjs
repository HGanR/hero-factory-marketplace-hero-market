#!/usr/bin/env node
/**
 * Target checks for the SMART TRUST Mobile protected Preview: account
 * matrix plus the three cases kept as SEPARATE tests — unknown user,
 * missing-user session, and expired token.
 *
 * Status: NOT RUN against any deployment. Review before first use.
 * Based on the committed code at e26b3dd932fec6b627a5a675725047e381343957
 * (branch feat/smart-trust-mobile-preview-20261026).
 * Prints statuses and case names only — never passwords, hashes,
 * tokens, or the protection-bypass secret.
 *
 * Target safety (all enforced BEFORE any password or token is sent):
 * - --base-url and --confirmed-origin are both required, and the base
 *   URL's origin must equal the explicitly confirmed HTTPS preview
 *   origin exactly. URLs containing credentials, and any redirect
 *   response, are refused (fetch runs with redirect: 'manual' and a
 *   3xx outcome fails the case without following it).
 * - Deployment Protection is NOT disabled: when PREVIEW_PROTECTION_BYPASS
 *   is set (the bypass secret from the Vercel project's Deployment
 *   Protection settings, for automation), it is sent as the
 *   x-vercel-protection-bypass header. Without it, a protected URL
 *   answers the Vercel auth challenge and the cases fail distinctly.
 * - A shared cookie jar models the browser: sign-ins overwrite the
 *   auth-token cookie, the profile check reads whatever the jar holds,
 *   and logout is verified by processing the clearing Set-Cookie
 *   (empty value, Max-Age=0) and requesting the profile with the jar
 *   now empty. The JWT itself is NOT revoked server-side, so re-sending
 *   the old cookie after logout would wrongly expect 401 and is never
 *   done here.
 * - The missing-user case requires --missing-user-id: an id the
 *   operator has established as unused in the test database (the seed
 *   script prints the seeded ids). It must differ from every id
 *   observed in the run; a wrong guess fails loudly instead of
 *   passing. Test tokens are minted in memory with node:crypto HMAC
 *   (HS256, same payload shape the login issues) using
 *   PREVIEW_JWT_SECRET; without it the token cases report SKIP.
 *
 * Usage (from apps/mobile-preview, after `npm ci`):
 *   PREVIEW_JWT_SECRET='<preview-only secret>' \
 *   PREVIEW_PROTECTION_BYPASS='<Vercel protection bypass secret>' \
 *   node scripts/check-preview-accounts.mjs \
 *     --base-url <preview-url> --confirmed-origin <preview-origin> \
 *     --credentials-file <path-outside-the-repo> \
 *     [--missing-user-id <id>] [--allow-insecure-loopback]
 * Exit code 0: every executed case passed (skips reported). Exit code 1:
 * any case failed. --allow-insecure-loopback permits http only for
 * loopback hosts, for local test harnesses only — never for a real
 * preview.
 */

import { readFile } from 'node:fs/promises';
import {
  CookieJar,
  mintTestToken,
  validateCheckerTarget,
  validateMissingUserId,
} from './preview-test-helpers.mjs';

const GENERIC_FAILURE = 'Sign-in failed. Check your credentials and account approval.';
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

function fail(message, code = 2) {
  console.error(`check-preview-accounts: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { baseUrl: null, confirmedOrigin: null, credentialsFile: null, missingUserId: null, allowInsecureLoopback: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url') args.baseUrl = argv[++i];
    else if (argv[i] === '--confirmed-origin') args.confirmedOrigin = argv[++i];
    else if (argv[i] === '--credentials-file') args.credentialsFile = argv[++i];
    else if (argv[i] === '--missing-user-id') args.missingUserId = argv[++i];
    else if (argv[i] === '--allow-insecure-loopback') args.allowInsecureLoopback = true;
    else fail(`unknown argument: ${argv[i]}\nUsage: node scripts/check-preview-accounts.mjs --base-url <url> --confirmed-origin <origin> --credentials-file <path> [--missing-user-id <id>] [--allow-insecure-loopback]`);
  }
  if (!args.baseUrl) fail('--base-url is required.');
  if (!args.confirmedOrigin) fail('--confirmed-origin is required.');
  if (!args.credentialsFile) fail('--credentials-file is required.');
  return args;
}

function setCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

async function readJson(response) {
  const text = await response.text();
  try {
    return { body: JSON.parse(text), text };
  } catch {
    return { body: null, text };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Origin confirmation happens before any credential or token is sent.
  let origin;
  try {
    origin = validateCheckerTarget(args.baseUrl, args.confirmedOrigin, { allowInsecureLoopback: args.allowInsecureLoopback });
  } catch (error) {
    fail(error.message, 3);
  }

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

  const jar = new CookieJar();
  const observedIds = [];
  const bypass = process.env.PREVIEW_PROTECTION_BYPASS;

  async function request(pathname, { method = 'GET', json = null, useJar = true, cookieOverride = null } = {}) {
    const headers = {};
    if (json !== null) headers['content-type'] = 'application/json';
    if (useJar && jar.header()) headers.Cookie = jar.header();
    if (cookieOverride !== null) headers.Cookie = cookieOverride;
    if (method === 'POST' || method === 'DELETE') {
      headers.Origin = origin;
      headers['Sec-Fetch-Site'] = 'same-origin';
    }
    if (bypass?.trim()) headers['x-vercel-protection-bypass'] = bypass.trim();
    const response = await fetch(`${origin}${pathname}`, {
      method,
      headers,
      body: json !== null ? JSON.stringify(json) : undefined,
      redirect: 'manual',
    });
    if (useJar) jar.storeSetCookie(setCookieHeaders(response));
    const { body, text } = await readJson(response);
    if (response.status >= 300 && response.status < 400) {
      return { status: response.status, body, text, redirected: true };
    }
    return { status: response.status, body, text, redirected: false };
  }

  async function signIn(username, password, useJar = true) {
    return request('/api/mobile/session', { method: 'POST', json: { identifier: username, password }, useJar });
  }

  async function getProfile(useJar = true, cookieOverride = null) {
    return request('/api/mobile/session', { useJar, cookieOverride });
  }

  // Switching sequence on the SHARED jar: 01 -> 02 -> 01, with the
  // profile check confirming the jar's session at each step.
  let signedIn = false;
  {
    const r = await signIn('preview-test-01', byUsername.get('preview-test-01').password);
    const ok = r.status === 200 && jar.has('auth-token') && !r.redirected;
    record('user-01 signs in', ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    signedIn = ok;
  }
  if (signedIn) {
    const p = await getProfile();
    const ok = p.status === 200 && p.body?.user?.username === 'preview-test-01';
    record('profile is user-01', ok ? 'PASS' : 'FAIL', `status=${p.status}`);
    if (ok && typeof p.body.user.id === 'number') observedIds.push(p.body.user.id);
  }
  {
    const r = await signIn('preview-test-02', byUsername.get('preview-test-02').password);
    const ok = r.status === 200 && jar.has('auth-token') && !r.redirected;
    record('user-02 signs in (switch)', ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  {
    const p = await getProfile();
    const ok = p.status === 200 && p.body?.user?.username === 'preview-test-02';
    record('profile changed to user-02', ok ? 'PASS' : 'FAIL', `status=${p.status}`);
    if (ok && typeof p.body.user.id === 'number') observedIds.push(p.body.user.id);
  }
  {
    const r = await signIn('preview-test-01', byUsername.get('preview-test-01').password);
    const ok = r.status === 200 && !r.redirected;
    record('user-01 signs in again (switch back)', ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  {
    const p = await getProfile();
    const ok = p.status === 200 && p.body?.user?.username === 'preview-test-01';
    record('profile changed back to user-01', ok ? 'PASS' : 'FAIL', `status=${p.status}`);
  }

  // Refusal cases on the shared jar: failed sign-ins set no cookie, so
  // the jar must still hold user-01's session afterwards.
  const refusals = [
    ['wrong password (user-01)', 'preview-test-01', 'definitely-not-the-password', 401],
    ['unapproved account (user-03)', 'preview-test-03', byUsername.get('preview-test-03').password, 403],
    ['inactive account (user-04)', 'preview-test-04', byUsername.get('preview-test-04').password, 403],
    ['no-password account (user-05)', 'preview-test-05', 'any-password', 403],
  ];
  for (const [name, username, password, expected] of refusals) {
    const r = await signIn(username, password);
    const generic = r.body?.error === GENERIC_FAILURE;
    record(name, r.status === expected && generic && !r.redirected ? 'PASS' : 'FAIL', `status=${r.status} generic=${generic}`);
  }
  {
    const p = await getProfile();
    record('session still user-01 after refusals', p.status === 200 && p.body?.user?.username === 'preview-test-01' ? 'PASS' : 'FAIL', `status=${p.status}`);
  }

  // SEPARATE TEST: unknown user — no row exists.
  {
    const r = await signIn('preview-unknown@example.invalid', 'any-password', false);
    record('unknown user', r.status === 404 && r.body?.error === GENERIC_FAILURE && !r.redirected ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // SEPARATE TESTS: token cases need the preview secret; SKIP without it.
  const secret = process.env.PREVIEW_JWT_SECRET;
  if (!secret?.trim()) {
    record('missing-user session (valid token, no user row)', 'SKIP', 'PREVIEW_JWT_SECRET unset');
    record('expired token', 'SKIP', 'PREVIEW_JWT_SECRET unset');
  } else {
    if (args.missingUserId === null) {
      record('missing-user session (valid token, no user row)', 'SKIP', '--missing-user-id not given; establish an unused id first');
    } else {
      let missingId;
      try {
        missingId = validateMissingUserId(args.missingUserId, observedIds);
      } catch (error) {
        fail(error.message, 3);
      }
      const token = mintTestToken(secret.trim(), { userId: missingId, email: 'preview-missing@example.invalid', username: 'preview-missing' }, 7 * 24 * 3600);
      const p = await getProfile(false, `auth-token=${token}`);
      record('missing-user session (valid token, no user row)', p.status === 403 && !p.redirected ? 'PASS' : 'FAIL', `status=${p.status}`);
    }
    const expired = mintTestToken(secret.trim(), { userId: observedIds[0] ?? 1, email: 'preview-test-01@example.invalid', username: 'preview-test-01' }, -3600);
    const q = await getProfile(false, `auth-token=${expired}`);
    record('expired token', q.status === 401 && q.body?.error === SESSION_EXPIRED && !q.redirected ? 'PASS' : 'FAIL', `status=${q.status}`);
  }

  // Logout: process the clearing Set-Cookie, confirm the jar no longer
  // holds auth-token, then request the profile with the empty jar.
  // The old JWT is never re-sent: it is not revoked server-side.
  {
    const d = await request('/api/mobile/session', { method: 'DELETE' });
    const cleared = d.status === 200 && !jar.has('auth-token');
    record('logout clears the cookie', cleared ? 'PASS' : 'FAIL', `status=${d.status} jarHasAuthToken=${jar.has('auth-token')}`);
    const p = await getProfile();
    record('profile after logout (no cookie sent)', p.status === 401 && !p.redirected ? 'PASS' : 'FAIL', `status=${p.status}`);
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
