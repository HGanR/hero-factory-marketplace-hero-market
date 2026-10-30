/**
 * Executable regression tests for the preview test-database scripts.
 *
 * Run from apps/mobile-preview with NO build and NO database:
 *   node --test tests/preview-guards.test.mjs
 *
 * Covers: cookie-jar semantics (logout clears, JWT not revoked),
 * account switching on a shared jar, credential-file output rules,
 * checker target validation (confirmed HTTPS origin, no URL
 * credentials, no redirects), seed target confirmation, and ZERO
 * network/database activity on rejected targets (proved with local
 * counting servers). Positive database paths are NOT covered here —
 * no MySQL server is available in this environment, and the scripts
 * must not be executed against a real database until reviewed.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CookieJar,
  confirmSeedTarget,
  diffColumns,
  formatCredentialsOutput,
  grantsLookDangerous,
  mintTestToken,
  parseSeedTarget,
  resolveCredentialsDestination,
  unexpectedRowsMessage,
  validateCheckerTarget,
  validateMissingUserId,
  verifyTestToken,
} from '../scripts/preview-test-helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_SCRIPT = path.join(HERE, '..', 'scripts', 'seed-test-database.mjs');
const CHECK_SCRIPT = path.join(HERE, '..', 'scripts', 'check-preview-accounts.mjs');
const VERIFY_SCRIPT = path.join(HERE, '..', 'scripts', 'verify-missing-user-id.mjs');
const FIXTURE_SECRET = 'preview-guards-test-secret';
const GENERIC_FAILURE = 'Sign-in failed. Check your credentials and account approval.';
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

function runCli(script, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// ------------------------------------------------------------ CookieJar

test('CookieJar: set, overwrite, and clearing cookies', () => {
  const jar = new CookieJar();
  jar.storeSetCookie(['auth-token=aaa; Path=/; HttpOnly; Max-Age=604800']);
  assert.equal(jar.header(), 'auth-token=aaa');
  // Re-login overwrites the single auth-token (account switching).
  jar.storeSetCookie(['auth-token=bbb; Path=/; HttpOnly; Max-Age=604800']);
  assert.equal(jar.header(), 'auth-token=bbb');
  assert.deepEqual(jar.names(), ['auth-token']);
  // Logout clearing cookie removes it.
  jar.storeSetCookie(['auth-token=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
  assert.equal(jar.has('auth-token'), false);
  assert.equal(jar.header(), '');
});

test('CookieJar: past Expires also clears', () => {
  const jar = new CookieJar();
  jar.storeSetCookie(['auth-token=aaa; Path=/']);
  jar.storeSetCookie(['auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
  assert.equal(jar.has('auth-token'), false);
});

// ------------------------------------------------- checker target rules

test('validateCheckerTarget: exact HTTPS match accepted', () => {
  assert.equal(
    validateCheckerTarget('https://preview-abc123.vercel.app', 'https://preview-abc123.vercel.app'),
    'https://preview-abc123.vercel.app',
  );
});

test('validateCheckerTarget: rejects http, credentials, mismatch, path', () => {
  assert.throws(() => validateCheckerTarget('http://preview.example.com', 'http://preview.example.com'), /only HTTPS/);
  assert.throws(() => validateCheckerTarget('https://user:pass@preview.example.com', 'https://preview.example.com'), /credentials/);
  assert.throws(() => validateCheckerTarget('https://other.example.com', 'https://preview.example.com'), /does not match/);
  assert.throws(() => validateCheckerTarget('https://preview.example.com/mobile', 'https://preview.example.com'), /must not contain a path/);
  assert.throws(() => validateCheckerTarget('https://preview.example.com?x=1', 'https://preview.example.com'), /query/);
  assert.throws(() => validateCheckerTarget('https://preview.example.com', ''), /confirmed-origin is required/);
});

test('validateCheckerTarget: loopback http only with the explicit flag', () => {
  assert.throws(() => validateCheckerTarget('http://127.0.0.1:3000', 'http://127.0.0.1:3000'), /only HTTPS/);
  assert.equal(
    validateCheckerTarget('http://127.0.0.1:3000', 'http://127.0.0.1:3000', { allowInsecureLoopback: true }),
    'http://127.0.0.1:3000',
  );
});

// ---------------------------------------------------- seed target rules

test('parseSeedTarget: host, database, and TLS decisions', () => {
  const tidb = parseSeedTarget('mysql://u:p@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/testdb', '');
  assert.equal(tidb.host, 'gateway01.us-east-1.prod.aws.tidbcloud.com');
  assert.equal(tidb.port, 4000);
  assert.equal(tidb.database, 'testdb');
  assert.equal(tidb.forceSsl, true);
  const plain = parseSeedTarget('mysql://u:p@db.internal:3306/testdb', '');
  assert.equal(plain.forceSsl, false);
  const forced = parseSeedTarget('mysql://u:p@db.internal:3306/testdb', 'required');
  assert.equal(forced.forceSsl, true);
});

test('confirmSeedTarget: exact match required, substring rules rejected', () => {
  const parsed = parseSeedTarget('mysql://u:p@127.0.0.1:3306/hero-market-test', '');
  // The production-looking name "hero-market" must NOT pass by itself:
  // only the explicitly confirmed database passes.
  assert.throws(() => confirmSeedTarget(parsed, '127.0.0.1', 'hero-market'), /does not match/);
  assert.throws(() => confirmSeedTarget({ ...parsed, host: 'other.internal' }, '127.0.0.1', 'hero-market-test'), /does not match/);
  assert.throws(() => confirmSeedTarget(parsed, '', 'hero-market-test'), /confirmed-host is required/);
  // The exact confirmed host + database passes.
  confirmSeedTarget(parsed, '127.0.0.1', 'hero-market-test');
});

test('grantsLookDangerous: USAGE is not a privilege; global scope is', () => {
  // Charles's reproduction: USAGE ON *.* must NOT be dangerous.
  assert.equal(grantsLookDangerous("GRANT USAGE ON *.* TO 'u'@'%'"), false);
  assert.equal(grantsLookDangerous("GRANT USAGE ON *.* TO 'u'@'%'\nGRANT SELECT, INSERT, DELETE ON `testdb`.* TO 'u'@'%'"), false);
  // Any other privilege on the global scope IS dangerous.
  assert.equal(grantsLookDangerous("GRANT SELECT ON *.* TO 'u'@'%'"), true);
  assert.equal(grantsLookDangerous("GRANT ALL PRIVILEGES ON `testdb`.* TO 'u'@'%'"), true);
  assert.equal(grantsLookDangerous("GRANT SELECT ON `testdb`.* TO 'u'@'%' WITH GRANT OPTION"), true);
  assert.equal(grantsLookDangerous("GRANT FILE ON *.* TO 'u'@'%'"), true);
  assert.equal(grantsLookDangerous("GRANT DROP ON `testdb`.* TO 'u'@'%'"), true);
  // Restricted test credential: fine.
  assert.equal(grantsLookDangerous("GRANT SELECT, INSERT, DELETE ON `testdb`.`marketplace_users` TO 'u'@'%'"), false);
  // Role grants carry no privileges.
  assert.equal(grantsLookDangerous("GRANT `app_read` TO 'u'@'%'"), false);
  assert.equal(grantsLookDangerous(''), false);
});

test('diffColumns: missing refused, extras warned', () => {
  const d = diffColumns(['id', 'email'], ['id', 'email', 'passwordHash']);
  assert.deepEqual(d.missing, ['passwordHash']);
  assert.deepEqual(d.extra, []);
  const d2 = diffColumns(['id', 'email', 'zzz'], ['id', 'email']);
  assert.deepEqual(d2.extra, ['zzz']);
});

// ------------------------------------------------------- credentials file

test('resolveCredentialsDestination: symlinks resolved, inside-repo flagged, existing flagged', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-dest-'));
  try {
    const realRepo = path.join(dir, 'repo');
    const scriptDir = path.join(realRepo, 'apps', 'mobile-preview', 'scripts');
    await mkdir(scriptDir, { recursive: true });
    const outside = path.join(dir, 'outside');
    await mkdir(outside);
    await symlink(realRepo, path.join(dir, 'link-in'));
    const inside = await resolveCredentialsDestination(path.join(dir, 'link-in', 'creds.json'), scriptDir);
    assert.equal(inside.insideRepo, true);
    assert.equal(inside.exists, false);
    await symlink(outside, path.join(dir, 'link-out'));
    const out = await resolveCredentialsDestination(path.join(dir, 'link-out', 'creds.json'), scriptDir);
    assert.equal(out.insideRepo, false);
    assert.equal(out.exists, false);
    // A dangling symlink at the destination itself counts as existing.
    await symlink(path.join(dir, 'nope-target'), path.join(outside, 'dangling.json'));
    const dangling = await resolveCredentialsDestination(path.join(outside, 'dangling.json'), scriptDir);
    assert.equal(dangling.exists, true);
    // Missing parent directory is an error, not a silent default.
    await assert.rejects(() => resolveCredentialsDestination(path.join(dir, 'no-such-dir', 'creds.json'), scriptDir), /parent directory does not exist/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('unexpectedRowsMessage: count only, never row contents', () => {
  const msg = unexpectedRowsMessage(3);
  assert.match(msg, /3 existing account/);
  assert.equal(msg.includes('@'), false);
});

test('formatCredentialsOutput: file mode never prints passwords', () => {
  const creds = [{ email: 'a@example.invalid', username: 'a', password: 'super-secret-pw' }];
  const fileOut = formatCredentialsOutput(creds, { toFile: true });
  assert.equal(fileOut.includes('super-secret-pw'), false);
  const stdoutOut = formatCredentialsOutput(creds, { toFile: false });
  assert.equal(stdoutOut.includes('super-secret-pw'), true);
});

// ------------------------------------------------------------ token tools

test('mint/verify test tokens: round-trip, tamper, expiry', () => {
  const token = mintTestToken(FIXTURE_SECRET, { userId: 7, email: 'a@example.invalid', username: 'a' }, 3600);
  const payload = verifyTestToken(FIXTURE_SECRET, token);
  assert.equal(payload.userId, 7);
  assert.throws(() => verifyTestToken(FIXTURE_SECRET, `${token}x`), /signature|Malformed/);
  const expired = mintTestToken(FIXTURE_SECRET, { userId: 7, email: 'a@example.invalid', username: 'a' }, -3600);
  assert.throws(() => verifyTestToken(FIXTURE_SECRET, expired), /expired/);
});

test('validateMissingUserId: positive, established, unobserved', () => {
  assert.throws(() => validateMissingUserId('abc', []), /positive integer/);
  assert.throws(() => validateMissingUserId(0, []), /positive integer/);
  assert.throws(() => validateMissingUserId(2, [1, 2]), /observed as a real user/);
  assert.equal(validateMissingUserId('999999999', [1, 2]), 999999999);
});

// ------------------------------------------- zero activity: seed CLI

async function countingTcpServer() {
  let connections = 0;
  const server = net.createServer(() => { connections += 1; });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port, count: () => connections };
}

test('seed CLI: rejected targets cause zero database activity', async () => {
  const { server, port, count } = await countingTcpServer();
  try {
    const url = `mysql://tester:pw@127.0.0.1:${port}/testdb`;
    // Mismatched confirmed database.
    let r = await runCli(SEED_SCRIPT, ['--apply', '--confirmed-host', `127.0.0.1:${port}`, '--confirmed-database', 'wrongdb'], { TEST_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /does not match/);
    // Missing confirmation.
    r = await runCli(SEED_SCRIPT, ['--apply', '--confirmed-database', 'testdb'], { TEST_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /confirmed-host is required/);
    // Credentials file inside the repository.
    const repoRoot = path.resolve(HERE, '..', '..', '..');
    r = await runCli(SEED_SCRIPT, ['--apply', '--confirmed-host', `127.0.0.1:${port}`, '--confirmed-database', 'testdb', '--write-credentials-file', path.join(repoRoot, '__guard_test_creds.json')], { TEST_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /inside the repository/);
    assert.equal(count(), 0, 'rejected seed targets must open zero connections');
  } finally {
    server.close();
  }
});

test('seed CLI: existing or symlinked-inside credentials file refused with zero activity', async () => {
  const { server, port, count } = await countingTcpServer();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-creds-'));
  try {
    const url = `mysql://tester:pw@127.0.0.1:${port}/testdb`;
    const baseArgs = ['--apply', '--confirmed-host', `127.0.0.1:${port}`, '--confirmed-database', 'testdb'];
    // Pre-existing file: refused, contents untouched, zero connections.
    const existing = path.join(dir, 'creds.json');
    await writeFile(existing, 'sentinel');
    let r = await runCli(SEED_SCRIPT, [...baseArgs, '--write-credentials-file', existing], { TEST_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /already exists/);
    assert.equal(await readFile(existing, 'utf8'), 'sentinel');
    // Symlinked directory resolving inside the repository: refused.
    const repoRoot = path.resolve(HERE, '..', '..', '..');
    await symlink(repoRoot, path.join(dir, 'link-in'));
    r = await runCli(SEED_SCRIPT, [...baseArgs, '--write-credentials-file', path.join(dir, 'link-in', '__guard_test_creds.json')], { TEST_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /inside the repository/);
    assert.equal(count(), 0, 'refused seed targets must open zero connections');
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('verifier CLI: rejected targets cause zero database activity', async () => {
  const { server, port, count } = await countingTcpServer();
  try {
    const url = `mysql://reader:pw@127.0.0.1:${port}/testdb`;
    let r = await runCli(VERIFY_SCRIPT, ['--user-id', '999999999', '--confirmed-host', `127.0.0.1:${port}`, '--confirmed-database', 'wrongdb'], { TEST_READONLY_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /does not match/);
    r = await runCli(VERIFY_SCRIPT, ['--user-id', '999999999', '--confirmed-host', `127.0.0.1:${port}`, '--confirmed-database', 'testdb'], {});
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /TEST_READONLY_DATABASE_URL is not set/);
    r = await runCli(VERIFY_SCRIPT, ['--user-id', 'not-a-number', '--confirmed-host', `127.0.0.1:${port}`, '--confirmed-database', 'testdb'], { TEST_READONLY_DATABASE_URL: url });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /positive integer/);
    assert.equal(count(), 0, 'rejected verifier targets must open zero connections');
  } finally {
    server.close();
  }
});

test('seed CLI: dry run connects to nothing', async () => {
  const { server, port, count } = await countingTcpServer();
  try {
    const r = await runCli(SEED_SCRIPT, [], { TEST_DATABASE_URL: `mysql://tester:pw@127.0.0.1:${port}/testdb` });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /Dry run/);
    assert.equal(count(), 0);
  } finally {
    server.close();
  }
});

// ---------------------------------------- zero activity: checker CLI

async function countingHttpServer() {
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests += 1;
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port, count: () => requests };
}

test('checker CLI: rejected targets cause zero network activity', async () => {
  const { server, port, count } = await countingHttpServer();
  try {
    const base = `http://127.0.0.1:${port}`;
    const missingFile = path.join(os.tmpdir(), 'does-not-exist-preview-creds.json');
    // Origin mismatch.
    let r = await runCli(CHECK_SCRIPT, ['--base-url', base, '--confirmed-origin', 'https://preview.example.com', '--credentials-file', missingFile, '--allow-insecure-loopback']);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /does not match/);
    // Credentials in URL.
    r = await runCli(CHECK_SCRIPT, ['--base-url', `http://user:pass@127.0.0.1:${port}`, '--confirmed-origin', base, '--credentials-file', missingFile, '--allow-insecure-loopback']);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /credentials/);
    // HTTP without the loopback flag.
    r = await runCli(CHECK_SCRIPT, ['--base-url', base, '--confirmed-origin', base, '--credentials-file', missingFile]);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /only HTTPS/);
    assert.equal(count(), 0, 'rejected checker targets must send zero requests');
  } finally {
    server.close();
  }
});

// ------------------------------------------- fake preview end-to-end

const FIXTURE_USERS = [
  { id: 1, email: 'preview-test-01@example.invalid', username: 'preview-test-01', password: 'pw-01', isActive: true, isApproved: true, hasPassword: true },
  { id: 2, email: 'preview-test-02@example.invalid', username: 'preview-test-02', password: 'pw-02', isActive: true, isApproved: true, hasPassword: true },
  { id: 3, email: 'preview-test-03@example.invalid', username: 'preview-test-03', password: 'pw-03', isActive: true, isApproved: false, hasPassword: true },
  { id: 4, email: 'preview-test-04@example.invalid', username: 'preview-test-04', password: 'pw-04', isActive: false, isApproved: true, hasPassword: true },
  { id: 5, email: 'preview-test-05@example.invalid', username: 'preview-test-05', password: null, isActive: true, isApproved: true, hasPassword: false },
];

function fakePreviewServer() {
  const seenHeaders = [];
  const server = http.createServer((req, res) => {
    seenHeaders.push({ method: req.method, url: req.url, headers: req.headers });
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const send = (status, payload, extraHeaders = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...extraHeaders });
        res.end(JSON.stringify(payload));
      };
      if (req.url !== '/api/mobile/session') return send(404, { error: 'not found' });
      if (req.method === 'POST') {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { return send(400, { error: 'bad json' }); }
        const user = FIXTURE_USERS.find((u) => u.email === parsed.identifier || u.username === parsed.identifier);
        if (!user) return send(404, { error: GENERIC_FAILURE });
        if (!user.isApproved || !user.isActive || !user.hasPassword) return send(403, { error: GENERIC_FAILURE });
        if (parsed.password !== user.password) return send(401, { error: GENERIC_FAILURE });
        const token = mintTestToken(FIXTURE_SECRET, { userId: user.id, email: user.email, username: user.username }, 7 * 24 * 3600);
        return send(200, { success: true, user: { id: user.id, email: user.email, username: user.username } },
          { 'set-cookie': `auth-token=${token}; Path=/; HttpOnly; Max-Age=604800` });
      }
      if (req.method === 'DELETE') {
        return send(200, { success: true },
          { 'set-cookie': 'auth-token=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' });
      }
      // GET profile.
      const cookie = String(req.headers.cookie || '');
      const match = /(?:^|;\s*)auth-token=([^;]*)/.exec(cookie);
      if (!match || !match[1]) return send(401, { error: 'Sign in with your website account.' });
      let payload;
      try {
        payload = verifyTestToken(FIXTURE_SECRET, match[1]);
      } catch {
        return send(401, { error: SESSION_EXPIRED });
      }
      const user = FIXTURE_USERS.find((u) => u.id === payload.userId);
      if (!user || !user.isActive || !user.isApproved) return send(403, { error: 'Account access is unavailable. Contact website support.' });
      return send(200, { user: { id: user.id, username: user.username, email: user.email, walletAddress: null } });
    });
  });
  return { server, seenHeaders };
}

async function writeFixtureCredentials(dir) {
  const file = path.join(dir, 'preview-credentials.json');
  await writeFile(file, JSON.stringify({
    accounts: FIXTURE_USERS.map((u) => ({ email: u.email, username: u.username, password: u.password })),
  }));
  return file;
}

test('checker CLI: full pass against a fake preview (jar switching + logout)', async () => {
  const { server, seenHeaders } = fakePreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-'));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const creds = await writeFixtureCredentials(dir);
    const r = await runCli(CHECK_SCRIPT, [
      '--base-url', base, '--confirmed-origin', base,
      '--credentials-file', creds, '--missing-user-id', '999999999',
      '--missing-user-verified', '--allow-insecure-loopback',
    ], { PREVIEW_JWT_SECRET: FIXTURE_SECRET });
    assert.equal(r.code, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    for (const line of ['profile changed to user-02', 'profile changed back to user-01', 'logout clears the cookie', 'profile after logout (no cookie sent)', 'missing-user session', 'expired token', '0 failed, 0 skipped']) {
      assert.match(r.stdout, new RegExp(line.replace(/[()]/g, '\\$&')), `missing line: ${line}`);
    }
    assert.equal(seenHeaders.some((h) => h.headers['x-vercel-protection-bypass']), false);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('checker CLI: missing-user case skips without the verified flag', async () => {
  const { server } = fakePreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-'));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const creds = await writeFixtureCredentials(dir);
    const r = await runCli(CHECK_SCRIPT, [
      '--base-url', base, '--confirmed-origin', base,
      '--credentials-file', creds, '--missing-user-id', '999999999',
      '--allow-insecure-loopback',
    ], { PREVIEW_JWT_SECRET: FIXTURE_SECRET });
    assert.equal(r.code, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.match(r.stdout, /SKIP\s+missing-user session/);
    assert.match(r.stdout, /1 skipped/);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('checker CLI: token cases skip without the preview secret', async () => {
  const { server } = fakePreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-'));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const creds = await writeFixtureCredentials(dir);
    const env = { ...process.env };
    delete env.PREVIEW_JWT_SECRET;
    const r = await runCli(CHECK_SCRIPT, [
      '--base-url', base, '--confirmed-origin', base,
      '--credentials-file', creds, '--missing-user-id', '999999999',
      '--allow-insecure-loopback',
    ], env);
    assert.equal(r.code, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.match(r.stdout, /2 skipped/);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('checker CLI: protection-bypass header is sent when configured', async () => {
  const { server, seenHeaders } = fakePreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-'));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const creds = await writeFixtureCredentials(dir);
    const r = await runCli(CHECK_SCRIPT, [
      '--base-url', base, '--confirmed-origin', base,
      '--credentials-file', creds, '--missing-user-id', '999999999',
      '--allow-insecure-loopback',
    ], { PREVIEW_JWT_SECRET: FIXTURE_SECRET, PREVIEW_PROTECTION_BYPASS: 'bypass-secret-for-test' });
    assert.equal(r.code, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.equal(seenHeaders.every((h) => h.headers['x-vercel-protection-bypass'] === 'bypass-secret-for-test'), true);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('checker CLI: redirects are refused, never followed', async () => {
  let redirectTargetHits = 0;
  const target = http.createServer((_req, res) => {
    redirectTargetHits += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  const redirector = http.createServer((_req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.1:${target.address().port}/api/mobile/session` });
    res.end();
  });
  await new Promise((resolve) => redirector.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'preview-guards-'));
  try {
    const base = `http://127.0.0.1:${redirector.address().port}`;
    const creds = await writeFixtureCredentials(dir);
    const r = await runCli(CHECK_SCRIPT, [
      '--base-url', base, '--confirmed-origin', base,
      '--credentials-file', creds, '--allow-insecure-loopback',
    ], { PREVIEW_JWT_SECRET: FIXTURE_SECRET });
    assert.notEqual(r.code, 0, 'redirect responses must fail the checks');
    assert.equal(redirectTargetHits, 0, 'the redirect target must never be requested');
  } finally {
    redirector.close();
    target.close();
    await rm(dir, { recursive: true, force: true });
  }
});

// The fake server and the checker mint/verify with the same helper;
// this test pins the helper to a hand-built HMAC so a helper change
// cannot silently drift from the JWT format.
test('token helper matches a hand-built HS256 token', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 3, email: 'x@example.invalid', username: 'x', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  const signature = createHmac('sha256', FIXTURE_SECRET).update(`${header}.${payload}`).digest('base64url');
  const decoded = verifyTestToken(FIXTURE_SECRET, `${header}.${payload}.${signature}`);
  assert.equal(decoded.userId, 3);
});
