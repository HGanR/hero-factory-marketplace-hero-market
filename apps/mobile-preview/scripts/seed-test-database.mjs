#!/usr/bin/env node
/**
 * Seed synthetic test accounts into an ISOLATED test database for the
 * SMART TRUST Mobile protected Preview.
 *
 * Status: NOT RUN against any database. Review before first use. This
 * script never runs as part of the build.
 *
 * Design (verified against branch feat/smart-trust-mobile-preview-20261026
 * at e26b3dd932fec6b627a5a675725047e381343957):
 * - Passwords are generated locally and hashed with bcryptjs
 *   `hashSync(password, 10)` — the same function and cost factor as
 *   `hashPassword` in src/lib/auth.ts, which the copied login route
 *   verifies with `bcrypt.compareSync`. Third-party imports happen
 *   ONLY after every target guard passes, so a rejected target causes
 *   zero database activity (and no package loading at all).
 * - The table definition is transcribed from src/lib/db/schema.ts
 *   (`marketplace_users`); see test-schema.sql. The login route selects
 *   the entire row, so every column must exist.
 * - The script reads ONLY `TEST_DATABASE_URL` (never `DATABASE_URL`).
 *   The target host and database must be EXPLICITLY confirmed with
 *   --confirmed-host / --confirmed-database and must match the URL
 *   exactly. Substring rules are not used: rejecting names containing
 *   "prod" would still allow a production database name.
 * - Before deleting or inserting anything, the script refuses when the
 *   table holds account rows outside the synthetic set. There is no
 *   escape hatch: a database with unexpected rows is never seeded by
 *   this script. Refusals print a row COUNT only, never an existing
 *   account's email or row contents.
 * - The seed credential is expected to be restricted (see
 *   docs/mobile/PREVIEW-TEST-DATABASE.md). As a best-effort check the
 *   script reads SHOW GRANTS and refuses on plainly dangerous grants
 *   (USAGE alone is not dangerous); an unreadable grant list warns and
 *   continues — provisioning-time restriction is the real control.
 * - TLS follows the website's own rule in
 *   src/lib/db/mysql2-connection-options.ts: TiDB Cloud hosts
 *   (tidbcloud / .tidb.io) and TEST_DATABASE_SSL=1/true/required force
 *   TLS with rejectUnauthorized.
 * - Credentials file: the destination is resolved through symlinks and
 *   must lie outside the repository; the file is created EXCLUSIVELY
 *   ('wx', mode 0600) BEFORE any database change, so no check-then-
 *   write race can overwrite a file created in between, and a failed
 *   run removes the empty file it created. In file mode the passwords
 *   are never printed; without a file they print ONCE to stdout.
 *   Passwords must never be committed to Git or pasted into chat.
 *
 * Usage (from apps/mobile-preview, after `npm ci`):
 *   node scripts/seed-test-database.mjs [--apply-schema]
 *     [--apply --confirmed-host <host> --confirmed-database <name>
 *      [--write-credentials-file <path-outside-the-repo>]]
 * Without --apply: dry run only — prints the plan, connects to nothing.
 * With --apply-schema: applies test-schema.sql first (same connection).
 * Requires: TEST_DATABASE_URL.
 */

import { chmod, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  confirmSeedTarget,
  diffColumns,
  formatCredentialsOutput,
  generateTestPassword,
  grantsLookDangerous,
  parseSeedTarget,
  resolveCredentialsDestination,
  unexpectedRowsMessage,
} from './preview-test-helpers.mjs';

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
  const args = { apply: false, applySchema: false, confirmedHost: null, confirmedDatabase: null, credentialsFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--apply-schema') args.applySchema = true;
    else if (argv[i] === '--confirmed-host') args.confirmedHost = argv[++i];
    else if (argv[i] === '--confirmed-database') args.confirmedDatabase = argv[++i];
    else if (argv[i] === '--write-credentials-file') args.credentialsFile = argv[++i];
    else fail(`unknown argument: ${argv[i]}\nUsage: node scripts/seed-test-database.mjs [--apply-schema] [--apply --confirmed-host <host> --confirmed-database <name> [--write-credentials-file <path>]]`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('Synthetic preview accounts (dry run unless --apply is given):');
  for (const a of SYNTHETIC_ACCOUNTS) {
    console.log(`  ${a.username} <${a.email}> active=${a.isActive} approved=${a.isApproved} password=${a.hasPassword ? 'set' : 'NULL'} — ${a.role}`);
  }
  if (!args.apply) {
    console.log('\nDry run: nothing was connected, generated, or written.');
    console.log('Re-run with --apply --confirmed-host <host> --confirmed-database <name> to seed. Passwords print once unless a credentials file is requested; store them outside Git/chat.');
    return;
  }

  // ---- Every guard below runs BEFORE any package import or connection,
  // so a rejected target causes zero database activity. ----
  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl?.trim()) fail('TEST_DATABASE_URL is not set. Set it to the ISOLATED test database URL (never a production URL).');
  let parsed;
  try {
    parsed = parseSeedTarget(rawUrl, process.env.TEST_DATABASE_SSL);
  } catch (error) {
    fail(error.message);
  }
  try {
    confirmSeedTarget(parsed, args.confirmedHost, args.confirmedDatabase);
  } catch (error) {
    fail(error.message, 3);
  }
  let credentialsDest = null;
  if (args.credentialsFile) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    try {
      credentialsDest = await resolveCredentialsDestination(args.credentialsFile, scriptDir);
    } catch (error) {
      fail(error.message, 3);
    }
    if (credentialsDest.insideRepo) fail(`refusing credentials file inside the repository: ${credentialsDest.realDest} (repository root: ${credentialsDest.realRepoRoot}).`, 3);
    if (credentialsDest.exists) fail(`refusing credentials file: a file already exists at ${credentialsDest.realDest}. Remove it yourself or choose another path.`, 3);
  }
  console.log(`\nSeeding host=${parsed.host}:${parsed.port} database=${parsed.database} (password never logged).`);

  // Guards passed: only now load third-party packages.
  const [{ default: bcrypt }, mysql] = await Promise.all([
    import('bcryptjs'),
    import('mysql2/promise'),
  ]);

  let connection = null;
  let credHandle = null;
  let wroteCredentials = false;
  try {
    // Establish the private output file BEFORE any database change.
    // Exclusive creation ('wx') closes the check-then-write race: if
    // anything appears at the destination first, open fails here and
    // no database work happens.
    if (credentialsDest) {
      credHandle = await open(credentialsDest.realDest, 'wx', 0o600);
    }
    connection = await mysql.createConnection({
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: decodeURIComponent(new URL(rawUrl.includes('://') ? rawUrl : `mysql://${rawUrl}`).password || ''),
      database: parsed.database,
      ssl: parsed.forceSsl ? { rejectUnauthorized: true } : undefined,
      multipleStatements: Boolean(args.applySchema),
    });

    // Best-effort restricted-credential check: refuse plainly dangerous
    // grants; an unreadable grant list warns and continues.
    try {
      const [grantRows] = await connection.query('SHOW GRANTS FOR CURRENT_USER()');
      const grantsText = grantRows.map((r) => Object.values(r)[0]).join('\n');
      if (grantsLookDangerous(grantsText)) {
        fail('refusing: the seed credential holds dangerous grants. Use the restricted test credential from docs/mobile/PREVIEW-TEST-DATABASE.md.', 3);
      }
    } catch (error) {
      if (error && error.message && error.message.startsWith('refusing:')) throw error;
      console.log('Warning: could not read SHOW GRANTS; proceeding — the credential must still be the restricted test credential.');
    }

    if (args.applySchema) {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const schemaSql = await readFile(path.join(here, 'test-schema.sql'), 'utf8');
      await connection.query(schemaSql);
      console.log('Applied test-schema.sql.');
    }

    // Pre-flight: the table must exist with every column the login path selects.
    const [columns] = await connection.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [parsed.database, 'marketplace_users'],
    );
    const { missing, extra } = diffColumns(columns.map((c) => c.COLUMN_NAME), EXPECTED_COLUMNS);
    if (missing.length > 0) fail(`pre-flight refused: marketplace_users is missing columns: ${missing.join(', ')}. Apply test-schema.sql to the correct database first.`, 3);
    for (const c of extra) console.log(`Warning: unexpected extra column "${c}" — proceeding; login selects the whole row.`);

    // Isolation: refuse unexpected existing account rows before mutating.
    // No escape hatch. The refusal prints a count only.
    const [existing] = await connection.query('SELECT `email` FROM `marketplace_users`');
    const syntheticEmails = new Set(SYNTHETIC_ACCOUNTS.map((a) => a.email));
    const unexpectedCount = existing.filter((r) => !syntheticEmails.has(r.email)).length;
    if (unexpectedCount > 0) fail(unexpectedRowsMessage(unexpectedCount), 3);

    const emails = SYNTHETIC_ACCOUNTS.map((a) => a.email);
    const credentials = [];
    await connection.beginTransaction();
    try {
      await connection.query('DELETE FROM `marketplace_users` WHERE `email` IN (?)', [emails]);
      for (const a of SYNTHETIC_ACCOUNTS) {
        let password = null;
        let passwordHash = null;
        if (a.hasPassword) {
          password = generateTestPassword();
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

    // Verify: read back ids + flags only (never hashes). The ids let the
    // operator pick a missing-user id established as unused.
    const [rows] = await connection.query(
      'SELECT `id`, `email`, `isActive`, `isApproved`, (`passwordHash` IS NOT NULL) AS `hasPassword` FROM `marketplace_users` WHERE `email` IN (?) ORDER BY `id`',
      [emails],
    );
    console.log(`\nSeeded ${rows.length} synthetic accounts; verification:`);
    for (const r of rows) {
      console.log(`  id=${r.id} ${r.email} active=${r.isActive} approved=${r.isApproved} passwordSet=${r.hasPassword}`);
    }
    if (rows.length !== SYNTHETIC_ACCOUNTS.length) fail('verification failed: row count mismatch after seeding.', 1);

    if (credHandle) {
      await credHandle.writeFile(JSON.stringify({ accounts: credentials }, null, 2));
      await chmod(credentialsDest.realDest, 0o600);
      await credHandle.close();
      credHandle = null;
      wroteCredentials = true;
      console.log('\nCREDENTIALS — written to file only, passwords NOT printed:');
      console.log(formatCredentialsOutput(credentials, { toFile: true }));
      console.log(`File: ${credentialsDest.realDest} (mode 0600). Keep it outside the repository.`);
    } else {
      console.log('\nCREDENTIALS — shown once. Store them in a password manager; never commit them or paste them into chat:');
      console.log(formatCredentialsOutput(credentials, { toFile: false }));
    }
  } catch (error) {
    // A failed run must not leave a half-written credentials file behind.
    if (credHandle && !wroteCredentials) {
      await credHandle.close().catch(() => {});
      if (credentialsDest) await unlink(credentialsDest.realDest).catch(() => {});
    }
    throw error;
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`seed-test-database: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
