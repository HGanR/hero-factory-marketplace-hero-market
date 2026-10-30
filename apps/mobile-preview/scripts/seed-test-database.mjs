#!/usr/bin/env node
/**
 * Seed synthetic test accounts into an ISOLATED test database for the
 * SMART TRUST Mobile protected Preview.
 *
 * Status: NOT RUN against any database. Review before first use. This
 * script never runs as part of the build.
 *
 * CLI over seed-runner.mjs, which owns the failure-handling
 * contract. This file does guards, file establishment, connection,
 * and exit-code mapping — and NOTHING ELSE that can fail after the
 * credentials file is opened. In particular it never exits mid-flow:
 * refusals throw SeedRefusal and the single
 * top-level handler sets the exit code after all cleanup has run, so
 * a refusal after the file is opened still removes the empty file.
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
 * - Before deleting or inserting anything, the runner refuses when the
 *   table holds account rows outside the synthetic set. There is no
 *   escape hatch. Refusals print a row COUNT only, never an existing
 *   account's email or row contents.
 * - Credentials are saved and FLUSHED before the commit is attempted
 *   (see seed-runner.mjs). If the commit outcome is uncertain or a
 *   post-commit step fails, recovery credentials are PRESERVED — the
 *   file is kept (file mode) or printed as recovery output (stdout
 *   mode) — and the operator must verify the database manually.
 * - Credentials file: the destination is resolved through symlinks and
 *   must lie outside the repository; the file is created EXCLUSIVELY
 *   ('wx', mode 0600) BEFORE any database change, so no check-then-
 *   write race can overwrite a file created in between. In file mode
 *   the passwords are never printed; without a file they print ONCE
 *   to stdout. Passwords must never be committed to Git or pasted into
 *   chat.
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
  SeedRefusal,
  confirmSeedTarget,
  formatCredentialsOutput,
  parseSeedTarget,
  resolveCredentialsDestination,
} from './preview-test-helpers.mjs';
import { seedAccounts } from './seed-runner.mjs';

const SYNTHETIC_ACCOUNTS = [
  { email: 'preview-test-01@example.invalid', username: 'preview-test-01', isActive: true, isApproved: true, hasPassword: true, role: 'active/approved — signs in' },
  { email: 'preview-test-02@example.invalid', username: 'preview-test-02', isActive: true, isApproved: true, hasPassword: true, role: 'active/approved — account-switch testing' },
  { email: 'preview-test-03@example.invalid', username: 'preview-test-03', isActive: true, isApproved: false, hasPassword: true, role: 'unapproved — must be refused (403)' },
  { email: 'preview-test-04@example.invalid', username: 'preview-test-04', isActive: false, isApproved: true, hasPassword: true, role: 'inactive — must be refused (403)' },
  { email: 'preview-test-05@example.invalid', username: 'preview-test-05', isActive: true, isApproved: true, hasPassword: false, role: 'no password set — must be refused (403)' },
];

const EXPECTED_COLUMNS = ['id', 'email', 'username', 'passwordHash', 'isActive', 'isApproved', 'walletAddress', 'hasTokenAccess', 'phone', 'smsConsent', 'revenueOsAccess', 'lastActiveTrustId', 'createdAt', 'updatedAt', 'lastLogin'];

function parseArgs(argv) {
  const args = { apply: false, applySchema: false, confirmedHost: null, confirmedDatabase: null, credentialsFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--apply-schema') args.applySchema = true;
    else if (argv[i] === '--confirmed-host') args.confirmedHost = argv[++i];
    else if (argv[i] === '--confirmed-database') args.confirmedDatabase = argv[++i];
    else if (argv[i] === '--write-credentials-file') args.credentialsFile = argv[++i];
    else throw new SeedRefusal(`unknown argument: ${argv[i]}\nUsage: node scripts/seed-test-database.mjs [--apply-schema] [--apply --confirmed-host <host> --confirmed-database <name> [--write-credentials-file <path>]]`, 2);
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
  // so a rejected target causes zero database activity. Throws here
  // reach the top-level handler; nothing has been opened yet. ----
  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl?.trim()) throw new SeedRefusal('TEST_DATABASE_URL is not set. Set it to the ISOLATED test database URL (never a production URL).', 2);
  const parsed = parseSeedTarget(rawUrl, process.env.TEST_DATABASE_SSL);
  confirmSeedTarget(parsed, args.confirmedHost, args.confirmedDatabase);
  let credentialsDest = null;
  if (args.credentialsFile) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    credentialsDest = await resolveCredentialsDestination(args.credentialsFile, scriptDir);
    if (credentialsDest.insideRepo) throw new SeedRefusal(`refusing credentials file inside the repository: ${credentialsDest.realDest} (repository root: ${credentialsDest.realRepoRoot}).`, 3);
    if (credentialsDest.exists) throw new SeedRefusal(`refusing credentials file: a file already exists at ${credentialsDest.realDest}. Remove it yourself or choose another path.`, 3);
  }
  console.log(`\nSeeding host=${parsed.host}:${parsed.port} database=${parsed.database} (password never logged).`);

  // Guards passed: only now load third-party packages.
  const [{ default: bcrypt }, mysql] = await Promise.all([
    import('bcryptjs'),
    import('mysql2/promise'),
  ]);

  let schemaSql = null;
  if (args.applySchema) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    schemaSql = await readFile(path.join(here, 'test-schema.sql'), 'utf8');
  }

  // Credentials store: established BEFORE any database change. The
  // runner calls save() pre-commit, discard() on pre-commit failure,
  // preserve() when the commit outcome is uncertain or a post-commit
  // step fails. closeIfUnsettled() covers failures before save().
  let credHandle = null;
  let storeState = 'none';
  let stdoutStash = null;
  const store = {
    async save(credentials) {
      if (credHandle) {
        await credHandle.writeFile(JSON.stringify({ accounts: credentials }, null, 2));
        await credHandle.sync();
        storeState = 'saved';
      } else {
        stdoutStash = credentials;
        storeState = 'saved';
      }
    },
    async discard() {
      if (storeState === 'saved' || storeState === 'open') {
        stdoutStash = null;
        if (credHandle) {
          await credHandle.close().catch(() => {});
          credHandle = null;
          await unlink(credentialsDest.realDest).catch(() => {});
        }
        storeState = 'discarded';
      }
    },
    async preserve() {
      if (storeState === 'saved' || storeState === 'open') {
        if (credHandle) {
          await credHandle.close().catch(() => {});
          credHandle = null;
        }
        storeState = 'preserved';
        if (!credentialsDest) {
          console.error('\nWARNING: the commit outcome is uncertain or a later step failed. RECOVERY CREDENTIALS (only copy — store them securely):');
          console.error(formatCredentialsOutput(stdoutStash || [], { toFile: false }));
          console.error('Verify the database manually before retrying.');
        } else {
          console.error(`\nWARNING: the commit outcome is uncertain or a later step failed. Recovery credentials were preserved in ${credentialsDest.realDest} — verify the database manually before retrying.`);
        }
      }
    },
    async closeIfUnsettled() {
      if (storeState === 'open') await this.discard();
    },
  };

  let connection = null;
  try {
    if (credentialsDest) {
      credHandle = await open(credentialsDest.realDest, 'wx', 0o600);
      storeState = 'open';
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
    const { rows, credentials } = await seedAccounts({
      connection,
      hashPassword: (password) => bcrypt.hashSync(password, 10),
      schemaSql,
      database: parsed.database,
      accounts: SYNTHETIC_ACCOUNTS,
      expectedColumns: EXPECTED_COLUMNS,
      store,
      log: (...line) => console.log(...line),
    });

    console.log(`\nSeeded ${rows.length} synthetic accounts; verification:`);
    for (const r of rows) {
      console.log(`  id=${r.id} ${r.email} active=${r.isActive} approved=${r.isApproved} passwordSet=${r.hasPassword}`);
    }
    if (credHandle) {
      await chmod(credentialsDest.realDest, 0o600);
      await credHandle.close();
      credHandle = null;
      storeState = 'closed';
      console.log('\nCREDENTIALS — written to file only, passwords NOT printed:');
      console.log(formatCredentialsOutput(credentials, { toFile: true }));
      console.log(`File: ${credentialsDest.realDest} (mode 0600). Keep it outside the repository.`);
    } else {
      console.log('\nCREDENTIALS — shown once. Store them in a password manager; never commit them or paste them into chat:');
      console.log(formatCredentialsOutput(credentials, { toFile: false }));
    }
  } finally {
    await store.closeIfUnsettled();
    if (credHandle) await credHandle.close().catch(() => {});
    if (connection) await connection.end().catch(() => {});
  }
}

// Single exit-code mapping, after all cleanup has run. Never
// exit mid-flow.
main().catch((error) => {
  console.error(`seed-test-database: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof SeedRefusal ? error.code : 1;
});
