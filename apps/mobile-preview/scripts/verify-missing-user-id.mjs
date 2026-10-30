#!/usr/bin/env node
/**
 * Read-only proof that a user id is ABSENT from the isolated test
 * database, for the missing-user session check.
 *
 * Status: NOT RUN against any database. Review before first use.
 *
 * Why this exists: the profile route returns the same 403 for a
 * missing user as for an inactive/unapproved account, so the
 * missing-user check in check-preview-accounts.mjs can falsely pass
 * when its id actually belongs to a refused account. Guessing an id
 * (e.g. 999999999) does not establish absence. This script proves
 * absence with a single read-only SELECT before the checker runs.
 *
 * Read-only by construction: the only statement it issues is one
 * SELECT. It uses its own connection variable,
 * TEST_READONLY_DATABASE_URL, with the same confirmed-host/database
 * guards as the seed script, and the same TLS rule. The credential
 * must still be restricted at provisioning time (SELECT on
 * marketplace_users only); the script cannot create that restriction.
 * It prints the checked id and a row count of 0 — never row contents.
 *
 * With --proof-file it also writes a machine-checkable proof record
 * {userId, host, port, database, rows: 0, checkedAt} that the checker
 * validates, binding the absence check to the SAME id and the SAME
 * database the checker is about to use. The proof file is created
 * exclusively ('wx', mode 0600) outside the repository, like a
 * credentials file. A bare operator flag cannot provide that binding,
 * so the checker no longer accepts one.
 *
 * Usage (from apps/mobile-preview, after `npm ci`):
 *   TEST_READONLY_DATABASE_URL='<read-only test-database URL>' \
 *   node scripts/verify-missing-user-id.mjs \
 *     --user-id <id> --confirmed-host <host> --confirmed-database <name> \
 *     [--proof-file <path-outside-the-repo>]
 * Exit code 0: the id is absent (0 rows). Exit code 1: the id is
 * present, or any error occurred. Run this BEFORE check-preview-accounts.mjs
 * and pass --missing-user-proof only when it exits 0.
 */

import { chmod, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  confirmSeedTarget,
  parseSeedTarget,
  resolveCredentialsDestination,
} from './preview-test-helpers.mjs';

function fail(message, code = 2) {
  console.error(`verify-missing-user-id: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { userId: null, confirmedHost: null, confirmedDatabase: null, proofFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user-id') args.userId = argv[++i];
    else if (argv[i] === '--confirmed-host') args.confirmedHost = argv[++i];
    else if (argv[i] === '--confirmed-database') args.confirmedDatabase = argv[++i];
    else if (argv[i] === '--proof-file') args.proofFile = argv[++i];
    else fail(`unknown argument: ${argv[i]}\nUsage: node scripts/verify-missing-user-id.mjs --user-id <id> --confirmed-host <host> --confirmed-database <name> [--proof-file <path>]`);
  }
  if (args.userId === null) fail('--user-id is required.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = Number(args.userId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('--user-id must be a positive integer.');

  // Guards run BEFORE any package import or connection.
  const rawUrl = process.env.TEST_READONLY_DATABASE_URL;
  if (!rawUrl?.trim()) fail('TEST_READONLY_DATABASE_URL is not set. Set it to a READ-ONLY credential for the ISOLATED test database (never a production URL).');
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
  console.log(`Checking host=${parsed.host}:${parsed.port} database=${parsed.database} for user id=${id} (read-only; password never logged).`);

  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: decodeURIComponent(new URL(rawUrl.includes('://') ? rawUrl : `mysql://${rawUrl}`).password || ''),
    database: parsed.database,
    ssl: parsed.forceSsl ? { rejectUnauthorized: true } : undefined,
  });
  try {
    const [rows] = await connection.query(
      'SELECT `id` FROM `marketplace_users` WHERE `id` = ? LIMIT 1',
      [id],
    );
    if (rows.length > 0) {
      console.error(`verify-missing-user-id: id=${id} is PRESENT in ${parsed.database}. Do not use it as the missing-user id.`);
      process.exit(1);
    }
    console.log(`verify-missing-user-id: id=${id} is ABSENT from ${parsed.database} (0 rows). It may be used with --missing-user-proof.`);
    if (args.proofFile) {
      const scriptDir = path.dirname(fileURLToPath(import.meta.url));
      const dest = await resolveCredentialsDestination(args.proofFile, scriptDir);
      if (dest.insideRepo) fail(`refusing proof file inside the repository: ${dest.realDest} (repository root: ${dest.realRepoRoot}).`, 3);
      if (dest.exists) fail(`refusing proof file: a file already exists at ${dest.realDest}. Remove it yourself or choose another path.`, 3);
      const proof = { userId: id, host: parsed.host, port: parsed.port, database: parsed.database, rows: 0, checkedAt: new Date().toISOString() };
      let handle = null;
      try {
        handle = await open(dest.realDest, 'wx', 0o600);
        await handle.writeFile(JSON.stringify(proof, null, 2));
        await handle.sync();
        await chmod(dest.realDest, 0o600);
      } catch (error) {
        if (handle) await handle.close().catch(() => {});
        await unlink(dest.realDest).catch(() => {});
        throw error;
      }
      await handle.close();
      console.log(`Proof written to ${dest.realDest} (mode 0600).`);
    }
  } finally {
    await connection.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`verify-missing-user-id: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
