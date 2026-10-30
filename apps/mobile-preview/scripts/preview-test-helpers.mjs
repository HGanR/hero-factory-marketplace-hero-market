/**
 * Pure, dependency-free helpers for the preview test-database scripts.
 * No third-party imports, no I/O except where a caller passes values in,
 * so every decision below is unit-testable without a database, a
 * network, or installed packages.
 *
 * Sources (branch feat/smart-trust-mobile-preview-20261026 at
 * e26b3dd932fec6b627a5a675725047e381343957):
 * - Cookie handling mirrors the browser contract of
 *   src/app/api/mobile/session/route.ts (HttpOnly auth-token cookie,
 *   cleared on DELETE with an empty value and Max-Age=0).
 * - Origin rules mirror src/lib/mobile/session-policy.ts (same-origin).
 * - TLS host rules mirror src/lib/db/mysql2-connection-options.ts.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

// ---------------------------------------------------------------- cookies

export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  /** Store Set-Cookie headers. A clearing cookie (empty value with
   * Max-Age=0 or a past Expires) removes the cookie instead of setting
   * it — this is how logout works: the JWT itself is NOT revoked, the
   * browser simply no longer sends it. */
  storeSetCookie(headers) {
    for (const header of headers) {
      const parts = header.split(';').map((s) => s.trim());
      const eq = parts[0].indexOf('=');
      if (eq < 0) continue;
      const name = parts[0].slice(0, eq).trim();
      const value = parts[0].slice(eq + 1);
      const attrs = new Map();
      for (const attr of parts.slice(1)) {
        const i = attr.indexOf('=');
        attrs.set(i < 0 ? attr.toLowerCase() : attr.slice(0, i).trim().toLowerCase(), i < 0 ? '' : attr.slice(i + 1).trim());
      }
      const maxAge = attrs.get('max-age');
      const expires = attrs.get('expires');
      const cleared =
        value === '' &&
        (maxAge === '0' || (expires !== undefined && Number.isFinite(Date.parse(expires)) && Date.parse(expires) < Date.now()));
      if (cleared) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  has(name) {
    return this.cookies.has(name);
  }

  names() {
    return [...this.cookies.keys()];
  }
}

// ------------------------------------------------------- checker targeting

export function validateCheckerTarget(baseUrl, confirmedOrigin, { allowInsecureLoopback = false } = {}) {
  if (!baseUrl) throw new Error('--base-url is required.');
  if (!confirmedOrigin) throw new Error('--confirmed-origin is required: the explicitly confirmed HTTPS preview origin.');
  let base;
  let confirmed;
  try {
    base = new URL(baseUrl);
    confirmed = new URL(confirmedOrigin);
  } catch {
    throw new Error('Target URLs must parse as URLs.');
  }
  for (const [label, u] of [['--base-url', base], ['--confirmed-origin', confirmed]]) {
    if (u.username || u.password) throw new Error(`${label} must not contain URL credentials.`);
  }
  if (base.pathname !== '/' && base.pathname !== '') throw new Error('--base-url must not contain a path.');
  if (base.search || base.hash) throw new Error('--base-url must not contain a query or fragment.');
  if (base.origin !== confirmed.origin) {
    throw new Error(`Refusing target: base origin ${base.origin} does not match confirmed origin ${confirmed.origin}.`);
  }
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(base.hostname.toLowerCase());
  if (base.protocol !== 'https:') {
    if (!(allowInsecureLoopback && loopback && base.protocol === 'http:')) {
      throw new Error('Refusing target: only HTTPS origins are allowed (loopback http only with --allow-insecure-loopback).');
    }
  }
  return base.origin;
}

// ---------------------------------------------------------- seed targeting

/** Parse a MySQL URL without connecting. `sslEnv` is the value of
 * TEST_DATABASE_SSL (or equivalent) passed in by the caller. */
export function parseSeedTarget(rawUrl, sslEnv) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) throw new Error('Database URL is empty.');
  let u;
  try {
    u = new URL(trimmed.includes('://') ? trimmed : `mysql://${trimmed}`);
  } catch {
    throw new Error('Database URL must parse as a URL.');
  }
  if (!u.hostname) throw new Error('Database URL must include a host.');
  const database = u.pathname.replace(/^\//, '').split('?')[0] || '';
  const forceSsl =
    sslEnv === '1' || sslEnv === 'true' || sslEnv === 'required' ||
    /tidbcloud/i.test(trimmed) || /\.tidb\.io/i.test(trimmed);
  return {
    host: u.hostname.toLowerCase(),
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ''),
    database,
    forceSsl,
  };
}

/** Exact-match confirmation: the parsed target must equal the
 * explicitly confirmed host and database. Substring rules (e.g.
 * "reject names containing prod") are NOT sufficient — the production
 * database name itself would pass them. */
export function confirmSeedTarget(parsed, confirmedHost, confirmedDatabase) {
  if (!confirmedHost) throw new Error('--confirmed-host is required: the explicitly confirmed test database host.');
  if (!confirmedDatabase) throw new Error('--confirmed-database is required: the explicitly confirmed test database name.');
  const [hostPart, portPart] = String(confirmedHost).split(':');
  const wantHost = hostPart.toLowerCase();
  const wantPort = portPart ? Number(portPart) : 3306;
  if (parsed.host !== wantHost || parsed.port !== wantPort) {
    throw new Error(`Refusing target: host ${parsed.host}:${parsed.port} does not match confirmed host ${wantHost}:${wantPort}.`);
  }
  if (!parsed.database) throw new Error('Refusing target: the database URL contains no database name.');
  if (parsed.database !== confirmedDatabase) {
    throw new Error(`Refusing target: database "${parsed.database}" does not match confirmed database "${confirmedDatabase}".`);
  }
}

export function grantsLookDangerous(grantsText) {
  const text = String(grantsText || '').toUpperCase();
  if (/\bALL PRIVILEGES\b/.test(text)) return true;
  if (/\bGRANT OPTION\b/.test(text)) return true;
  if (/\sON\s+\*\.\*/.test(text)) return true;
  if (/\b(FILE|SUPER|SHUTDOWN|RELOAD|DROP|CREATE USER)\b/.test(text)) return true;
  return false;
}

export function diffColumns(present, expected) {
  const presentSet = new Set(present);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((c) => !presentSet.has(c)),
    extra: present.filter((c) => !expectedSet.has(c)),
  };
}

// ------------------------------------------------------- credentials file

/** Resolve a credentials-file path and report whether it lies inside
 * the repository (scriptDir is .../apps/mobile-preview/scripts). */
export function credentialsPathInfo(fileArg, scriptDir) {
  const resolved = path.resolve(fileArg);
  const repoRoot = path.resolve(scriptDir, '..', '..', '..');
  const insideRepo = resolved === repoRoot || resolved.startsWith(repoRoot + path.sep);
  return { resolved, repoRoot, insideRepo };
}

/** Render credentials for output. In file mode the passwords are NEVER
 * printed — they live only in the file. */
export function formatCredentialsOutput(credentials, { toFile }) {
  const lines = [];
  for (const c of credentials) {
    if (toFile) lines.push(`  ${c.username} <${c.email}>  password: (written to file — not shown)`);
    else lines.push(`  ${c.username} <${c.email}>  password: ${c.password ?? '(none — no-password account)'}`);
  }
  return lines.join('\n');
}

export function generateTestPassword() {
  return randomBytes(18).toString('base64url');
}

// ------------------------------------------------------------- test tokens

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signHS256(secret, header, payload) {
  return base64url(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
}

/** Mint an HS256 test token with the same payload shape the login
 * issues (userId/email/username + exp). Pure HMAC via node:crypto —
 * no third-party JWT library needed for minting test tokens. */
export function mintTestToken(secret, { userId, email, username }, expiresInSeconds) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    userId, email, username,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }));
  return `${header}.${payload}.${signHS256(secret, header, payload)}`;
}

/** Verify an HS256 test token (signature + expiry). Used by tests and
 * test harnesses only — never by the application. */
export function verifyTestToken(secret, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token.');
  const [header, payload, signature] = parts;
  const expected = signHS256(secret, header, payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Bad token signature.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (typeof decoded.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired.');
  return decoded;
}

/** A missing-user id must be a positive safe integer, established by
 * the operator (not guessed), and different from every id observed in
 * the run. A wrong guess fails the test loudly instead of passing. */
export function validateMissingUserId(value, observedIds) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('--missing-user-id must be a positive integer.');
  if ((observedIds || []).includes(n)) throw new Error(`--missing-user-id ${n} was observed as a real user id in this run; pick an id established as unused.`);
  return n;
}
