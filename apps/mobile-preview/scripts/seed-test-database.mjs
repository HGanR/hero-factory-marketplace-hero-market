#!/usr/bin/env node
/**
 * Seed synthetic test accounts into an ISOLATED test database for the
 * SMART TRUST Mobile protected Preview.
 *
 * Status: NOT RUN. Not executed against any database. Review before
 * first use. This script never runs as part of the build.
 *
 * Design (all verified against branch feat/smart-trust-mobile-preview-20261026
 * at e26b3dd932fec6b627a5a675725047e381343957):
 * - Passwords are generated locally and hashed with bcryptjs
 *   `hashSync(password, 10)` — the same function and cost factor as
 *   `hashPassword` in src/lib/auth.ts, which the copied login route
 *   verifies with `bcrypt.compareSync`.
 * - The table definition is transcribed from src/lib/db/schema.ts
 *   (`marketplace_users`); see test-schema.sql. The login route selects
 *   the entire row, so every column must exist.
 * - The script reads ONLY `TEST_DATABASE_URL` (never `DATABASE_URL`), so
 *   a production connection string cannot reach it by accident through
 *   the usual variable name. It refuses database names containing
 *   "prod", and --database must match the database in the URL.
 * - TLS follows the website's own rule in
 *   src/lib/db/mysql2-connection-options.ts: TiDB Cloud hosts
 *   (tidbcloud / .tidb.io) and TEST_DATABASE_SSL=1/true/required force
 *   TLS with rejectUnauthorized.
 * - Only rows with the five synthetic emails below are ever deleted or
 *   inserted. No other row is touched. Passwords are printed ONCE to
 *   stdout (or written to a credentials file with mode 0600) and must
 *   never be committed to Git or pasted into chat.
 *
 * Usage (from apps/mobile-preview, after `npm ci`):
 *   node scripts/seed-test-database.mjs [--apply-schema] [--apply --database <name>]
 *     [--write-credentials-file <path-outside-the-repo>]
 * Without --apply: dry run only — prints the plan, connects to nothing.
 * With --apply-schema: applies test-schema.sql first (same connection).
 * Requires: TEST_DATABASE_URL.
 */

import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const SYNTHETIC_ACCOUNTS = [
  { email: 'preview-test-01@example.invalid', username: 'preview-test-01', isActive: true, isApproved: true, hasPassword: true, role: 'active/approved — signs in' },
  { email: 'preview-test-02@example.invalid', username: 'preview-test-02', isActive: true, isApproved: true, hasPassword: true, role: 'active/approved — account-switch testing' },
  { email: 'preview-test-03@example.invalid', username: 'preview-test-03', isActive: true, isApproved: false, hasPassword: true, role: 'unapproved — must be refused (403)' },
  { email: 'preview-test-04@example.invalid', username: 'preview-test-04', isActive: false, isApproved: true, hasPassword: true, role: 'inactive — must be refused (403)' },
  { email: 'preview-test-05@example.invalid', username: 'preview-test-05', isActive: true, isApproved: true, hasPassword: false, role: 'no password set — must be refused (403)' },
];

const EXPECTED_COLUMNS = ['id', 'email', 'username', 'passwordHash', 'isActive', 'isApproved', 'walletAddress', 'hasTokenAccess', 'phone', 'smsConsent', 'revenueOsAccess', 'lastActiveTrustId', 'createdAt', 'updatedAt', 'lastLogin'];

function fail(message, code = 2) {
  console.error(`seed-test-database: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { apply: false, applySchema: false, database: null, credentialsFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--apply-schema') args.applySchema = true;
    else if (argv[i] === '--database') args.database = argv[++i];
    else if (argv[i] === '--write-credentials-file') args.credentialsFile = argv[++i];
    else fail(`unknown argument: ${argv[i]}\nUsage: node scripts/seed-test-database.mjs [--apply-schema] [--apply --database <name>] [--write-credentials-file <path>]`);
  }
  return args;
}

function connectionOptionsFromUrl(raw) {
  const trimmed = raw.trim();
  const forceSsl =
    process.env.TEST_DATABASE_SSL === '1' ||
    process.env.TEST_DATABASE_SSL === 'true' ||
    process.env.TEST_DATABASE_SSL === 'required' ||
    /tidbcloud/i.test(trimmed) ||
    /\.tidb\.io/i.test(trimmed);
  const u = new URL(trimmed.includes('://') ? trimmed : `mysql://${trimmed}`);
  const database = u.pathname.replace(/^\//, '').split('?')[0] || '';
  const options = {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: database || undefined,
  };
  if (forceSsl) options.ssl = { rejectUnauthorized: true };
  return { options, host: u.hostname, database };
}

function generatePassword() {
  return randomBytes(18).toString('base64url');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('Synthetic preview accounts (dry run unless --apply is given):');
  for (const a of SYNTHETIC_ACCOUNTS) {
    console.log(`  ${a.username} <${a.email}> active=${a.isActive} approved=${a.isApproved} password=${a.hasPassword ? 'set' : 'NULL'} — ${a.role}`);
  }
  if (!args.apply) {
    console.log('\nDry run: nothing was connected, generated, or written.');
    console.log('Re-run with --apply --database <name> to seed. Passwords print once; store them outside Git/chat.');
    return;
  }
  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl?.trim()) fail('TEST_DATABASE_URL is not set. Set it to the ISOLATED test database URL (never a production URL).');
  if (!args.database) fail('--database <name> is required with --apply and must match the database in TEST_DATABASE_URL.');
  if (/prod/i.test(args.database)) fail(`refusing database name "${args.database}": test databases must not look like production names.`);
  const { options, host, database } = connectionOptionsFromUrl(rawUrl);
  if (database !== args.database) fail(`--database "${args.database}" does not match the database "${database}" in TEST_DATABASE_URL. Refusing to proceed.`);
  console.log(`\nSeeding host=${host} database=${database} (password never logged).`);

  const connection = await mysql.createConnection({ ...options, multipleStatements: Boolean(args.applySchema) });
  try {
    if (args.applySchema) {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const schemaSql = await readFile(path.join(here, 'test-schema.sql'), 'utf8');
      await connection.query(schemaSql);
      console.log('Applied test-schema.sql.');
    }
    // Pre-flight: the table must exist with every column the login path selects.
    const [columns] = await connection.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [database, 'marketplace_users'],
    );
    const present = new Set(columns.map((c) => c.COLUMN_NAME));
    const missing = EXPECTED_COLUMNS.filter((c) => !present.has(c));
    if (missing.length > 0) fail(`pre-flight refused: marketplace_users is missing columns: ${missing.join(', ')}. Apply test-schema.sql to the correct database first.`, 3);
    for (const c of present) {
      if (!EXPECTED_COLUMNS.includes(c)) console.log(`Warning: unexpected extra column "${c}" — proceeding; login selects the whole row.`);
    }

    const emails = SYNTHETIC_ACCOUNTS.map((a) => a.email);
    const credentials = [];
    await connection.beginTransaction();
    try {
      await connection.query('DELETE FROM `marketplace_users` WHERE `email` IN (?)', [emails]);
      for (const a of SYNTHETIC_ACCOUNTS) {
        let password = null;
        let passwordHash = null;
        if (a.hasPassword) {
          password = generatePassword();
          passwordHash = bcrypt.hashSync(password, 10);
        }
        await connection.query(
          'INSERT INTO `marketplace_users` (`email`, `username`, `passwordHash`, `isActive`, `isApproved`, `walletAddress`, `hasTokenAccess`, `phone`, `smsConsent`, `revenueOsAccess`, `lastActiveTrustId`, `lastLogin`) VALUES (?, ?, ?, ?, ?, NULL, 0, NULL, 0, 1, NULL, NULL)',
          [a.email, a.username, passwordHash, a.isActive ? 1 : 0, a.isApproved ? 1 : 0],
        );
        credentials.push({ email: a.email, username: a.username, password });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    // Verify: read back flags only (never hashes).
    const [rows] = await connection.query(
      'SELECT `email`, `isActive`, `isApproved`, (`passwordHash` IS NOT NULL) AS `hasPassword` FROM `marketplace_users` WHERE `email` IN (?) ORDER BY `email`',
      [emails],
    );
    console.log(`\nSeeded ${rows.length} synthetic accounts; verification:`);
    for (const r of rows) {
      console.log(`  ${r.email} active=${r.isActive} approved=${r.isApproved} passwordSet=${r.hasPassword}`);
    }
    if (rows.length !== SYNTHETIC_ACCOUNTS.length) fail('verification failed: row count mismatch after seeding.', 1);

    console.log('\nCREDENTIALS — shown once. Store them in a password manager; never commit them or paste them into chat:');
    for (const c of credentials) {
      console.log(`  ${c.username} <${c.email}>  password: ${c.password ?? '(none — no-password account)'}`);
    }
    if (args.credentialsFile) {
      await writeFile(args.credentialsFile, JSON.stringify({ accounts: credentials }, null, 2), { mode: 0o600 });
      await chmod(args.credentialsFile, 0o600);
      console.log(`\nCredentials also written to ${args.credentialsFile} (mode 0600). Keep that file outside the repository.`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`seed-test-database: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
